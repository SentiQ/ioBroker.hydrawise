"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
const hydrawise_url = "https://api.hydrawise.com";
let nextpoll = null;
class Hydrawise extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "hydrawise"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    if (!this.config.apiKey) {
      this.log.error("No API-Key definded!");
    } else {
      this.log.info("config apiKey: " + this.config.apiKey);
    }
    this.setStateChangedAsync("info.connection", false, true);
    await this.GetStatusSchedule(this.config.apiKey);
  }
  onUnload(callback) {
    try {
      callback();
    } catch (e) {
      callback();
    }
  }
  onStateChange(id, state) {
    if (state) {
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      this.log.info(`state ${id} deleted`);
    }
  }
  async GetStatusSchedule(apiKey) {
    return new Promise((resolve, reject) => {
      this.log.debug("refreshing device state");
      this.log.debug("re-creating refresh state timeout");
      nextpoll = nextpoll || this.setTimeout(() => {
        nextpoll = null;
        this.GetStatusSchedule(apiKey);
      }, 6e4);
      this.buildRequest("statusschedule.php", "GET").then(async (response) => {
        if (response.status === 200) {
          const content = response.data;
          this.setStateChangedAsync("info.connection", true, true);
          for (const key in content) {
            if (key !== "relays" && key !== "sensors") {
              await this.setObjectNotExistsAsync(`schedule.${key}`, {
                type: "state",
                common: {
                  name: key,
                  type: key === "message" ? "string" : "number",
                  role: key === "message" ? "text" : "value",
                  read: true,
                  write: false
                },
                native: {}
              });
              this.setStateChangedAsync(`schedule.${key}`, content[key], true);
            }
          }
          for (const relay of content.relays) {
            await this.setObjectNotExistsAsync(`schedule.${relay.name}`, {
              type: "channel",
              common: {
                name: relay.name
              },
              native: {}
            });
            for (const key in relay) {
              await this.setObjectNotExistsAsync(`schedule.${relay.name}.${key}`, {
                type: "state",
                common: {
                  name: key,
                  type: key === "name" ? "string" : "number",
                  role: key === "name" ? "text" : "value",
                  read: true,
                  write: false
                },
                native: {}
              });
              this.setStateChangedAsync(`schedule.${relay.name}.${key}`, relay[key], true);
            }
          }
        }
        resolve(response.status);
      }).catch((error) => {
        this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);
        this.setStateChangedAsync("info.connection", false, true);
        reject(error);
      });
    });
  }
  async GetCustomerDetails(apiKey) {
    const url = hydrawise_url + "customerdetails.php";
    try {
      const customerDetails = await import_axios.default.get(url, {
        headers: {
          Accept: "application/json"
        },
        params: {
          api_key: apiKey
        }
      });
      this.log.info("customerDetails: " + JSON.stringify(customerDetails.data, null, 4));
    } catch (error) {
      if (import_axios.default.isAxiosError(error)) {
        this.log.error("error message: " + error.message);
      } else {
        this.log.error("unexpected error: " + error);
      }
    }
  }
  buildRequest(service, method, data) {
    return new Promise((resolve, reject) => {
      const url = `/api/v1/${service}`;
      let lastErrorCode = 0;
      if (this.config.apiKey) {
        if (data) {
          this.log.debug(`sending "${method}" request to "${url}" with data: ${JSON.stringify(data)}`);
        } else {
          this.log.debug(`sending "${method}" request to "${url}" without data`);
        }
        (0, import_axios.default)({
          method,
          data,
          baseURL: hydrawise_url,
          url,
          timeout: 3e3,
          responseType: "json",
          params: {
            api_key: this.config.apiKey
          }
        }).then((response) => {
          this.log.debug(
            `received ${response.status} response from "${url}" with content: ${JSON.stringify(
              response.data
            )}`
          );
          lastErrorCode = 0;
          resolve(response);
        }).catch((error) => {
          if (error.response) {
            this.log.warn(
              `received ${error.response.status} response from ${url} with content: ${JSON.stringify(
                error.response.data
              )}`
            );
          } else if (error.request) {
            if (error.code === lastErrorCode) {
              this.log.debug(error.message);
            } else {
              this.log.info(`error ${error.code} from ${url}: ${error.message}`);
              lastErrorCode = error.code;
            }
          } else {
            this.log.error(error.message);
          }
          reject(error);
        });
      } else {
        reject("Device IP is not configured");
      }
    });
  }
}
if (require.main !== module) {
  module.exports = (options) => new Hydrawise(options);
} else {
  (() => new Hydrawise())();
}
//# sourceMappingURL=main.js.map
