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
  CUSTOMER_SKIP_KEYS: () => CUSTOMER_SKIP_KEYS,
  HYDRAWISE_BASE_URL: () => HYDRAWISE_BASE_URL,
  SCHEDULE_SKIP_KEYS: () => SCHEDULE_SKIP_KEYS,
  buildHydrawiseUrl: () => buildHydrawiseUrl,
  isScalarKey: () => isScalarKey,
  name2id: () => name2id,
  structureSignature: () => structureSignature
});
module.exports = __toCommonJS(helpers_exports);
const HYDRAWISE_BASE_URL = "https://api.hydrawise.com";
const SCHEDULE_SKIP_KEYS = ["relays", "sensors", "expanders"];
const CUSTOMER_SKIP_KEYS = ["controllers"];
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CUSTOMER_SKIP_KEYS,
  HYDRAWISE_BASE_URL,
  SCHEDULE_SKIP_KEYS,
  buildHydrawiseUrl,
  isScalarKey,
  name2id,
  structureSignature
});
//# sourceMappingURL=helpers.js.map
