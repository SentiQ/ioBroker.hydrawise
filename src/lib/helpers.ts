export const HYDRAWISE_BASE_URL = 'https://api.hydrawise.com';

export const SCHEDULE_SKIP_KEYS = ['relays', 'sensors', 'expanders'] as const;
export const CUSTOMER_SKIP_KEYS = ['controllers'] as const;

export const CUSTOMER_INTERVAL_MS = 5 * 60 * 1000;
export const CUSTOMER_STAGGER_MS = 30_000;
export const BACKOFF_CAP_MS = 30 * 60 * 1000;
export const RATE_LIMIT_MESSAGE = /exceeded maximum number of requests/i;

/**
 * Replace characters forbidden in ioBroker object IDs.
 *
 * @param name raw name from API
 * @param forbiddenChars adapter FORBIDDEN_CHARS regex
 */
export function name2id(name: string, forbiddenChars: RegExp): string {
    return (name || '').replace(forbiddenChars, '_');
}

/**
 * True when the key is a scalar field (not a nested array/object list).
 *
 * @param key API response key
 * @param skipKeys keys to skip (arrays/objects)
 */
export function isScalarKey(key: string, skipKeys: readonly string[]): boolean {
    return !skipKeys.includes(key);
}

/**
 * Build a full Hydrawise API URL with query parameters.
 *
 * @param service endpoint file name (e.g. statusschedule.php)
 * @param params query parameters
 */
export function buildHydrawiseUrl(service: string, params: Record<string, string | number | boolean>): string {
    const url = new URL(`/api/v1/${service}`, HYDRAWISE_BASE_URL);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

/**
 * Stable signature of schedule/customer structure for object-sync decisions.
 *
 * @param relayIds relay numbers from status API
 * @param sensorInputs sensor input numbers
 * @param controllerNames controller names from customer API
 */
export function structureSignature(
    relayIds: Array<string | number>,
    sensorInputs: Array<string | number>,
    controllerNames: string[] = [],
): string {
    return JSON.stringify({
        relays: [...relayIds].map(String).sort(),
        sensors: [...sensorInputs].map(String).sort(),
        controllers: [...controllerNames].map(String).sort(),
    });
}

/**
 * Parse a Retry-After header (delta-seconds or HTTP date) to seconds.
 *
 * @param header Retry-After header value
 */
export function parseRetryAfter(header: string | null | undefined): number | undefined {
    if (!header) {
        return undefined;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds;
    }
    const date = Date.parse(header);
    if (!Number.isNaN(date)) {
        return Math.max(0, (date - Date.now()) / 1000);
    }
    return undefined;
}

/**
 * True when HTTP status or body indicates a Hydrawise rate limit.
 *
 * @param status HTTP status code
 * @param body response body (string or parsed JSON)
 */
export function isRateLimited(status?: number, body?: unknown): boolean {
    if (status === 429) {
        return true;
    }
    if (typeof body === 'string') {
        return RATE_LIMIT_MESSAGE.test(body);
    }
    if (body && typeof body === 'object') {
        return RATE_LIMIT_MESSAGE.test(JSON.stringify(body));
    }
    return false;
}

/**
 * True when a thrown error is a Hydrawise rate-limit response.
 *
 * @param error caught error
 */
export function isRateLimitError(error: unknown): boolean {
    const err = error as {
        code?: number | string;
        data?: unknown;
        response?: { status?: number; data?: unknown };
        message?: string;
    };
    const status = typeof err?.code === 'number' ? err.code : err?.response?.status;
    const data = err?.response?.data ?? err?.data ?? err?.message;
    return isRateLimited(status, data);
}

/**
 * Retry-After seconds attached to a thrown HTTP error, if any.
 *
 * @param error caught error
 */
export function getRetryAfterSec(error: unknown): number | undefined {
    const retryAfter = (error as { retryAfter?: number })?.retryAfter;
    return typeof retryAfter === 'number' && Number.isFinite(retryAfter) ? retryAfter : undefined;
}

/**
 * Exponential backoff after a rate limit: max(300s, Retry-After) * 2^(failCount-1), ±10% jitter, cap 30 min.
 *
 * @param failCount consecutive rate-limit failures (1-based)
 * @param retryAfterSec optional Retry-After from the response
 * @param random RNG in [0, 1) — inject for tests
 */
export function nextBackoffMs(failCount: number, retryAfterSec?: number, random: () => number = Math.random): number {
    const n = Math.max(1, failCount);
    const base = Math.max(CUSTOMER_INTERVAL_MS, (retryAfterSec ?? 0) * 1000);
    const capped = Math.min(base * 2 ** (n - 1), BACKOFF_CAP_MS);
    const jitter = 1 + (random() * 0.2 - 0.1);
    return Math.round(capped * jitter);
}
