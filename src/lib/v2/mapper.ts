import type { WaterPeriod } from './queries';

/** ioBroker object/state descriptor produced by the v2 mapper. */
export interface MappedNode {
    /** Object id relative to the adapter namespace. */
    id: string;
    /** ioBroker object type. */
    type: 'channel' | 'state';
    /** ioBroker common definition. */
    common: Record<string, unknown>;
    /** State value; omitted for channels and command objects. */
    value?: string | number | boolean | null;
}

/** Per-zone water use for one period. */
export interface WaterZoneUse {
    /** Water used while the zone ran. */
    activeUse: number;
    /** Active watering time in seconds. */
    activeTime: number;
}

/** Combined flowSummary + watering report. */
export interface WaterSummary {
    /** Total volume from the flow sensor, if any. */
    totalUse: number | null;
    /** Volume attributed to zone runs. */
    activeUse: number | null;
    /** Volume while no zone ran (leak/hose). */
    inactiveUse: number | null;
    /** Active watering time in seconds. */
    activeTime: number;
    /** Volume unit from the API. */
    unit: string | null;
    /** True when inactive use is greater than zero. */
    leakSuspected: boolean;
    /** Per-zone active use keyed by zone number. */
    byZone: Record<string, WaterZoneUse>;
}

function tsValue(dt: { timestamp?: number; value?: string } | null | undefined): string | null {
    if (!dt) {
        return null;
    }
    if (typeof dt.timestamp === 'number' && dt.timestamp > 0) {
        return new Date(dt.timestamp * 1000).toISOString();
    }
    if (dt.value) {
        return String(dt.value);
    }
    return null;
}

function locValue(loc: { value?: number; unit?: string } | null | undefined): number | null {
    if (!loc || loc.value === undefined || loc.value === null) {
        return null;
    }
    return Number(loc.value);
}

function locUnit(loc: { value?: number; unit?: string } | null | undefined): string | undefined {
    return loc?.unit || undefined;
}

/**
 * Pick the controller matching the v1 controller_id, else currentController, else the first.
 *
 * @param controllers GraphQL controller list
 * @param currentControllerId me.currentController.id
 * @param v1ControllerId controller_id from v1 customer/schedule payload
 */
export function pickController(
    controllers: any[] | undefined,
    currentControllerId?: number,
    v1ControllerId?: number,
): any {
    const list = controllers || [];
    if (v1ControllerId != null) {
        const match = list.find(c => Number(c?.id) === Number(v1ControllerId));
        if (match) {
            return match;
        }
    }
    if (currentControllerId != null) {
        const match = list.find(c => Number(c?.id) === Number(currentControllerId));
        if (match) {
            return match;
        }
    }
    return list[0];
}

/**
 * Structure key for v2 object creation (zone numbers + sensor inputs).
 *
 * @param controller selected controller
 */
export function v2StructureKey(controller: any): string {
    const zones = (controller?.zones || []).map((z: any) => String(z?.number?.value ?? z?.id));
    const sensors = (controller?.sensors || []).map((s: any) => String(s?.input?.number ?? s?.id));
    return JSON.stringify({ zones: zones.sort(), sensors: sensors.sort(), id: controller?.id ?? 0 });
}

/**
 * Map controller fields to ioBroker states.
 *
 * @param controller selected controller
 */
export function mapControllerStates(controller: any): MappedNode[] {
    const lastContact = tsValue(controller?.lastContactTime) || tsValue(controller?.status?.lastContact);
    return [
        {
            id: 'controller.id',
            type: 'state',
            common: { name: 'controller id', type: 'number', role: 'value', read: true, write: false },
            value: Number(controller?.id) || 0,
        },
        {
            id: 'controller.name',
            type: 'state',
            common: { name: 'controller name', type: 'string', role: 'text', read: true, write: false },
            value: controller?.name ?? '',
        },
        {
            id: 'controller.online',
            type: 'state',
            common: { name: 'online', type: 'boolean', role: 'indicator.reachable', read: true, write: false },
            value: Boolean(controller?.online ?? controller?.status?.online),
        },
        {
            id: 'controller.serial',
            type: 'state',
            common: { name: 'serial number', type: 'string', role: 'text', read: true, write: false },
            value: controller?.hardware?.serialNumber ?? '',
        },
        {
            id: 'controller.model',
            type: 'state',
            common: { name: 'model', type: 'string', role: 'text', read: true, write: false },
            value: controller?.hardware?.model?.name ?? '',
        },
        {
            id: 'controller.lastContact',
            type: 'state',
            common: { name: 'last contact', type: 'string', role: 'date', read: true, write: false },
            value: lastContact,
        },
        {
            id: 'controller.summary',
            type: 'state',
            common: { name: 'status summary', type: 'string', role: 'text', read: true, write: false },
            value: controller?.status?.summary ?? '',
        },
    ];
}

