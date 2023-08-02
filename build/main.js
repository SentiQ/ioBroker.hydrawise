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
      this.setStateChangedAsync("info.connection", false, true);
      await this.GetStatusSchedule(this.config.apiKey);
      await this.GetCustomerDetails(this.config.apiKey);
      await this.subscribeStatesAsync("*");
    }
  }
  async GetStatusSchedule(apiKey) {
    return new Promise((resolve, reject) => {
      nextpollSchedule = nextpollSchedule || this.setTimeout(
        () => {
          nextpollSchedule = null;
          this.GetStatusSchedule(apiKey);
        },
        5 * 60 * 1e3
      );
      this.buildRequest("statusschedule.php", { api_key: this.config.apiKey }).then(async (response) => {
        if (response.status === 200) {
          const content = response.data;
          this.setStateChangedAsync("info.connection", true, true);
          await this.setObjectNotExistsAsync("schedule.stopall", {
            type: "state",
            common: {
              name: {
                en: "stop all zones",
                de: "alle Zonen stoppen",
                ru: "\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0432\u0441\u0435 \u0437\u043E\u043D\u044B",
                pt: "parar todas as zonas",
                nl: "stop alle zones",
                fr: "arr\xEAter toutes les zones",
                it: "fermare tutte le zone",
                es: "detener todas las zonas",
                pl: "zatrzymuj\u0105 wszystkie strefy",
                uk: "\u0437\u0443\u043F\u0438\u043D\u0438\u0442\u0438 \u0432\u0441\u0456 \u0437\u043E\u043D\u0438",
                "zh-cn": "\u505C\u6B62\u6240\u6709\u5730\u533A"
              },
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
              name: {
                en: "run all zones for x seconds",
                de: "alle Zonen f\xFCr x Sekunden ausf\xFChren",
                ru: "\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0432\u0441\u0435 \u0437\u043E\u043D\u044B \u0437\u0430 x \u0441\u0435\u043A\u0443\u043D\u0434\u044B",
                pt: "executar todas as zonas por x segundos",
                nl: "ren alle zones voor x seconden",
                fr: "ex\xE9cuter toutes les zones pendant x secondes",
                it: "eseguire tutte le zone per x secondi",
                es: "ejecutar todas las zonas durante x segundos",
                pl: "wszystkie strefy startuj\u0105 dla x sekundy",
                uk: "\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0432\u0441\u0456 \u0437\u043E\u043D\u0438 \u0434\u043B\u044F x \u0441\u0435\u043A\u0443\u043D\u0434",
                "zh-cn": "\u8DD1\u9053\u533A"
              },
              type: "number",
              role: "value",
              unit: "seconds",
              read: false,
              write: true
            },
            native: {}
          });
          await this.setObjectNotExistsAsync("schedule.suspendall", {
            type: "state",
            common: {
              name: {
                en: "suspend all zones for x seconds",
                de: "alle Zonen f\xFCr x Sekunden aussetzen",
                ru: "\u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0432\u0441\u0435 \u0437\u043E\u043D\u044B \u0437\u0430 x \u0441\u0435\u043A\u0443\u043D\u0434\u044B",
                pt: "suspender todas as zonas por x segundos",
                nl: "vertaling:",
                fr: "suspendre toutes les zones pendant x secondes",
                it: "sospendere tutte le zone per x secondi",
                es: "suspender todas las zonas durante x segundos",
                pl: "wszystkie strefy zawieszenia dla x sekundy",
                uk: "\u043F\u0440\u0438\u0437\u0443\u043F\u0438\u043D\u0438\u0442\u0438 \u0432\u0441\u0456 \u0437\u043E\u043D\u0438 \u043D\u0430 x \u0441\u0435\u043A\u0443\u043D\u0434",
                "zh-cn": "\u505C\u6B62\u6240\u6709\xD7\u4E8C\u533A"
              },
              type: "number",
              role: "value",
              read: false,
              write: true
            },
            native: {}
          });
          for (let key in content) {
            key = this.name2id(key);
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
            const name = relay.relay;
            await this.setObjectNotExistsAsync(`schedule.${relay.relay}`, {
              type: "channel",
              common: {
                name: name.toString()
              },
              native: {}
            });
            RELAYS[relay.relay] = relay.relay_id;
            for (let key in relay) {
              key = this.name2id(key);
              await this.setObjectNotExistsAsync(`schedule.${relay.relay}.${key}`, {
                type: "state",
                common: {
                  name: key,
                  type: key === "name" || key === "timestr" ? "string" : "number",
                  role: key === "name" || key === "timestr" ? "text" : "value",
                  read: true,
                  write: false
                },
                native: {}
              });
              if (key === "timestr") {
                const t = new Date();
                t.setSeconds(t.getSeconds() + relay.time);
                relay[key] = t.toString();
              }
              this.setStateChangedAsync(`schedule.${relay.relay}.${key}`, relay[key], true);
            }
            await this.setObjectNotExistsAsync(`schedule.${relay.relay}.stopZone`, {
              type: "state",
              common: {
                name: {
                  en: "stop zone",
                  de: "Zone stoppen",
                  ru: "\u0437\u043E\u043D\u0430 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",
                  pt: "zona de paragem",
                  nl: "stop zone",
                  fr: "zone d ' arr\xEAt",
                  it: "zona di sosta",
                  es: "zona de parada",
                  pl: "strefa stopu",
                  uk: "\u0437\u043E\u043D\u0430 \u0437\u0443\u043F\u0438\u043D\u043A\u0438",
                  "zh-cn": "\u505C\u6B62\u5730\u533A"
                },
                type: "boolean",
                role: "button",
                read: false,
                write: true
              },
              native: {}
            });
            await this.setObjectNotExistsAsync(`schedule.${relay.relay}.runZone`, {
              type: "state",
              common: {
                name: {
                  en: "run zone for x seconds",
                  de: "Zone f\xFCr x Sekunden starten",
                  ru: "\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0437\u043E\u043D\u0443 \u0437\u0430 x \u0441\u0435\u043A\u0443\u043D\u0434\u044B",
                  pt: "zona de execu\xE7\xE3o por x segundos",
                  nl: "ren zone voor x seconden",
                  fr: "zone de course pour x secondes",
                  it: "zona di corsa per x secondi",
                  es: "zona de ejecuci\xF3n por x segundos",
                  pl: "strefa x sekundy",
                  uk: "\u0437\u043E\u043D\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0443 \u0434\u043B\u044F x \u0441\u0435\u043A\u0443\u043D\u0434",
                  "zh-cn": "\xD7\u4E8C\u533A"
                },
                type: "number",
                role: "value",
                read: false,
                write: true
              },
              native: {}
            });
            await this.setObjectNotExistsAsync(`schedule.${relay.relay}.suspendZone`, {
              type: "state",
              common: {
                name: {
                  en: "suspend zone for x seconds",
                  de: "Zone f\xFCr x Sekunden aussetzen",
                  ru: "\u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u043E\u043D\u0443 \u043D\u0430 x \u0441\u0435\u043A\u0443\u043D\u0434\u044B",
                  pt: "zona de suspens\xE3o por x segundos",
                  nl: "quality over quantity (qoq) releases vertaling:",
                  fr: "zone de suspension pour x secondes",
                  it: "zona di sospensione per x secondi",
                  es: "zona de suspensi\xF3n por x segundos",
                  pl: "strefa zawies\u0142a na x sekundy",
                  uk: "\u0437\u043E\u043D\u0430 \u043F\u0456\u0434\u0432\u0456\u0441\u043A\u0438 \u0434\u043B\u044F x \u0441\u0435\u043A\u0443\u043D\u0434",
                  "zh-cn": "\u505C\u6B62x\u4E8C\u533A"
                },
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
            for (let key in sensor) {
              if (key !== "relays") {
                key = this.name2id(key);
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
          resolve(response.status);
        }
      }).catch((error) => {
        if (error.response.status === 429) {
          nextpollSchedule = nextpollSchedule || this.setTimeout(
            () => {
              nextpollSchedule = null;
              this.GetStatusSchedule(apiKey);
            },
            5 * 60 * 1e3
          );
        } else {
          this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);
          this.setStateChangedAsync("info.connection", false, true);
          reject(error);
        }
      });
    });
  }
  async GetCustomerDetails(apiKey) {
    return new Promise((resolve, reject) => {
      nextpollCustomer = nextpollCustomer || this.setTimeout(
        () => {
          nextpollCustomer = null;
          this.GetCustomerDetails(apiKey);
        },
        5 * 60 * 1e3
      );
      this.buildRequest("customerdetails.php", { api_key: this.config.apiKey }).then(async (response) => {
        if (response.status === 200) {
          const content = response.data;
          this.setStateChangedAsync("info.connection", true, true);
          for (let key in content) {
            if (key !== "controllers") {
              key = this.name2id(key);
              await this.setObjectNotExistsAsync(`customer.${key}`, {
                type: "state",
                common: {
                  name: key,
                  type: key === "message" || key === "current_controller" ? "string" : "number",
                  role: key === "message" || key === "current_controller" ? "text" : "value",
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
            for (let key in controller) {
              key = this.name2id(key);
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
              if (key === "last_contact") {
                const t = new Date(controller[key] * 1e3);
                controller[key] = t.toString();
              }
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
        if (error.response.status === 429) {
          nextpollCustomer = nextpollCustomer || this.setTimeout(
            () => {
              nextpollCustomer = null;
              this.GetCustomerDetails(apiKey);
            },
            5 * 60 * 1e3
          );
        } else {
          this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);
          this.setStateChangedAsync("info.connection", false, true);
          reject(error);
        }
      });
    });
  }
  buildRequest(service, params) {
    return new Promise((resolve, reject) => {
      const url = `/api/v1/${service}`;
      let lastErrorCode = 0;
      if (params.api_key) {
        (0, import_axios.default)({
          method: "GET",
          baseURL: hydrawise_url,
          url,
          timeout: 3e4,
          responseType: "json",
          params
        }).then((response) => {
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
  name2id(pName) {
    return (pName || "").replace(this.FORBIDDEN_CHARS, "_");
  }
}
if (require.main !== module) {
  module.exports = (options) => new Hydrawise(options);
} else {
  (() => new Hydrawise())();
}
//# sourceMappingURL=main.js.map
