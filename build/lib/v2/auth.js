"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var auth_exports = {};
__export(auth_exports, {
  HydrawiseV2Error: () => HydrawiseV2Error,
  V2_CLIENT_ID: () => V2_CLIENT_ID,
  V2_CLIENT_SECRET: () => V2_CLIENT_SECRET,
  V2_GRAPH_URL: () => V2_GRAPH_URL,
  V2_REQUEST_TIMEOUT_MS: () => V2_REQUEST_TIMEOUT_MS,
  V2_TOKEN_SKEW_MS: () => V2_TOKEN_SKEW_MS,
  V2_TOKEN_URL: () => V2_TOKEN_URL,
  fetchAccessToken: () => fetchAccessToken,
  graphqlRequest: () => graphqlRequest,
  refreshAccessToken: () => refreshAccessToken,
  tokenNeedsRefresh: () => tokenNeedsRefresh
});
module.exports = __toCommonJS(auth_exports);
var import_helpers = require("../helpers");
const V2_TOKEN_URL = "https://app.hydrawise.com/api/v2/oauth/access-token";
const V2_GRAPH_URL = "https://app.hydrawise.com/api/v2/graph";
const V2_CLIENT_ID = "hydrawise_app";
const V2_CLIENT_SECRET = "zn3CrjglwNV1";
const V2_TOKEN_SKEW_MS = 5 * 60 * 1e3;
const V2_REQUEST_TIMEOUT_MS = 3e4;
class HydrawiseV2Error extends Error {
  code;
  data;
  retryAfter;
  /**
   * @param message human-readable error
   * @param code HTTP status or error code
   * @param data response body
   * @param retryAfter Retry-After in seconds
   */
  constructor(message, code, data, retryAfter) {
    super(message);
    this.name = "HydrawiseV2Error";
    this.code = code;
    this.data = data;
    this.retryAfter = retryAfter;
  }
}
function tokenNeedsRefresh(token, nowMs = Date.now()) {
  if (!token) {
    return true;
  }
  return token.expiresAt - nowMs < V2_TOKEN_SKEW_MS;
}
function parseTokenResponse(json) {
  if (json.error) {
    throw new HydrawiseV2Error(String(json.message || json.error), "unauthorized", json);
  }
  if (!json.access_token || !json.token_type) {
    throw new HydrawiseV2Error("Invalid token response", "unauthorized", json);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || "",
    tokenType: json.token_type,
    expiresAt: Date.now() + Number(json.expires_in || 3600) * 1e3
  };
}
async function postForm(url, params) {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), V2_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: abort.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(params)
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok && !json.error) {
      throw new HydrawiseV2Error(
        `HTTP ${response.status}`,
        response.status,
        json,
        (0, import_helpers.parseRetryAfter)(response.headers.get("Retry-After"))
      );
    }
    return parseTokenResponse(json);
  } catch (error) {
    if (error instanceof HydrawiseV2Error) {
      throw error;
    }
    if ((error == null ? void 0 : error.name) === "AbortError") {
      throw new HydrawiseV2Error("request timed out", "ECONNABORTED");
    }
    throw new HydrawiseV2Error((error == null ? void 0 : error.message) || String(error), (error == null ? void 0 : error.code) || "ENOTFOUND");
  } finally {
    clearTimeout(timeout);
  }
}
async function fetchAccessToken(username, password) {
  return postForm(V2_TOKEN_URL, {
    client_id: V2_CLIENT_ID,
    client_secret: V2_CLIENT_SECRET,
    grant_type: "password",
    scope: "all",
    username,
    password
  });
}
async function refreshAccessToken(refreshToken) {
  return postForm(V2_TOKEN_URL, {
    client_id: V2_CLIENT_ID,
    client_secret: V2_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
}
async function graphqlRequest(token, request) {
  var _a;
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), V2_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(V2_GRAPH_URL, {
      method: "POST",
      signal: abort.signal,
      headers: {
        Authorization: `${token.tokenType} ${token.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        query: request.query,
        variables: request.variables || {}
      })
    });
    const text = await response.text();
    let json = null;
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
        (0, import_helpers.parseRetryAfter)(response.headers.get("Retry-After"))
      );
    }
    if ((_a = json == null ? void 0 : json.errors) == null ? void 0 : _a.length) {
      const message = json.errors.map((e) => e.message || "GraphQL error").join("; ");
      throw new HydrawiseV2Error(message, "graphql", json);
    }
    return json == null ? void 0 : json.data;
  } catch (error) {
    if (error instanceof HydrawiseV2Error) {
      throw error;
    }
    if ((error == null ? void 0 : error.name) === "AbortError") {
      throw new HydrawiseV2Error("request timed out", "ECONNABORTED");
    }
    throw new HydrawiseV2Error((error == null ? void 0 : error.message) || String(error), (error == null ? void 0 : error.code) || "ENOTFOUND");
  } finally {
    clearTimeout(timeout);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HydrawiseV2Error,
  V2_CLIENT_ID,
  V2_CLIENT_SECRET,
  V2_GRAPH_URL,
  V2_REQUEST_TIMEOUT_MS,
  V2_TOKEN_SKEW_MS,
  V2_TOKEN_URL,
  fetchAccessToken,
  graphqlRequest,
  refreshAccessToken,
  tokenNeedsRefresh
});
//# sourceMappingURL=auth.js.map
