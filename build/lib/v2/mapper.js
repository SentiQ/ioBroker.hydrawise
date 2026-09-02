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
var mapper_exports = {};
__export(mapper_exports, {
  computeWaterSummary: () => computeWaterSummary,
  mapAllZoneCommandObjects: () => mapAllZoneCommandObjects,
  mapControllerStates: () => mapControllerStates,
  mapSensorStates: () => mapSensorStates,
  mapWaterStates: () => mapWaterStates,
  mapWeatherStates: () => mapWeatherStates,
  mapZoneCommandObjects: () => mapZoneCommandObjects,
  mapZoneStates: () => mapZoneStates,
  pickController: () => pickController,
  v2StructureKey: () => v2StructureKey,
  zoneIdMap: () => zoneIdMap
});
module.exports = __toCommonJS(mapper_exports);
function tsValue(dt) {
  if (!dt) {
    return null;
  }
  if (typeof dt.timestamp === "number" && dt.timestamp > 0) {
    return new Date(dt.timestamp * 1e3).toISOString();
  }
  if (dt.value) {
    return String(dt.value);
  }
  return null;
}
function locValue(loc) {
  if (!loc || loc.value === void 0 || loc.value === null) {
    return null;
  }
  return Number(loc.value);
}
function locUnit(loc) {
  return (loc == null ? void 0 : loc.unit) || void 0;
}
function pickController(controllers, currentControllerId, v1ControllerId) {
  const list = controllers || [];
  if (v1ControllerId != null) {
    const match = list.find((c) => Number(c == null ? void 0 : c.id) === Number(v1ControllerId));
    if (match) {
      return match;
    }
  }
  if (currentControllerId != null) {
    const match = list.find((c) => Number(c == null ? void 0 : c.id) === Number(currentControllerId));
    if (match) {
      return match;
    }
  }
  return list[0];
}
function v2StructureKey(controller) {
  var _a;
  const zones = ((controller == null ? void 0 : controller.zones) || []).map((z) => {
    var _a2, _b;
    return String((_b = (_a2 = z == null ? void 0 : z.number) == null ? void 0 : _a2.value) != null ? _b : z == null ? void 0 : z.id);
  });
  const sensors = ((controller == null ? void 0 : controller.sensors) || []).map((s) => {
    var _a2, _b;
    return String((_b = (_a2 = s == null ? void 0 : s.input) == null ? void 0 : _a2.number) != null ? _b : s == null ? void 0 : s.id);
  });
  return JSON.stringify({ zones: zones.sort(), sensors: sensors.sort(), id: (_a = controller == null ? void 0 : controller.id) != null ? _a : 0 });
}
function mapControllerStates(controller) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const lastContact = tsValue(controller == null ? void 0 : controller.lastContactTime) || tsValue((_a = controller == null ? void 0 : controller.status) == null ? void 0 : _a.lastContact);
  return [
    {
      id: "controller.id",
      type: "state",
      common: { name: "controller id", type: "number", role: "value", read: true, write: false },
      value: Number(controller == null ? void 0 : controller.id) || 0
    },
    {
      id: "controller.name",
      type: "state",
      common: { name: "controller name", type: "string", role: "text", read: true, write: false },
      value: (_b = controller == null ? void 0 : controller.name) != null ? _b : ""
    },
    {
      id: "controller.online",
      type: "state",
      common: { name: "online", type: "boolean", role: "indicator.reachable", read: true, write: false },
      value: Boolean((_d = controller == null ? void 0 : controller.online) != null ? _d : (_c = controller == null ? void 0 : controller.status) == null ? void 0 : _c.online)
    },
    {
      id: "controller.serial",
      type: "state",
      common: { name: "serial number", type: "string", role: "text", read: true, write: false },
      value: (_f = (_e = controller == null ? void 0 : controller.hardware) == null ? void 0 : _e.serialNumber) != null ? _f : ""
    },
    {
      id: "controller.model",
      type: "state",
      common: { name: "model", type: "string", role: "text", read: true, write: false },
      value: (_i = (_h = (_g = controller == null ? void 0 : controller.hardware) == null ? void 0 : _g.model) == null ? void 0 : _h.name) != null ? _i : ""
    },
    {
      id: "controller.lastContact",
      type: "state",
      common: { name: "last contact", type: "string", role: "date", read: true, write: false },
      value: lastContact
    },
    {
      id: "controller.summary",
      type: "state",
      common: { name: "status summary", type: "string", role: "text", read: true, write: false },
      value: (_k = (_j = controller == null ? void 0 : controller.status) == null ? void 0 : _j.summary) != null ? _k : ""
    }
  ];
}
function mapAllZoneCommandObjects() {
  return [
    {
      id: "zones.stopall",
      type: "state",
      common: {
        name: {
          en: "stop all zones",
          de: "alle Zonen stoppen"
        },
        type: "boolean",
        role: "button.stop",
        read: false,
        write: true
      }
    },
    {
      id: "zones.runall",
      type: "state",
      common: {
        name: {
          en: "run all zones for x seconds",
          de: "alle Zonen f\xFCr x Sekunden ausf\xFChren"
        },
        type: "number",
        role: "level",
        unit: "seconds",
        read: true,
        write: true
      }
    },
    {
      id: "zones.suspendall",
      type: "state",
      common: {
        name: {
          en: "suspend all zones for x seconds",
          de: "alle Zonen f\xFCr x Sekunden aussetzen"
        },
        type: "number",
        role: "level",
        unit: "seconds",
        read: true,
        write: true
      }
    }
  ];
}
function mapZoneCommandObjects(zoneNumber) {
  const base = `zones.${zoneNumber}`;
  return [
    {
      id: `${base}.stopZone`,
      type: "state",
      common: {
        name: { en: "stop zone", de: "Zone stoppen" },
        type: "boolean",
        role: "button.stop",
        read: false,
        write: true
      }
    },
    {
      id: `${base}.runZone`,
      type: "state",
      common: {
        name: { en: "run zone for x seconds", de: "Zone f\xFCr x Sekunden starten" },
        type: "number",
        role: "level",
        unit: "seconds",
        read: true,
        write: true
      }
    },
    {
      id: `${base}.suspendZone`,
      type: "state",
      common: {
        name: { en: "suspend zone for x seconds", de: "Zone f\xFCr x Sekunden aussetzen" },
        type: "number",
        role: "level",
        unit: "seconds",
        read: true,
        write: true
      }
    },
    {
      id: `${base}.runDefault`,
      type: "state",
      common: {
        name: { en: "run zone for default time", de: "Zone mit Standardlaufzeit starten" },
        type: "boolean",
        role: "button.start",
        read: true,
        write: true
      }
    }
  ];
}
function mapZoneStates(zone) {
  var _a, _b, _c, _d, _e;
  const n = (_a = zone == null ? void 0 : zone.number) == null ? void 0 : _a.value;
  if (n === void 0 || n === null) {
    return [];
  }
  const base = `zones.${n}`;
  const current = (_b = zone == null ? void 0 : zone.scheduledRuns) == null ? void 0 : _b.currentRun;
  const next = (_c = zone == null ? void 0 : zone.scheduledRuns) == null ? void 0 : _c.nextRun;
  const running = Boolean(current);
  return [
    { id: base, type: "channel", common: { name: (zone == null ? void 0 : zone.name) || String(n) } },
    {
      id: `${base}.name`,
      type: "state",
      common: { name: "name", type: "string", role: "text", read: true, write: false },
      value: (_d = zone == null ? void 0 : zone.name) != null ? _d : ""
    },
    {
      id: `${base}.running`,
      type: "state",
      common: { name: "running", type: "boolean", role: "indicator", read: true, write: false },
      value: running
    },
    {
      id: `${base}.remaining`,
      type: "state",
      common: {
        name: "remaining time",
        type: "number",
        role: "value",
        unit: "seconds",
        read: true,
        write: false
      },
      value: running ? Number(current == null ? void 0 : current.remainingTime) || 0 : 0
    },
    {
      id: `${base}.nextRun`,
      type: "state",
      common: { name: "next run", type: "string", role: "date", read: true, write: false },
      value: tsValue(next == null ? void 0 : next.startTime)
    },
    {
      id: `${base}.suspendedUntil`,
      type: "state",
      common: { name: "suspended until", type: "string", role: "date", read: true, write: false },
      value: tsValue((_e = zone == null ? void 0 : zone.status) == null ? void 0 : _e.suspendedUntil)
    }
  ];
}
function mapSensorStates(sensor) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const input = (_a = sensor == null ? void 0 : sensor.input) == null ? void 0 : _a.number;
  if (input === void 0 || input === null) {
    return [];
  }
  const base = `sensors.${input}`;
  return [
    { id: base, type: "channel", common: { name: (sensor == null ? void 0 : sensor.name) || String(input) } },
    {
      id: `${base}.name`,
      type: "state",
      common: { name: "name", type: "string", role: "text", read: true, write: false },
      value: (_b = sensor == null ? void 0 : sensor.name) != null ? _b : ""
    },
    {
      id: `${base}.type`,
      type: "state",
      common: { name: "sensor type", type: "string", role: "text", read: true, write: false },
      value: (_d = (_c = sensor == null ? void 0 : sensor.model) == null ? void 0 : _c.sensorType) != null ? _d : ""
    },
    {
      id: `${base}.active`,
      type: "state",
      common: { name: "active", type: "boolean", role: "indicator", read: true, write: false },
      value: Boolean((_e = sensor == null ? void 0 : sensor.status) == null ? void 0 : _e.active)
    },
    {
      id: `${base}.waterFlow`,
      type: "state",
      common: {
        name: "water flow",
        type: "number",
        role: "value",
        unit: locUnit((_f = sensor == null ? void 0 : sensor.status) == null ? void 0 : _f.waterFlow),
        read: true,
        write: false
      },
      value: locValue((_g = sensor == null ? void 0 : sensor.status) == null ? void 0 : _g.waterFlow)
    },
    {
      id: `${base}.waterFlowUnit`,
      type: "state",
      common: { name: "water flow unit", type: "string", role: "text", read: true, write: false },
      value: (_j = (_i = (_h = sensor == null ? void 0 : sensor.status) == null ? void 0 : _h.waterFlow) == null ? void 0 : _i.unit) != null ? _j : ""
    }
  ];
}
function mapWeatherStates(forecasts) {
  const nodes = [];
  (forecasts || []).forEach((day, i) => {
    var _a, _b, _c, _d;
    const base = `weather.${i}`;
    nodes.push({ id: base, type: "channel", common: { name: (day == null ? void 0 : day.time) || `day ${i}` } });
    nodes.push({
      id: `${base}.conditions`,
      type: "state",
      common: { name: "conditions", type: "string", role: "text", read: true, write: false },
      value: (_a = day == null ? void 0 : day.conditions) != null ? _a : ""
    });
    nodes.push({
      id: `${base}.time`,
      type: "state",
      common: { name: "time", type: "string", role: "date", read: true, write: false },
      value: (_b = day == null ? void 0 : day.time) != null ? _b : ""
    });
    nodes.push({
      id: `${base}.highTemperature`,
      type: "state",
      common: {
        name: "high temperature",
        type: "number",
        role: "value.temperature",
        unit: locUnit(day == null ? void 0 : day.highTemperature),
        read: true,
        write: false
      },
      value: locValue(day == null ? void 0 : day.highTemperature)
    });
    nodes.push({
      id: `${base}.lowTemperature`,
      type: "state",
      common: {
        name: "low temperature",
        type: "number",
        role: "value.temperature",
        unit: locUnit(day == null ? void 0 : day.lowTemperature),
        read: true,
        write: false
      },
      value: locValue(day == null ? void 0 : day.lowTemperature)
    });
    nodes.push({
      id: `${base}.precipitation`,
      type: "state",
      common: {
        name: "precipitation",
        type: "number",
        role: "value",
        unit: locUnit(day == null ? void 0 : day.precipitation),
        read: true,
        write: false
      },
      value: locValue(day == null ? void 0 : day.precipitation)
    });
    nodes.push({
      id: `${base}.probabilityOfPrecipitation`,
      type: "state",
      common: {
        name: "probability of precipitation",
        type: "number",
        role: "value",
        unit: "%",
        read: true,
        write: false
      },
      value: (_c = day == null ? void 0 : day.probabilityOfPrecipitation) != null ? _c : null
    });
    nodes.push({
      id: `${base}.humidity`,
      type: "state",
      common: { name: "humidity", type: "number", role: "value.humidity", unit: "%", read: true, write: false },
      value: (_d = day == null ? void 0 : day.averageHumidity) != null ? _d : null
    });
    nodes.push({
      id: `${base}.wind`,
      type: "state",
      common: {
        name: "wind",
        type: "number",
        role: "value",
        unit: locUnit(day == null ? void 0 : day.averageWindSpeed),
        read: true,
        write: false
      },
      value: locValue(day == null ? void 0 : day.averageWindSpeed)
    });
  });
  return nodes;
}
function computeWaterSummary(waterData) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const byZone = {};
  let totalActiveUse = 0;
  let totalActiveTime = 0;
  let unit = null;
  let hasUsage = false;
  for (const entry of ((_a = waterData == null ? void 0 : waterData.reports) == null ? void 0 : _a.watering) || []) {
    const event = entry == null ? void 0 : entry.runEvent;
    if (!event) {
      continue;
    }
    const zoneNum = String((_f = (_e = (_c = (_b = event.zone) == null ? void 0 : _b.number) == null ? void 0 : _c.value) != null ? _e : (_d = event.zone) == null ? void 0 : _d.id) != null ? _f : "");
    if (!zoneNum) {
      continue;
    }
    if (!byZone[zoneNum]) {
      byZone[zoneNum] = { activeUse: 0, activeTime: 0 };
    }
    const duration = Number(event.reportedDuration) || 0;
    byZone[zoneNum].activeTime += duration;
    totalActiveTime += duration;
    if (event.reportedWaterUsage && event.reportedWaterUsage.value != null) {
      const use = Number(event.reportedWaterUsage.value) || 0;
      byZone[zoneNum].activeUse += use;
      totalActiveUse += use;
      hasUsage = true;
      unit = event.reportedWaterUsage.unit || unit;
    }
  }
  let totalUse = null;
  for (const sensor of (waterData == null ? void 0 : waterData.sensors) || []) {
    if (((_g = sensor == null ? void 0 : sensor.model) == null ? void 0 : _g.sensorType) !== "FLOW") {
      continue;
    }
    const volume = (_h = sensor == null ? void 0 : sensor.flowSummary) == null ? void 0 : _h.totalWaterVolume;
    if (volume && volume.value != null) {
      totalUse = (totalUse != null ? totalUse : 0) + Number(volume.value);
      unit = volume.unit || unit;
    }
  }
  const hasFlow = totalUse != null;
  if (totalUse != null && hasUsage && totalUse < totalActiveUse) {
    totalUse = totalActiveUse;
  }
  const inactiveUse = hasFlow ? Math.max(0, (totalUse != null ? totalUse : 0) - (hasUsage ? totalActiveUse : 0)) : null;
  return {
    totalUse,
    activeUse: hasUsage ? totalActiveUse : hasFlow ? 0 : null,
    inactiveUse,
    activeTime: totalActiveTime,
    unit,
    leakSuspected: (inactiveUse != null ? inactiveUse : 0) > 0,
    byZone
  };
}
function mapWaterStates(period, summary) {
  const base = `water.${period}`;
  const unit = summary.unit || void 0;
  const nodes = [
    { id: base, type: "channel", common: { name: period } },
    {
      id: `${base}.totalUse`,
      type: "state",
      common: { name: "total water use", type: "number", role: "value.volume", unit, read: true, write: false },
      value: summary.totalUse
    },
    {
      id: `${base}.activeUse`,
      type: "state",
      common: { name: "active water use", type: "number", role: "value.volume", unit, read: true, write: false },
      value: summary.activeUse
    },
    {
      id: `${base}.inactiveUse`,
      type: "state",
      common: {
        name: "inactive water use",
        type: "number",
        role: "value.volume",
        unit,
        read: true,
        write: false
      },
      value: summary.inactiveUse
    },
    {
      id: `${base}.activeTime`,
      type: "state",
      common: {
        name: "active watering time",
        type: "number",
        role: "value",
        unit: "seconds",
        read: true,
        write: false
      },
      value: summary.activeTime
    },
    {
      id: `${base}.unit`,
      type: "state",
      common: { name: "unit", type: "string", role: "text", read: true, write: false },
      value: summary.unit
    }
  ];
  if (period === "today") {
    nodes.push({
      id: "water.leakSuspected",
      type: "state",
      common: { name: "leak suspected", type: "boolean", role: "indicator.alarm", read: true, write: false },
      value: summary.leakSuspected
    });
  }
  for (const [zoneNum, use] of Object.entries(summary.byZone)) {
    nodes.push({
      id: `zones.${zoneNum}.${period}`,
      type: "channel",
      common: { name: period }
    });
    nodes.push({
      id: `zones.${zoneNum}.${period}.activeUse`,
      type: "state",
      common: {
        name: `${period} active water use`,
        type: "number",
        role: "value.volume",
        unit,
        read: true,
        write: false
      },
      value: use.activeUse
    });
    nodes.push({
      id: `zones.${zoneNum}.${period}.activeTime`,
      type: "state",
      common: {
        name: `${period} active watering time`,
        type: "number",
        role: "value",
        unit: "seconds",
        read: true,
        write: false
      },
      value: use.activeTime
    });
  }
  return nodes;
}
function zoneIdMap(controller) {
  var _a;
  const map = {};
  for (const zone of (controller == null ? void 0 : controller.zones) || []) {
    const n = (_a = zone == null ? void 0 : zone.number) == null ? void 0 : _a.value;
    if (n !== void 0 && n !== null && (zone == null ? void 0 : zone.id) != null) {
      map[String(n)] = Number(zone.id);
    }
  }
  return map;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  computeWaterSummary,
  mapAllZoneCommandObjects,
  mapControllerStates,
  mapSensorStates,
  mapWaterStates,
  mapWeatherStates,
  mapZoneCommandObjects,
  mapZoneStates,
  pickController,
  v2StructureKey,
  zoneIdMap
});
//# sourceMappingURL=mapper.js.map
