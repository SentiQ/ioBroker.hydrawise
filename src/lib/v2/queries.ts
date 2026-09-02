export type LongPeriod = 'week' | 'month' | 'year';
export type WaterPeriod = 'today' | LongPeriod;

export const LONG_PERIODS: readonly LongPeriod[] = ['week', 'month', 'year'];

export const STATUS_QUERY = `query Status {
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

export const WEATHER_QUERY = `query Weather($controllerId: Int!) {
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

export const WATER_QUERY = `query Water($controllerId: Int!, $start: Int!, $end: Int!) {
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

/**
 * Count parameterized selections of a GraphQL field (fieldName(...)).
 *
 * @param query GraphQL document
 * @param field field name
 */
export function countFieldSelections(query: string, field: string): number {
    const re = new RegExp(`\\b${field}\\s*\\(`, 'g');
    return query.match(re)?.length ?? 0;
}

/**
 * Next long-term water period in the week → month → year rotation.
 *
 * @param index current rotation index
 */
export function nextLongPeriod(index: number): { period: LongPeriod; nextIndex: number } {
    const normalized = ((index % LONG_PERIODS.length) + LONG_PERIODS.length) % LONG_PERIODS.length;
    return {
        period: LONG_PERIODS[normalized],
        nextIndex: (normalized + 1) % LONG_PERIODS.length,
    };
}

function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalWeek(date: Date): Date {
    const day = date.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
}

/**
 * Unix-second window for a water-usage period (local calendar, UTC epoch).
 *
 * @param period today / week / month / year
 * @param now reference time
 */
export function periodWindow(period: WaterPeriod, now: Date = new Date()): { start: number; end: number } {
    const end = Math.floor(now.getTime() / 1000);
    let startDate: Date;
    switch (period) {
        case 'week':
            startDate = startOfLocalWeek(now);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            startDate = startOfLocalDay(now);
    }
    return { start: Math.floor(startDate.getTime() / 1000), end };
}

/** GraphQL operation with variables. */
export interface GraphQlOp {
    /** GraphQL document. */
    query: string;
    /** GraphQL variables. */
    variables: Record<string, unknown>;
}

/**
 * Weather forecast query for one controller.
 *
 * @param controllerId GraphQL controller id
 */
export function weatherRequest(controllerId: number): GraphQlOp {
    return { query: WEATHER_QUERY, variables: { controllerId } };
}

/**
 * Water usage query for one period (single flowSummary + single watering).
 *
 * @param controllerId GraphQL controller id
 * @param period today or a long-term period
 * @param now reference time
 */
export function waterRequest(
    controllerId: number,
    period: WaterPeriod,
    now: Date = new Date(),
): GraphQlOp & { period: WaterPeriod } {
    const { start, end } = periodWindow(period, now);
    return { query: WATER_QUERY, variables: { controllerId, start, end }, period };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/**
 * Format a Date as Hydrawise `until` string (pydrawise / app style).
 *
 * @param date suspension end
 */
export function formatSuspendUntil(date: Date): string {
    const offsetMin = -date.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const tz = `${sign}${pad2(Math.floor(abs / 60))}${pad2(abs % 60)}`;
    const yy = pad2(date.getFullYear() % 100);
    return `${DAYS[date.getDay()]}, ${pad2(date.getDate())} ${MONTHS[date.getMonth()]} ${yy} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${tz}`;
}

/**
 * GraphQL mutation payload `status: ERROR` summary, if present.
 *
 * @param data GraphQL `data` object
 */
export function mutationErrorSummary(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') {
        return undefined;
    }
    for (const value of Object.values(data as Record<string, unknown>)) {
        if (value && typeof value === 'object' && (value as { status?: string }).status === 'ERROR') {
            return String((value as { summary?: string }).summary || 'mutation error');
        }
    }
    return undefined;
}

/**
 * Start one zone, optionally for a custom duration in seconds.
 *
 * @param zoneId GraphQL zone id
 * @param customRunDuration seconds; omit for default run time
 */
export function startZoneMutation(zoneId: number, customRunDuration?: number): GraphQlOp {
    if (customRunDuration && customRunDuration > 0) {
        return {
            query: `mutation StartZone($zoneId: Int!, $customRunDuration: Int) { startZone(zoneId: $zoneId, customRunDuration: $customRunDuration) { status summary } }`,
            variables: { zoneId, customRunDuration },
        };
    }
    return {
        query: `mutation StartZone($zoneId: Int!) { startZone(zoneId: $zoneId) { status summary } }`,
        variables: { zoneId },
    };
}

/**
 * Stop one zone.
 *
 * @param zoneId GraphQL zone id
 */
export function stopZoneMutation(zoneId: number): GraphQlOp {
    return {
        query: `mutation StopZone($zoneId: Int!) { stopZone(zoneId: $zoneId) { status summary } }`,
        variables: { zoneId },
    };
}

/**
 * Suspend one zone until a timestamp.
 *
 * @param zoneId GraphQL zone id
 * @param until suspension end
 */
export function suspendZoneMutation(zoneId: number, until: Date): GraphQlOp {
    return {
        query: `mutation SuspendZone($zoneId: Int!, $until: String!) { suspendZone(zoneId: $zoneId, until: $until) { status summary } }`,
        variables: { zoneId, until: formatSuspendUntil(until) },
    };
}

/**
 * Start all zones on a controller.
 *
 * @param controllerId GraphQL controller id
 * @param customRunDuration seconds; omit for default run time
 */
export function startAllZonesMutation(controllerId: number, customRunDuration?: number): GraphQlOp {
    if (customRunDuration && customRunDuration > 0) {
        return {
            query: `mutation StartAll($controllerId: Int!, $customRunDuration: Int) { startAllZones(controllerId: $controllerId, customRunDuration: $customRunDuration) { status summary } }`,
            variables: { controllerId, customRunDuration },
        };
    }
    return {
        query: `mutation StartAll($controllerId: Int!) { startAllZones(controllerId: $controllerId) { status summary } }`,
        variables: { controllerId },
    };
}

/**
 * Stop all zones on a controller.
 *
 * @param controllerId GraphQL controller id
 */
export function stopAllZonesMutation(controllerId: number): GraphQlOp {
    return {
        query: `mutation StopAll($controllerId: Int!) { stopAllZones(controllerId: $controllerId) { status summary } }`,
        variables: { controllerId },
    };
}

/**
 * Suspend all zones on a controller until a timestamp.
 *
 * @param controllerId GraphQL controller id
 * @param until suspension end
 */
export function suspendAllZonesMutation(controllerId: number, until: Date): GraphQlOp {
    return {
        query: `mutation SuspendAll($controllerId: Int!, $until: String!) { suspendAllZones(controllerId: $controllerId, until: $until) { status summary } }`,
        variables: { controllerId, until: formatSuspendUntil(until) },
    };
}
