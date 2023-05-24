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
let nextpollSchedule = null;
let nextpollCustomer = null;
const RELAYS = Object;
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
    await this.subscribeStatesAsync("*");
  }
  async GetStatusSchedule(apiKey) {
    return new Promise((resolve, reject) => {
      nextpollSchedule = nextpollSchedule || this.setTimeout(() => {
        nextpollSchedule = null;
        this.GetStatusSchedule(apiKey);
      }, 6e4);
      this.buildRequest("statusschedule.php", { api_key: this.config.apiKey }).then(async (response) => {
        if (response.status === 200) {
          const content = response.data;
          this.setStateChangedAsync("info.connection", true, true);
          await this.setObjectNotExistsAsync("schedule.stopall", {
            type: "state",
            common: {
              name: "stopall",
              type: "boolean",
              role: "button",
              read: false,
              write: true
            },
            native: {}
          });
          await this.setObjectNotExistsAsync("schedule.runall", {
            type: "state",
            common: {
              name: "runall for x seconds",
              type: "number",
              role: "value",
              read: false,
              write: true
            },
            native: {}
          });
          await this.setObjectNotExistsAsync("schedule.suspendall", {
            type: "state",
            common: {
              name: "suspendall for x seconds",
              type: "number",
              role: "value",
              read: false,
              write: true
            },
            native: {}
          });
          for (const key in content) {
            if (key !== "relays" && key !== "sensors" && key !== "expanders") {
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
            RELAYS[relay.name] = relay.relay_id;
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
            await this.setObjectNotExistsAsync(`schedule.${relay.name}.stopZone`, {
              type: "state",
              common: {
                name: "stop zone",
                type: "boolean",
                role: "button",
                read: false,
                write: true
              },
              native: {}
            });
            await this.setObjectNotExistsAsync(`schedule.${relay.name}.runZone`, {
              type: "state",
              common: {
                name: "run zone for x seconds",
                type: "number",
                role: "value",
                read: false,
                write: true
              },
              native: {}
            });
            await this.setObjectNotExistsAsync(`schedule.${relay.name}.suspendZone`, {
              type: "state",
              common: {
                name: "suspend zone for x seconds",
                type: "number",
                role: "value",
                read: false,
                write: true
              },
              native: {}
            });
          }
          for (const sensor of content.sensors) {
            await this.setObjectNotExistsAsync(`schedule.sensors.${sensor.input}`, {
              type: "channel",
              common: {
                name: "sensors"
              },
              native: {}
            });
            for (const key in sensor) {
              if (key !== "relays") {
                await this.setObjectNotExistsAsync(`schedule.sensors.${sensor.input}.${key}`, {
                  type: "state",
                  common: {
                    name: key,
                    type: "number",
                    role: "value",
                    read: true,
                    write: false
                  },
                  native: {}
                });
                this.setStateChangedAsync(
                  `schedule.sensors.${sensor.input}.${key}`,
                  sensor[key],
                  true
                );
              }
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
    return new Promise((resolve, reject) => {
      nextpollCustomer = nextpollCustomer || this.setTimeout(() => {
        nextpollCustomer = null;
        this.GetCustomerDetails(apiKey);
      }, 60 * 5e3);
      this.buildRequest("customerdetails.php", { api_key: this.config.apiKey }).then(async (response) => {
        if (response.status === 200) {
          const content = response.data;
          this.setStateChangedAsync("info.connection", true, true);
          for (const key in content) {
            if (key !== "controllers") {
              await this.setObjectNotExistsAsync(`customer.${key}`, {
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
              this.setStateChangedAsync(`customer.${key}`, content[key], true);
            }
          }
          for (const controller of content.controllers) {
            await this.setObjectNotExistsAsync(`customer.controllers.${controller.name}`, {
              type: "channel",
              common: {
                name: controller.name
              },
              native: {}
            });
            for (const key in controller) {
              await this.setObjectNotExistsAsync(`customer.controllers.${controller.name}.${key}`, {
                type: "state",
                common: {
                  name: key,
                  type: key !== "controller_id" ? "string" : "number",
                  role: key !== "controller_id" ? "text" : "value",
                  read: true,
                  write: false
                },
                native: {}
              });
              this.setStateChangedAsync(
                `customer.controllers.${controller.name}.${key}`,
                controller[key],
                true
              );
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
  buildRequest(service, params) {
    return new Promise((resolve, reject) => {
      const url = `/api/v1/${service}`;
      let lastErrorCode = 0;
      if (params.api_key) {
        this.log.debug(`sending GET request to "${url}" with params: ${JSON.stringify(params)}`);
        (0, import_axios.default)({
          method: "GET",
          baseURL: hydrawise_url,
          url,
          timeout: 3e3,
          responseType: "json",
          params
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
  onUnload(callback) {
    try {
      clearTimeout(nextpollSchedule);
      clearTimeout(nextpollCustomer);
      callback();
    } catch (e) {
      callback();
    }
  }
  onStateChange(id, state) {
    if (state) {
      console.log("state", state);
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
      if (id.indexOf("stopall") !== -1) {
        this.buildRequest("setzone.php", { api_key: this.config.apiKey, action: "stopall" });
      } else if (id.indexOf("stop") !== -1) {
        const relay = id.match(/.*schedule\.(.*)\.stopZone/);
        if (relay && (relay == null ? void 0 : relay.length) > 1) {
          this.buildRequest("setzone.php", {
            api_key: this.config.apiKey,
            action: "stop",
            relay_id: RELAYS[relay[1]]
          });
        }
      }
      if (id.indexOf("runall") !== -1 && (state.val || state.val === 0)) {
        this.buildRequest("setzone.php", {
          api_key: this.config.apiKey,
          action: "runall",
          period_id: 999,
          custom: state.val
        });
      } else if (id.indexOf("run") !== -1 && (state.val || state.val === 0)) {
        const relay = id.match(/.*schedule\.(.*)\.runZone/);
        if (relay && (relay == null ? void 0 : relay.length) > 1) {
          this.buildRequest("setzone.php", {
            api_key: this.config.apiKey,
            action: "run",
            period_id: 999,
            custom: state.val,
            relay_id: RELAYS[relay[1]]
          });
        }
      }
      if (id.indexOf("suspendall") !== -1 && (state.val || state.val === 0)) {
        const num = state.val;
        this.buildRequest("setzone.php", {
          api_key: this.config.apiKey,
          action: "suspendall",
          period_id: 999,
          custom: Math.trunc((state.ts + num) / 1e3)
        });
      } else if (id.indexOf("suspend") !== -1 && (state.val || state.val === 0)) {
        const num = state.val;
        const relay = id.match(/.*schedule\.(.*)\.suspendZone/);
        if (relay && (relay == null ? void 0 : relay.length) > 1) {
          this.buildRequest("setzone.php", {
            api_key: this.config.apiKey,
            action: "suspend",
            period_id: 999,
            custom: Math.trunc((state.ts + num) / 1e3),
            relay_id: RELAYS[relay[1]]
          });
        }
      }
    } else {
      this.log.info(`state ${id} deleted`);
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Hydrawise(options);
} else {
  (() => new Hydrawise())();
}
//# sourceMappingURL=main.js.map
