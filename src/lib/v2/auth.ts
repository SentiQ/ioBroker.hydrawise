import { parseRetryAfter } from '../helpers';

export const V2_TOKEN_URL = 'https://app.hydrawise.com/api/v2/oauth/access-token';
export const V2_GRAPH_URL = 'https://app.hydrawise.com/api/v2/graph';
export const V2_CLIENT_ID = 'hydrawise_app';
export const V2_CLIENT_SECRET = 'zn3CrjglwNV1';
export const V2_TOKEN_SKEW_MS = 5 * 60 * 1000;
export const V2_REQUEST_TIMEOUT_MS = 30_000;

/** OAuth access token for the Hydrawise v2 GraphQL API. */
export interface V2Token {
    /** Bearer access token. */
    accessToken: string;
    /** Refresh token. */
    refreshToken: string;
    /** Token type, usually Bearer. */
    tokenType: string;
    /** Unix epoch milliseconds when the access token expires. */
    expiresAt: number;
}

/** HTTP/GraphQL error from the Hydrawise v2 API. */
export class HydrawiseV2Error extends Error {
    readonly code: number | string;
    readonly data: unknown;
    readonly retryAfter?: number;

    /**
     * @param message human-readable error
     * @param code HTTP status or error code
     * @param data response body
     * @param retryAfter Retry-After in seconds
     */
    constructor(message: string, code: number | string, data?: unknown, retryAfter?: number) {
        super(message);
        this.name = 'HydrawiseV2Error';
        this.code = code;
        this.data = data;
        this.retryAfter = retryAfter;
    }
}

/**
 * True when the access token is missing or expires within the refresh skew.
 *
 * @param token current token
 * @param nowMs current time
 */
export function tokenNeedsRefresh(token: V2Token | null, nowMs: number = Date.now()): boolean {
    if (!token) {
        return true;
    }
    return token.expiresAt - nowMs < V2_TOKEN_SKEW_MS;
}

function parseTokenResponse(json: Record<string, any>): V2Token {
    if (json.error) {
        throw new HydrawiseV2Error(String(json.message || json.error), 'unauthorized', json);
    }
    if (!json.access_token || !json.token_type) {
        throw new HydrawiseV2Error('Invalid token response', 'unauthorized', json);
    }
    return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token || '',
        tokenType: json.token_type,
        expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
    };
}

async function postForm(url: string, params: Record<string, string>): Promise<V2Token> {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), V2_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method: 'POST',
            signal: abort.signal,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: new URLSearchParams(params),
        });
        const json = (await response.json().catch(() => ({}))) as Record<string, any>;
        if (!response.ok && !json.error) {
            throw new HydrawiseV2Error(
                `HTTP ${response.status}`,
                response.status,
                json,
                parseRetryAfter(response.headers.get('Retry-After')),
            );
        }
        return parseTokenResponse(json);
    } catch (error: any) {
        if (error instanceof HydrawiseV2Error) {
            throw error;
        }
        if (error?.name === 'AbortError') {
            throw new HydrawiseV2Error('request timed out', 'ECONNABORTED');
        }
        throw new HydrawiseV2Error(error?.message || String(error), error?.code || 'ENOTFOUND');
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Fetch an OAuth access token with username/password (password grant).
 *
 * @param username Hydrawise account email
 * @param password Hydrawise account password
 */
export async function fetchAccessToken(username: string, password: string): Promise<V2Token> {
    return postForm(V2_TOKEN_URL, {
        client_id: V2_CLIENT_ID,
        client_secret: V2_CLIENT_SECRET,
        grant_type: 'password',
        scope: 'all',
        username,
        password,
    });
}

/**
 * Refresh an OAuth access token.
 *
 * @param refreshToken current refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<V2Token> {
    return postForm(V2_TOKEN_URL, {
        client_id: V2_CLIENT_ID,
        client_secret: V2_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
}

/** GraphQL query or mutation payload. */
export interface GraphQlRequest {
    /** GraphQL document. */
    query: string;
    /** GraphQL variables. */
    variables?: Record<string, unknown>;
}

/**
 * POST a GraphQL operation to the Hydrawise v2 endpoint.
 *
 * @param token OAuth token
 * @param request query and optional variables
 */
export async function graphqlRequest(token: V2Token, request: GraphQlRequest): Promise<any> {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), V2_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(V2_GRAPH_URL, {
            method: 'POST',
            signal: abort.signal,
            headers: {
                Authorization: `${token.tokenType} ${token.accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                query: request.query,
                variables: request.variables || {},
            }),
        });

        const text = await response.text();
        let json: any = null;
        if (text) {
            try {
                json = JSON.parse(text);
            } catch {
                json = text;
            }
        }

        if (!response.ok) {
            throw new HydrawiseV2Error(
                `HTTP ${response.status}`,
                response.status,
                json,
                parseRetryAfter(response.headers.get('Retry-After')),
            );
        }

        if (json?.errors?.length) {
            const message = json.errors.map((e: { message?: string }) => e.message || 'GraphQL error').join('; ');
            throw new HydrawiseV2Error(message, 'graphql', json);
        }

        return json?.data;
    } catch (error: any) {
        if (error instanceof HydrawiseV2Error) {
            throw error;
        }
        if (error?.name === 'AbortError') {
            throw new HydrawiseV2Error('request timed out', 'ECONNABORTED');
        }
        throw new HydrawiseV2Error(error?.message || String(error), error?.code || 'ENOTFOUND');
    } finally {
        clearTimeout(timeout);
    }
}