/**
 * All-zones command objects (stop/run/suspend).
 */
export function mapAllZoneCommandObjects(): MappedNode[] {
    return [
        {
            id: 'zones.stopall',
            type: 'state',
            common: {
                name: {
                    en: 'stop all zones',
                    de: 'alle Zonen stoppen',
                },
                type: 'boolean',
                role: 'button.stop',
                read: false,
                write: true,
            },
        },
        {
            id: 'zones.runall',
            type: 'state',
            common: {
                name: {
                    en: 'run all zones for x seconds',
                    de: 'alle Zonen für x Sekunden ausführen',
                },
                type: 'number',
                role: 'level',
                unit: 'seconds',
                read: true,
                write: true,
            },
        },
        {
            id: 'zones.suspendall',
            type: 'state',
            common: {
                name: {
                    en: 'suspend all zones for x seconds',
                    de: 'alle Zonen für x Sekunden aussetzen',
                },
                type: 'number',
                role: 'level',
                unit: 'seconds',
                read: true,
                write: true,
            },
        },
    ];
}

/**
 * Per-zone command objects for a v2 zone channel.
 *
 * @param zoneNumber Hydrawise zone number
 */
export function mapZoneCommandObjects(zoneNumber: string | number): MappedNode[] {
    const base = `zones.${zoneNumber}`;
    return [
        {
            id: `${base}.stopZone`,
            type: 'state',
            common: {
                name: { en: 'stop zone', de: 'Zone stoppen' },
                type: 'boolean',
                role: 'button.stop',
                read: false,
                write: true,
            },
        },
        {
            id: `${base}.runZone`,
            type: 'state',
            common: {
                name: { en: 'run zone for x seconds', de: 'Zone für x Sekunden starten' },
                type: 'number',
                role: 'level',
                unit: 'seconds',
                read: true,
                write: true,
            },
        },
        {
            id: `${base}.suspendZone`,
            type: 'state',
            common: {
                name: { en: 'suspend zone for x seconds', de: 'Zone für x Sekunden aussetzen' },
                type: 'number',
                role: 'level',
                unit: 'seconds',
                read: true,
                write: true,
            },
        },
        {
            id: `${base}.runDefault`,
            type: 'state',
            common: {
                name: { en: 'run zone for default time', de: 'Zone mit Standardlaufzeit starten' },
                type: 'boolean',
                role: 'button.start',
                read: true,
                write: true,
            },
        },
    ];
}

/**
 * Map a GraphQL zone to live v2 states.
 *
 * @param zone GraphQL zone
 */
export function mapZoneStates(zone: any): MappedNode[] {
    const n = zone?.number?.value;
    if (n === undefined || n === null) {
        return [];
    }
    const base = `zones.${n}`;
    const current = zone?.scheduledRuns?.currentRun;
    const next = zone?.scheduledRuns?.nextRun;
    const running = Boolean(current);
    return [
        { id: base, type: 'channel', common: { name: zone?.name || String(n) } },
        {
            id: `${base}.name`,
            type: 'state',
            common: { name: 'name', type: 'string', role: 'text', read: true, write: false },
            value: zone?.name ?? '',
        },
        {
            id: `${base}.running`,
            type: 'state',
            common: { name: 'running', type: 'boolean', role: 'indicator', read: true, write: false },
            value: running,
        },
        {
            id: `${base}.remaining`,
            type: 'state',
            common: {
                name: 'remaining time',
                type: 'number',
                role: 'value',
                unit: 'seconds',
                read: true,
                write: false,
            },
            value: running ? Number(current?.remainingTime) || 0 : 0,
        },
        {
            id: `${base}.nextRun`,
            type: 'state',
            common: { name: 'next run', type: 'string', role: 'date', read: true, write: false },
            value: tsValue(next?.startTime),
        },
        {
            id: `${base}.suspendedUntil`,
            type: 'state',
            common: { name: 'suspended until', type: 'string', role: 'date', read: true, write: false },
            value: tsValue(zone?.status?.suspendedUntil),
        },
    ];
}

