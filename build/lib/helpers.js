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
var helpers_exports = {};
__export(helpers_exports, {
  BACKOFF_CAP_MS: () => BACKOFF_CAP_MS,
  CUSTOMER_INTERVAL_MS: () => CUSTOMER_INTERVAL_MS,
  CUSTOMER_SKIP_KEYS: () => CUSTOMER_SKIP_KEYS,
  CUSTOMER_STAGGER_MS: () => CUSTOMER_STAGGER_MS,
  HYDRAWISE_BASE_URL: () => HYDRAWISE_BASE_URL,
  RATE_LIMIT_MESSAGE: () => RATE_LIMIT_MESSAGE,
  SCHEDULE_SKIP_KEYS: () => SCHEDULE_SKIP_KEYS,
  buildHydrawiseUrl: () => buildHydrawiseUrl,
  getRetryAfterSec: () => getRetryAfterSec,
  isRateLimitError: () => isRateLimitError,
  isRateLimited: () => isRateLimited,
  isScalarKey: () => isScalarKey,
  name2id: () => name2id,
  nextBackoffMs: () => nextBackoffMs,
  parseRetryAfter: () => parseRetryAfter,
  structureSignature: () => structureSignature
});
module.exports = __toCommonJS(helpers_exports);
const HYDRAWISE_BASE_URL = "https://api.hydrawise.com";
const SCHEDULE_SKIP_KEYS = ["relays", "sensors", "expanders"];
const CUSTOMER_SKIP_KEYS = ["controllers"];
const CUSTOMER_INTERVAL_MS = 5 * 60 * 1e3;
const CUSTOMER_STAGGER_MS = 3e4;
const BACKOFF_CAP_MS = 30 * 60 * 1e3;
const RATE_LIMIT_MESSAGE = /exceeded maximum number of requests/i;
function name2id(name, forbiddenChars) {
  return (name || "").replace(forbiddenChars, "_");
}
function isScalarKey(key, skipKeys) {
  return !skipKeys.includes(key);
}
function buildHydrawiseUrl(service, params) {
  const url = new URL(`/api/v1/${service}`, HYDRAWISE_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
function structureSignature(relayIds, sensorInputs, controllerNames = []) {
  return JSON.stringify({
    relays: [...relayIds].map(String).sort(),
    sensors: [...sensorInputs].map(String).sort(),
    controllers: [...controllerNames].map(String).sort()
  });
}
function parseRetryAfter(header) {
  if (!header) {
    return void 0;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, (date - Date.now()) / 1e3);
  }
  return void 0;
}
function isRateLimited(status, body) {
  if (status === 429) {
    return true;
  }
  if (typeof body === "string") {
    return RATE_LIMIT_MESSAGE.test(body);
  }
  if (body && typeof body === "object") {
    return RATE_LIMIT_MESSAGE.test(JSON.stringify(body));
  }
  return false;
}
function isRateLimitError(error) {
  var _a, _b, _c, _d;
  const err = error;
  const status = typeof (err == null ? void 0 : err.code) === "number" ? err.code : (_a = err == null ? void 0 : err.response) == null ? void 0 : _a.status;
  const data = (_d = (_c = (_b = err == null ? void 0 : err.response) == null ? void 0 : _b.data) != null ? _c : err == null ? void 0 : err.data) != null ? _d : err == null ? void 0 : err.message;
  return isRateLimited(status, data);
}
function getRetryAfterSec(error) {
  const retryAfter = error == null ? void 0 : error.retryAfter;
  return typeof retryAfter === "number" && Number.isFinite(retryAfter) ? retryAfter : void 0;
}
function nextBackoffMs(failCount, retryAfterSec, random = Math.random) {
  const n = Math.max(1, failCount);
  const base = Math.max(CUSTOMER_INTERVAL_MS, (retryAfterSec != null ? retryAfterSec : 0) * 1e3);
  const capped = Math.min(base * 2 ** (n - 1), BACKOFF_CAP_MS);
  const jitter = 1 + (random() * 0.2 - 0.1);
  return Math.round(capped * jitter);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BACKOFF_CAP_MS,
  CUSTOMER_INTERVAL_MS,
  CUSTOMER_SKIP_KEYS,
  CUSTOMER_STAGGER_MS,
  HYDRAWISE_BASE_URL,
  RATE_LIMIT_MESSAGE,
  SCHEDULE_SKIP_KEYS,
  buildHydrawiseUrl,
  getRetryAfterSec,
  isRateLimitError,
  isRateLimited,
  isScalarKey,
  name2id,
  nextBackoffMs,
  parseRetryAfter,
  structureSignature
});
//# sourceMappingURL=helpers.js.map
