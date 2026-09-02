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
var queries_exports = {};
__export(queries_exports, {
  LONG_PERIODS: () => LONG_PERIODS,
  STATUS_QUERY: () => STATUS_QUERY,
  WATER_QUERY: () => WATER_QUERY,
  WEATHER_QUERY: () => WEATHER_QUERY,
  countFieldSelections: () => countFieldSelections,
  formatSuspendUntil: () => formatSuspendUntil,
  mutationErrorSummary: () => mutationErrorSummary,
  nextLongPeriod: () => nextLongPeriod,
  periodWindow: () => periodWindow,
  startAllZonesMutation: () => startAllZonesMutation,
  startZoneMutation: () => startZoneMutation,
  stopAllZonesMutation: () => stopAllZonesMutation,
  stopZoneMutation: () => stopZoneMutation,
  suspendAllZonesMutation: () => suspendAllZonesMutation,
  suspendZoneMutation: () => suspendZoneMutation,
  waterRequest: () => waterRequest,
  weatherRequest: () => weatherRequest
});
module.exports = __toCommonJS(queries_exports);
const LONG_PERIODS = ["week", "month", "year"];
const STATUS_QUERY = `query Status {
  me {
    currentController { id }
    controllers {
      id
      name
      online
      softwareVersion
      lastContactTime { timestamp value }
      hardware {
        serialNumber
        version
        model { name description }
      }
      status {
        summary
        online
        lastContact { timestamp value }
      }
      zones {
        id
        name
        number { value }
        status { suspendedUntil { timestamp value } }
        scheduledRuns {
          summary
          currentRun {
            remainingTime
            duration
            startTime { timestamp value }
            endTime { timestamp value }
          }
          nextRun {
            duration
            startTime { timestamp value }
            endTime { timestamp value }
          }
        }
      }
      sensors {
        id
        name
        input { number label }
        status {
          active
          waterFlow { value unit }
        }
        model {
          sensorType
          name
        }
      }
    }
  }
}`;
const WEATHER_QUERY = `query Weather($controllerId: Int!) {
  controller(controllerId: $controllerId) {
    location {
      forecast(days: 3) {
        time
        updateTime
        conditions
        averageHumidity
        probabilityOfPrecipitation
        highTemperature { value unit }
        lowTemperature { value unit }
        precipitation { value unit }
        averageWindSpeed { value unit }
        evapotranspiration { value unit }
      }
    }
  }
}`;
const WATER_QUERY = `query Water($controllerId: Int!, $start: Int!, $end: Int!) {
  controller(controllerId: $controllerId) {
    sensors {
      id
      model { sensorType }
      flowSummary(start: $start, end: $end) {
        totalWaterVolume { value unit }
      }
    }
    reports {
      watering(from: $start, until: $end) {
        runEvent {
          zone { id number { value } }
          reportedDuration
          reportedWaterUsage { value unit }
        }
      }
    }
  }
}`;
function countFieldSelections(query, field) {
  var _a, _b;
  const re = new RegExp(`\\b${field}\\s*\\(`, "g");
  return (_b = (_a = query.match(re)) == null ? void 0 : _a.length) != null ? _b : 0;
}
function nextLongPeriod(index) {
  const normalized = (index % LONG_PERIODS.length + LONG_PERIODS.length) % LONG_PERIODS.length;
  return {
    period: LONG_PERIODS[normalized],
    nextIndex: (normalized + 1) % LONG_PERIODS.length
  };
}
function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function startOfLocalWeek(date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
}
function periodWindow(period, now = /* @__PURE__ */ new Date()) {
  const end = Math.floor(now.getTime() / 1e3);
  let startDate;
  switch (period) {
    case "week":
      startDate = startOfLocalWeek(now);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = startOfLocalDay(now);
  }
  return { start: Math.floor(startDate.getTime() / 1e3), end };
}
function weatherRequest(controllerId) {
  return { query: WEATHER_QUERY, variables: { controllerId } };
}
function waterRequest(controllerId, period, now = /* @__PURE__ */ new Date()) {
  const { start, end } = periodWindow(period, now);
  return { query: WATER_QUERY, variables: { controllerId, start, end }, period };
}
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatSuspendUntil(date) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const tz = `${sign}${pad2(Math.floor(abs / 60))}${pad2(abs % 60)}`;
  const yy = pad2(date.getFullYear() % 100);
  return `${DAYS[date.getDay()]}, ${pad2(date.getDate())} ${MONTHS[date.getMonth()]} ${yy} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${tz}`;
}
function mutationErrorSummary(data) {
  if (!data || typeof data !== "object") {
    return void 0;
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === "object" && value.status === "ERROR") {
      return String(value.summary || "mutation error");
    }
  }
  return void 0;
}
function startZoneMutation(zoneId, customRunDuration) {
  if (customRunDuration && customRunDuration > 0) {
    return {
      query: `mutation StartZone($zoneId: Int!, $customRunDuration: Int) { startZone(zoneId: $zoneId, customRunDuration: $customRunDuration) { status summary } }`,
      variables: { zoneId, customRunDuration }
    };
  }
  return {
    query: `mutation StartZone($zoneId: Int!) { startZone(zoneId: $zoneId) { status summary } }`,
    variables: { zoneId }
  };
}
function stopZoneMutation(zoneId) {
  return {
    query: `mutation StopZone($zoneId: Int!) { stopZone(zoneId: $zoneId) { status summary } }`,
    variables: { zoneId }
  };
}
function suspendZoneMutation(zoneId, until) {
  return {
    query: `mutation SuspendZone($zoneId: Int!, $until: String!) { suspendZone(zoneId: $zoneId, until: $until) { status summary } }`,
    variables: { zoneId, until: formatSuspendUntil(until) }
  };
}
function startAllZonesMutation(controllerId, customRunDuration) {
  if (customRunDuration && customRunDuration > 0) {
    return {
      query: `mutation StartAll($controllerId: Int!, $customRunDuration: Int) { startAllZones(controllerId: $controllerId, customRunDuration: $customRunDuration) { status summary } }`,
      variables: { controllerId, customRunDuration }
    };
  }
  return {
    query: `mutation StartAll($controllerId: Int!) { startAllZones(controllerId: $controllerId) { status summary } }`,
    variables: { controllerId }
  };
}
function stopAllZonesMutation(controllerId) {
  return {
    query: `mutation StopAll($controllerId: Int!) { stopAllZones(controllerId: $controllerId) { status summary } }`,
    variables: { controllerId }
  };
}
function suspendAllZonesMutation(controllerId, until) {
  return {
    query: `mutation SuspendAll($controllerId: Int!, $until: String!) { suspendAllZones(controllerId: $controllerId, until: $until) { status summary } }`,
    variables: { controllerId, until: formatSuspendUntil(until) }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LONG_PERIODS,
  STATUS_QUERY,
  WATER_QUERY,
  WEATHER_QUERY,
  countFieldSelections,
  formatSuspendUntil,
  mutationErrorSummary,
  nextLongPeriod,
  periodWindow,
  startAllZonesMutation,
  startZoneMutation,
  stopAllZonesMutation,
  stopZoneMutation,
  suspendAllZonesMutation,
  suspendZoneMutation,
  waterRequest,
  weatherRequest
});
//# sourceMappingURL=queries.js.map