/**
 * Map a GraphQL sensor to live v2 states.
 *
 * @param sensor GraphQL sensor
 */
export function mapSensorStates(sensor: any): MappedNode[] {
    const input = sensor?.input?.number;
    if (input === undefined || input === null) {
        return [];
    }
    const base = `sensors.${input}`;
    return [
        { id: base, type: 'channel', common: { name: sensor?.name || String(input) } },
        {
            id: `${base}.name`,
            type: 'state',
            common: { name: 'name', type: 'string', role: 'text', read: true, write: false },
            value: sensor?.name ?? '',
        },
        {
            id: `${base}.type`,
            type: 'state',
            common: { name: 'sensor type', type: 'string', role: 'text', read: true, write: false },
            value: sensor?.model?.sensorType ?? '',
        },
        {
            id: `${base}.active`,
            type: 'state',
            common: { name: 'active', type: 'boolean', role: 'indicator', read: true, write: false },
            value: Boolean(sensor?.status?.active),
        },
        {
            id: `${base}.waterFlow`,
            type: 'state',
            common: {
                name: 'water flow',
                type: 'number',
                role: 'value',
                unit: locUnit(sensor?.status?.waterFlow),
                read: true,
                write: false,
            },
            value: locValue(sensor?.status?.waterFlow),
        },
        {
            id: `${base}.waterFlowUnit`,
            type: 'state',
            common: { name: 'water flow unit', type: 'string', role: 'text', read: true, write: false },
            value: sensor?.status?.waterFlow?.unit ?? '',
        },
    ];
}

/**
 * Map forecast days to weather states.
 *
 * @param forecasts GraphQL forecast array
 */
export function mapWeatherStates(forecasts: any[] | undefined): MappedNode[] {
    const nodes: MappedNode[] = [];
    (forecasts || []).forEach((day, i) => {
        const base = `weather.${i}`;
        nodes.push({ id: base, type: 'channel', common: { name: day?.time || `day ${i}` } });
        nodes.push({
            id: `${base}.conditions`,
            type: 'state',
            common: { name: 'conditions', type: 'string', role: 'text', read: true, write: false },
            value: day?.conditions ?? '',
        });
        nodes.push({
            id: `${base}.time`,
            type: 'state',
            common: { name: 'time', type: 'string', role: 'date', read: true, write: false },
            value: day?.time ?? '',
        });
        nodes.push({
            id: `${base}.highTemperature`,
            type: 'state',
            common: {
                name: 'high temperature',
                type: 'number',
                role: 'value.temperature',
                unit: locUnit(day?.highTemperature),
                read: true,
                write: false,
            },
            value: locValue(day?.highTemperature),
        });
        nodes.push({
            id: `${base}.lowTemperature`,
            type: 'state',
            common: {
                name: 'low temperature',
                type: 'number',
                role: 'value.temperature',
                unit: locUnit(day?.lowTemperature),
                read: true,
                write: false,
            },
            value: locValue(day?.lowTemperature),
        });
        nodes.push({
            id: `${base}.precipitation`,
            type: 'state',
            common: {
                name: 'precipitation',
                type: 'number',
                role: 'value',
                unit: locUnit(day?.precipitation),
                read: true,
                write: false,
            },
            value: locValue(day?.precipitation),
        });
        nodes.push({
            id: `${base}.probabilityOfPrecipitation`,
            type: 'state',
            common: {
                name: 'probability of precipitation',
                type: 'number',
                role: 'value',
                unit: '%',
                read: true,
                write: false,
            },
            value: day?.probabilityOfPrecipitation ?? null,
        });
        nodes.push({
            id: `${base}.humidity`,
            type: 'state',
            common: { name: 'humidity', type: 'number', role: 'value.humidity', unit: '%', read: true, write: false },
            value: day?.averageHumidity ?? null,
        });
        nodes.push({
            id: `${base}.wind`,
            type: 'state',
            common: {
                name: 'wind',
                type: 'number',
                role: 'value',
                unit: locUnit(day?.averageWindSpeed),
                read: true,
                write: false,
            },
            value: locValue(day?.averageWindSpeed),
        });
    });
    return nodes;
}

/**
 * Combine flowSummary + watering report into active/inactive use (pydrawise logic).
 *
 * @param waterData controller payload from WATER_QUERY
 */
