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
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_helpers = require("./lib/helpers");
class Hydrawise extends utils.Adapter {
  pollScheduleTimer;
  pollCustomerTimer;
  resetSwitchTimer;
  relays = {};
  lastErrorCode = 0;
  schedulePollRunning = false;
  customerPollRunning = false;
  scheduleStructureKey = "";
  customerStructureKey = "";
  scheduleObjectsReady = false;
  customerObjectsReady = false;
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
      this.log.error("No API-Key defined!");
      return;
    }
    void this.setStateChangedAsync("info.connection", false, true);
    await this.GetStatusSchedule();
    this.pollScheduleTimer = this.setInterval(() => {
      void this.GetStatusSchedule();
    }, this.config.apiInterval * 1e3);
    await this.GetCustomerDetails();
    this.pollCustomerTimer = this.setInterval(
      () => {
        void this.GetCustomerDetails();
      },
      5 * 60 * 1e3
    );
    await this.subscribeStatesAsync("schedule.stopall");
    await this.subscribeStatesAsync("schedule.runall");
    await this.subscribeStatesAsync("schedule.suspendall");
    await this.subscribeStatesAsync("schedule.*.stopZone");
    await this.subscribeStatesAsync("schedule.*.runZone");
    await this.subscribeStatesAsync("schedule.*.suspendZone");
    await this.subscribeStatesAsync("schedule.*.runDefault");
  }
  async GetStatusSchedule() {
    if (this.schedulePollRunning) {
      this.log.debug("Skipping overlapping status schedule poll");
      return;
    }
    this.schedulePollRunning = true;
    try {
      const response = await this.buildRequest("statusschedule.php", { api_key: this.config.apiKey });
      if (response.status !== 200) {
        return;
      }
      const content = response.data;
      void this.setStateChangedAsync("info.connection", true, true);
      const relayIds = (content.relays || []).map((r) => r.relay);
      const sensorInputs = (content.sensors || []).map((s) => s.input);
      const nextStructureKey = (0, import_helpers.structureSignature)(relayIds, sensorInputs);
      const needObjects = !this.scheduleObjectsReady || this.scheduleStructureKey !== nextStructureKey;
      if (needObjects) {
        await this.ensureScheduleObjects(content);
        this.scheduleStructureKey = nextStructureKey;
        this.scheduleObjectsReady = true;
      }
      this.updateScheduleStates(content);
    } catch (error) {
      this.log.debug(`(schedule) received error - API is now offline: ${(error == null ? void 0 : error.message) || error}`);
      void this.setStateChangedAsync("info.connection", false, true);
    } finally {
      this.schedulePollRunning = false;
    }
  }
  async ensureScheduleObjects(content) {
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
        role: "button.stop",
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
        role: "level",
        unit: "seconds",
        read: true,
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
        role: "level",
        read: true,
        write: true
      },
      native: {}
    });
    for (const rawKey of Object.keys(content)) {
      const key = this.name2id(rawKey);
      if (!(0, import_helpers.isScalarKey)(key, import_helpers.SCHEDULE_SKIP_KEYS)) {
        continue;
      }
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
      if (key === "time") {
        await this.setObjectNotExistsAsync("schedule.timestr", {
          type: "state",
          common: {
            name: "last api call",
            type: "string",
            role: "text",
            read: true,
            write: false
          },
          native: {}
        });
      }
    }
    for (const relay of content.relays || []) {
      await this.setObjectNotExistsAsync(`schedule.${relay.relay}`, {
        type: "channel",
        common: {
          name: String(relay.relay)
        },
        native: {}
      });
      for (const rawKey of Object.keys(relay)) {
        const key = this.name2id(rawKey);
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
          role: "button.stop",
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
          role: "level",
          read: true,
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
          role: "level",
          read: true,
          write: true
        },
        native: {}
      });
      await this.setObjectNotExistsAsync(`schedule.${relay.relay}.runDefault`, {
        type: "state",
        common: {
          name: {
            en: "run zone for default time",
            de: "Zone mit Standardlaufzeit starten",
            ru: "\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0437\u043E\u043D\u0443 \u0434\u043B\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E",
            pt: "fuso de execu\xE7\xE3o para o tempo padr\xE3o",
            nl: "run zone for default time",
            fr: "run zone for default time",
            it: "run zone per il tempo predefinito",
            es: "zona de ejecuci\xF3n por tiempo predeterminado",
            pl: "strefa czasu domy\u015Blnego",
            uk: "\u0437\u043E\u043D\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0443 \u0437\u0430 \u0437\u0430\u043C\u043E\u0432\u0447\u0443\u0432\u0430\u043D\u043D\u044F\u043C",
            "zh-cn": "a. \u6682\u505C\u65F6\u95F4\u533A"
          },
          type: "boolean",
          role: "button.start",
          read: true,
          write: true
        },
        native: {}
      });
    }
    for (const sensor of content.sensors || []) {
      await this.setObjectNotExistsAsync(`schedule.sensors.${sensor.input}`, {
        type: "channel",
        common: {
          name: "sensors"
        },
        native: {}
      });
      for (const rawKey of Object.keys(sensor)) {
        if (rawKey === "relays") {
          continue;
        }
        const key = this.name2id(rawKey);
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
      }
    }
  }
  updateScheduleStates(content) {
    for (const rawKey of Object.keys(content)) {
      const key = this.name2id(rawKey);
      if (!(0, import_helpers.isScalarKey)(key, import_helpers.SCHEDULE_SKIP_KEYS)) {
        continue;
      }
      void this.setStateChangedAsync(`schedule.${key}`, content[rawKey], true);
      if (key === "time") {
        const t = new Date(content[rawKey] * 1e3);
        void this.setStateChangedAsync("schedule.timestr", t.toString(), true);
      }
    }
    for (const relay of content.relays || []) {
      this.relays[relay.relay] = relay.relay_id;
      for (const rawKey of Object.keys(relay)) {
        const key = this.name2id(rawKey);
        let value = relay[rawKey];
        if (key === "timestr") {
          const t = /* @__PURE__ */ new Date();
          t.setSeconds(t.getSeconds() + relay.time);
          value = t.toString();
        }
        void this.setStateChangedAsync(`schedule.${relay.relay}.${key}`, value, true);
      }
    }
    for (const sensor of content.sensors || []) {
      for (const rawKey of Object.keys(sensor)) {
        if (rawKey === "relays") {
          continue;
        }
        const key = this.name2id(rawKey);
        void this.setStateChangedAsync(`schedule.sensors.${sensor.input}.${key}`, sensor[rawKey], true);
      }
    }
  }
  async GetCustomerDetails() {
    if (this.customerPollRunning) {
      this.log.debug("Skipping overlapping customer details poll");
      return;
    }
    this.customerPollRunning = true;
    try {
      const response = await this.buildRequest("customerdetails.php", { api_key: this.config.apiKey });
      if (response.status !== 200) {
        return;
      }
      const content = response.data;
      void this.setStateChangedAsync("info.connection", true, true);
      const controllerNames = (content.controllers || []).map((c) => this.name2id(c.name));
      const nextStructureKey = (0, import_helpers.structureSignature)([], [], controllerNames);
      const needObjects = !this.customerObjectsReady || this.customerStructureKey !== nextStructureKey;
      if (needObjects) {
        await this.ensureCustomerObjects(content);
        this.customerStructureKey = nextStructureKey;
        this.customerObjectsReady = true;
      }
      this.updateCustomerStates(content);
    } catch (error) {
      this.log.debug(`(customer) received error - API is now offline: ${(error == null ? void 0 : error.message) || error}`);
      void this.setStateChangedAsync("info.connection", false, true);
    } finally {
      this.customerPollRunning = false;
    }
  }
  async ensureCustomerObjects(content) {
    for (const rawKey of Object.keys(content)) {
      if (!(0, import_helpers.isScalarKey)(rawKey, import_helpers.CUSTOMER_SKIP_KEYS)) {
        continue;
      }
      const key = this.name2id(rawKey);
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
    }
    for (const controller of content.controllers || []) {
      const controllerId = this.name2id(controller.name);
      await this.setObjectNotExistsAsync(`customer.controllers.${controllerId}`, {
        type: "channel",
        common: {
          name: controller.name
        },
        native: {}
      });
      for (const rawKey of Object.keys(controller)) {
        const key = this.name2id(rawKey);
        await this.setObjectNotExistsAsync(`customer.controllers.${controllerId}.${key}`, {
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
      }
    }
  }
  updateCustomerStates(content) {
    for (const rawKey of Object.keys(content)) {
      if (!(0, import_helpers.isScalarKey)(rawKey, import_helpers.CUSTOMER_SKIP_KEYS)) {
        continue;
      }
      const key = this.name2id(rawKey);
      void this.setStateChangedAsync(`customer.${key}`, content[rawKey], true);
    }
    for (const controller of content.controllers || []) {
      const controllerId = this.name2id(controller.name);
      for (const rawKey of Object.keys(controller)) {
        const key = this.name2id(rawKey);
        let value = controller[rawKey];
        if (key === "last_contact") {
          const t = new Date(controller[rawKey] * 1e3);
          value = t.toString();
        }
        void this.setStateChangedAsync(`customer.controllers.${controllerId}.${key}`, value, true);
      }
    }
  }
  /**
   * Perform a GET request against the Hydrawise API.
   *
   * @param service endpoint file name
   * @param params query parameters
   */
  async buildRequest(service, params) {
    var _a;
    if (!params.api_key) {
      throw new Error("API key is not configured");
    }
    const url = (0, import_helpers.buildHydrawiseUrl)(service, params);
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 3e4);
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: abort.signal,
        headers: { Accept: "application/json" }
      });
      this.lastErrorCode = 0;
      let data = null;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!response.ok) {
        this.log.warn(
          `received ${response.status} response from /api/v1/${service} with content: ${JSON.stringify(data)}`
        );
        throw Object.assign(new Error(`HTTP ${response.status}`), {
          code: response.status,
          response: { status: response.status, data }
        });
      }
      return { status: response.status, data };
    } catch (error) {
      if (error == null ? void 0 : error.response) {
      } else if ((error == null ? void 0 : error.name) === "AbortError") {
        const code = "ECONNABORTED";
        if (code === this.lastErrorCode) {
          this.log.debug(`timeout from ${import_helpers.HYDRAWISE_BASE_URL}/api/v1/${service}`);
        } else {
          this.log.info(`error ${code} from /api/v1/${service}: request timed out`);
          this.lastErrorCode = code;
        }
        throw Object.assign(new Error("request timed out"), { code });
      } else if (error == null ? void 0 : error.message) {
        const code = error.code || ((_a = error.cause) == null ? void 0 : _a.code) || "ENOTFOUND";
        if (code === this.lastErrorCode) {
          this.log.debug(error.message);
        } else {
          this.log.info(`error ${code} from /api/v1/${service}: ${error.message}`);
          this.lastErrorCode = code;
        }
      } else {
        this.log.error(String(error));
      }
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback callback function
   */
  onUnload(callback) {
    try {
      if (this.pollScheduleTimer) {
        this.clearInterval(this.pollScheduleTimer);
        this.pollScheduleTimer = void 0;
      }
      if (this.pollCustomerTimer) {
        this.clearInterval(this.pollCustomerTimer);
        this.pollCustomerTimer = void 0;
      }
      if (this.resetSwitchTimer) {
        this.clearTimeout(this.resetSwitchTimer);
        this.resetSwitchTimer = void 0;
      }
      callback();
    } catch {
      callback();
    }
  }
  /**
   * Is called if a subscribed state changes
   *
   * @param id id of the state
   * @param state state object
   */
  onStateChange(id, state) {
    if (state && !state.ack) {
      void this.handleStateChange(id, state);
    }
  }
  async handleStateChange(id, state) {
    try {
      let commandSent = false;
      if (id.includes("stopall")) {
        await this.buildRequest("setzone.php", { api_key: this.config.apiKey, action: "stopall" });
        commandSent = true;
      } else if (id.includes("stopZone")) {
        const relay = id.match(/.*schedule\.(.*)\.stopZone/);
        if (relay && relay.length > 1) {
          await this.buildRequest("setzone.php", {
            api_key: this.config.apiKey,
            action: "stop",
            relay_id: this.relays[relay[1]]
          });
          commandSent = true;
        }
      }
      if (id.includes("runall") && (state.val || state.val === 0)) {
        await this.buildRequest("setzone.php", {
          api_key: this.config.apiKey,
          action: "runall",
          period_id: 999,
          custom: state.val
        });
        commandSent = true;
      } else if (id.includes("runZone") && (state.val || state.val === 0)) {
        const relay = id.match(/.*schedule\.(.*)\.runZone/);
        if (relay && relay.length > 1) {
          await this.buildRequest("setzone.php", {
            api_key: this.config.apiKey,
            action: "run",
            period_id: 999,
            custom: state.val,
            relay_id: this.relays[relay[1]]
          });
          commandSent = true;
        }
      }
      if (id.includes("runDefault") && state.val !== null) {
        await this.initRunDefault(id, state.val);
        commandSent = true;
      }
      if (id.includes("suspendall") && (state.val || state.val === 0)) {
        const num = state.val;
        await this.buildRequest("setzone.php", {
          api_key: this.config.apiKey,
          action: "suspendall",
          period_id: 999,
          custom: Math.trunc((state.ts + num) / 1e3)
        });
        commandSent = true;
      } else if (id.includes("suspendZone") && (state.val || state.val === 0)) {
        const num = state.val;
        const relay = id.match(/.*schedule\.(.*)\.suspendZone/);
        if (relay && relay.length > 1) {
          await this.buildRequest("setzone.php", {
            api_key: this.config.apiKey,
            action: "suspend",
            period_id: 999,
            custom: Math.trunc((state.ts + num) / 1e3),
            relay_id: this.relays[relay[1]]
          });
          commandSent = true;
        }
      }
      if (commandSent && !id.includes("runDefault")) {
        await this.GetStatusSchedule();
      }
    } catch (error) {
      this.log.error(`Command failed for ${id}: ${(error == null ? void 0 : error.message) || error}`);
    }
  }
  async initRunDefault(id, run) {
    const relay = id.match(/(.*schedule.*\.)runDefault/);
    if (this.resetSwitchTimer) {
      this.clearTimeout(this.resetSwitchTimer);
      this.resetSwitchTimer = void 0;
    }
    if (relay) {
      if (run) {
        const defaultRunTime = await this.getStateAsync(`${relay[1]}run`);
        if (defaultRunTime && defaultRunTime.val) {
          void this.setState(`${relay[1]}runZone`, defaultRunTime.val, false);
          this.resetSwitchTimer = this.setTimeout(
            () => {
              void this.setState(id, false, true);
              this.resetSwitchTimer = void 0;
            },
            defaultRunTime.val * 1e3
          );
        }
      } else {
        void this.setState(`${relay[1]}stopZone`, true, false);
      }
    }
  }
  name2id(pName) {
    return (0, import_helpers.name2id)(pName, this.FORBIDDEN_CHARS);
  }
}
if (require.main !== module) {
  module.exports = (options) => new Hydrawise(options);
} else {
  (() => new Hydrawise())();
}
//# sourceMappingURL=main.js.map