export function computeWaterSummary(waterData: any): WaterSummary {
    const byZone: Record<string, WaterZoneUse> = {};
    let totalActiveUse = 0;
    let totalActiveTime = 0;
    let unit: string | null = null;
    let hasUsage = false;

    for (const entry of waterData?.reports?.watering || []) {
        const event = entry?.runEvent;
        if (!event) {
            continue;
        }
        const zoneNum = String(event.zone?.number?.value ?? event.zone?.id ?? '');
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

    let totalUse: number | null = null;
    for (const sensor of waterData?.sensors || []) {
        if (sensor?.model?.sensorType !== 'FLOW') {
            continue;
        }
        const volume = sensor?.flowSummary?.totalWaterVolume;
        if (volume && volume.value != null) {
            totalUse = (totalUse ?? 0) + Number(volume.value);
            unit = volume.unit || unit;
        }
    }

    const hasFlow = totalUse != null;
    if (totalUse != null && hasUsage && totalUse < totalActiveUse) {
        totalUse = totalActiveUse;
    }
    const inactiveUse = hasFlow ? Math.max(0, (totalUse ?? 0) - (hasUsage ? totalActiveUse : 0)) : null;

    return {
        totalUse,
        activeUse: hasUsage ? totalActiveUse : hasFlow ? 0 : null,
        inactiveUse,
        activeTime: totalActiveTime,
        unit,
        leakSuspected: (inactiveUse ?? 0) > 0,
        byZone,
    };
}

/**
 * Map a water summary onto `water.<period>.*` and per-zone period states.
 *
 * @param period today / week / month / year
 * @param summary computed usage
 */
export function mapWaterStates(period: WaterPeriod, summary: WaterSummary): MappedNode[] {
    const base = `water.${period}`;
    const unit = summary.unit || undefined;
    const nodes: MappedNode[] = [
        { id: base, type: 'channel', common: { name: period } },
        {
            id: `${base}.totalUse`,
            type: 'state',
            common: { name: 'total water use', type: 'number', role: 'value.volume', unit, read: true, write: false },
            value: summary.totalUse,
        },
        {
            id: `${base}.activeUse`,
            type: 'state',
            common: { name: 'active water use', type: 'number', role: 'value.volume', unit, read: true, write: false },
            value: summary.activeUse,
        },
        {
            id: `${base}.inactiveUse`,
            type: 'state',
            common: {
                name: 'inactive water use',
                type: 'number',
                role: 'value.volume',
                unit,
                read: true,
                write: false,
            },
            value: summary.inactiveUse,
        },
        {
            id: `${base}.activeTime`,
            type: 'state',
            common: {
                name: 'active watering time',
                type: 'number',
                role: 'value',
                unit: 'seconds',
                read: true,
                write: false,
            },
            value: summary.activeTime,
        },
        {
            id: `${base}.unit`,
            type: 'state',
            common: { name: 'unit', type: 'string', role: 'text', read: true, write: false },
            value: summary.unit,
        },
    ];

    if (period === 'today') {
        nodes.push({
            id: 'water.leakSuspected',
            type: 'state',
            common: { name: 'leak suspected', type: 'boolean', role: 'indicator.alarm', read: true, write: false },
            value: summary.leakSuspected,
        });
    }

    for (const [zoneNum, use] of Object.entries(summary.byZone)) {
        nodes.push({
            id: `zones.${zoneNum}.${period}`,
            type: 'channel',
            common: { name: period },
        });
        nodes.push({
            id: `zones.${zoneNum}.${period}.activeUse`,
            type: 'state',
            common: {
                name: `${period} active water use`,
                type: 'number',
                role: 'value.volume',
                unit,
                read: true,
                write: false,
            },
            value: use.activeUse,
        });
        nodes.push({
            id: `zones.${zoneNum}.${period}.activeTime`,
            type: 'state',
            common: {
                name: `${period} active watering time`,
                type: 'number',
                role: 'value',
                unit: 'seconds',
                read: true,
                write: false,
            },
            value: use.activeTime,
        });
    }

    return nodes;
}

/**
 * GraphQL zone id keyed by zone number (for mutations).
 *
 * @param controller selected controller
 */
export function zoneIdMap(controller: any): Record<string, number> {
    const map: Record<string, number> = {};
    for (const zone of controller?.zones || []) {
        const n = zone?.number?.value;
        if (n !== undefined && n !== null && zone?.id != null) {
            map[String(n)] = Number(zone.id);
        }
    }
    return map;
}
