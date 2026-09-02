/*
 * Created with @iobroker/create-adapter v2.3.0
 */

import * as utils from '@iobroker/adapter-core';
import {
    CUSTOMER_INTERVAL_MS,
    CUSTOMER_SKIP_KEYS,
    CUSTOMER_STAGGER_MS,
    HYDRAWISE_BASE_URL,
    SCHEDULE_SKIP_KEYS,
    buildHydrawiseUrl,
    getRetryAfterSec,
    isRateLimitError,
    isScalarKey,
    name2id as sanitizeId,
    nextBackoffMs,
    parseRetryAfter,
    structureSignature,
} from './lib/helpers';
import {
    HydrawiseV2Error,
    type V2Token,
    fetchAccessToken,
    graphqlRequest,
    refreshAccessToken,
    tokenNeedsRefresh,
} from './lib/v2/auth';
import {
    type MappedNode,
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
    zoneIdMap,
} from './lib/v2/mapper';
import {
    STATUS_QUERY,
    type WaterPeriod,
    nextLongPeriod,
    startAllZonesMutation,
    mutationErrorSummary,
    startZoneMutation,
    stopAllZonesMutation,
    stopZoneMutation,
    suspendAllZonesMutation,
    suspendZoneMutation,
    waterRequest,
    weatherRequest,
} from './lib/v2/queries';

interface ApiResponse {
    status: number;
    data: any;
}

class Hydrawise extends utils.Adapter {
    private pollScheduleTimer?: ioBroker.Interval;
    private pollCustomerTimer?: ioBroker.Timeout;
    private pollV2Timer?: ioBroker.Timeout;
    private resetSwitchTimer?: ioBroker.Timeout;
    private relays: Record<string, number> = {};
    private lastErrorCode: string | number = 0;
    private schedulePollRunning = false;
    private customerPollRunning = false;
    private scheduleStructureKey = '';
    private customerStructureKey = '';
    private scheduleObjectsReady = false;
    private customerObjectsReady = false;
    private customerBackoffFails = 0;
    private lastCustomerCallAt = 0;
    private v1ControllerId?: number;
    private v2Token: V2Token | null = null;
    private v2PollRunning = false;
    private v2BackoffFails = 0;
    private v2LongPeriodIndex = 0;
    private v2ControllerId?: number;
    private v2ZoneIds: Record<string, number> = {};
    private v2LastRetryAfter?: number;
    private v2StructureSig = '';
    private v2ObjectsReady = false;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'hydrawise',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private isV1Enabled(): boolean {
        return this.config.enableV1 !== false;
    }

    private async onReady(): Promise<void> {
        const v1 = this.isV1Enabled();
        const v2 = !!this.config.enableV2;

        if (!v1 && !v2) {
            this.log.error('Neither v1 nor v2 API is enabled');
            return;
        }

        void this.setStateChangedAsync('info.connection', false, true);

        if (v1) {
            if (!this.config.apiKey) {
                this.log.error('No API-Key defined!');
            } else {
                await this.GetStatusSchedule();
                this.pollScheduleTimer = this.setInterval(() => {
                    void this.GetStatusSchedule();
                }, this.config.apiInterval * 1000);

                this.scheduleCustomerPoll(CUSTOMER_STAGGER_MS);
                await this.subscribeV1Commands();
            }
        }

        if (v2) {
            if (!this.config.v2Username || !this.config.v2Password) {
                this.log.error('v2 API enabled but username or password is missing');
            } else {
                await this.subscribeV2Commands();
                void this.setStateChangedAsync('info.connectionV2', false, true);
                this.scheduleV2Poll(0);
            }
        }
    }

    private async GetStatusSchedule(): Promise<void> {
        if (this.schedulePollRunning) {
            this.log.debug('Skipping overlapping status schedule poll');
            return;
        }

        this.schedulePollRunning = true;
        try {
            const response = await this.buildRequest('statusschedule.php', { api_key: this.config.apiKey });
            if (response.status !== 200) {
                return;
            }

            const content = response.data;
            void this.setStateChangedAsync('info.connection', true, true);

            const relayIds = (content.relays || []).map((r: any) => r.relay);
            const sensorInputs = (content.sensors || []).map((s: any) => s.input);
            const nextStructureKey = structureSignature(relayIds, sensorInputs);
            const needObjects = !this.scheduleObjectsReady || this.scheduleStructureKey !== nextStructureKey;

            if (needObjects) {
                await this.ensureScheduleObjects(content);
                this.scheduleStructureKey = nextStructureKey;
                this.scheduleObjectsReady = true;
            }

            this.updateScheduleStates(content);
        } catch (error: any) {
            this.log.debug(`(schedule) received error - API is now offline: ${error?.message || error}`);
            void this.setStateChangedAsync('info.connection', false, true);
        } finally {
            this.schedulePollRunning = false;
        }
    }

    private async ensureScheduleObjects(content: any): Promise<void> {
        await this.setObjectNotExistsAsync('schedule.stopall', {
            type: 'state',
            common: {
                name: {
                    en: 'stop all zones',
                    de: 'alle Zonen stoppen',
                    ru: 'остановить все зоны',
                    pt: 'parar todas as zonas',
                    nl: 'stop alle zones',
                    fr: 'arrêter toutes les zones',
                    it: 'fermare tutte le zone',
                    es: 'detener todas las zonas',
                    pl: 'zatrzymują wszystkie strefy',
                    uk: 'зупинити всі зони',
                    'zh-cn': '停止所有地区',
                },
                type: 'boolean',
                role: 'button.stop',
                read: false,
                write: true,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('schedule.runall', {
            type: 'state',
            common: {
                name: {
                    en: 'run all zones for x seconds',
                    de: 'alle Zonen für x Sekunden ausführen',
                    ru: 'запустить все зоны за x секунды',
                    pt: 'executar todas as zonas por x segundos',
                    nl: 'ren alle zones voor x seconden',
                    fr: 'exécuter toutes les zones pendant x secondes',
                    it: 'eseguire tutte le zone per x secondi',
                    es: 'ejecutar todas las zonas durante x segundos',
                    pl: 'wszystkie strefy startują dla x sekundy',
                    uk: 'запустити всі зони для x секунд',
                    'zh-cn': '跑道区',
                },
                type: 'number',
                role: 'level',
                unit: 'seconds',
                read: true,
                write: true,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('schedule.suspendall', {
            type: 'state',
            common: {
                name: {
                    en: 'suspend all zones for x seconds',
                    de: 'alle Zonen für x Sekunden aussetzen',
                    ru: 'приостановить все зоны за x секунды',
                    pt: 'suspender todas as zonas por x segundos',
                    nl: 'vertaling:',
                    fr: 'suspendre toutes les zones pendant x secondes',
                    it: 'sospendere tutte le zone per x secondi',
                    es: 'suspender todas las zonas durante x segundos',
                    pl: 'wszystkie strefy zawieszenia dla x sekundy',
                    uk: 'призупинити всі зони на x секунд',
                    'zh-cn': '停止所有×二区',
                },
                type: 'number',
                role: 'level',
                read: true,
                write: true,
            },
            native: {},
        });

        for (const rawKey of Object.keys(content)) {
            const key = this.name2id(rawKey);
            if (!isScalarKey(key, SCHEDULE_SKIP_KEYS)) {
                continue;
            }

            await this.setObjectNotExistsAsync(`schedule.${key}`, {
                type: 'state',
                common: {
                    name: key,
                    type: key === 'message' ? 'string' : 'number',
                    role: key === 'message' ? 'text' : 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });

            if (key === 'time') {
                await this.setObjectNotExistsAsync('schedule.timestr', {
                    type: 'state',
                    common: {
                        name: 'last api call',
                        type: 'string',
                        role: 'text',
                        read: true,
                        write: false,
                    },
                    native: {},
                });
            }
        }

        for (const relay of content.relays || []) {
            await this.setObjectNotExistsAsync(`schedule.${relay.relay}`, {
                type: 'channel',
                common: {
                    name: String(relay.relay),
                },
                native: {},
            });

            for (const rawKey of Object.keys(relay)) {
                const key = this.name2id(rawKey);
                await this.setObjectNotExistsAsync(`schedule.${relay.relay}.${key}`, {
                    type: 'state',
                    common: {
                        name: key,
                        type: key === 'name' || key === 'timestr' ? 'string' : 'number',
                        role: key === 'name' || key === 'timestr' ? 'text' : 'value',
                        read: true,
                        write: false,
                    },
                    native: {},
                });
            }

            await this.setObjectNotExistsAsync(`schedule.${relay.relay}.stopZone`, {
                type: 'state',
                common: {
                    name: {
                        en: 'stop zone',
                        de: 'Zone stoppen',
                        ru: 'зона остановки',
                        pt: 'zona de paragem',
                        nl: 'stop zone',
                        fr: "zone d ' arrêt",
                        it: 'zona di sosta',
                        es: 'zona de parada',
                        pl: 'strefa stopu',
                        uk: 'зона зупинки',
                        'zh-cn': '停止地区',
                    },
                    type: 'boolean',
                    role: 'button.stop',
                    read: false,
                    write: true,
                },
                native: {},
            });

            await this.setObjectNotExistsAsync(`schedule.${relay.relay}.runZone`, {
                type: 'state',
                common: {
                    name: {
                        en: 'run zone for x seconds',
                        de: 'Zone für x Sekunden starten',
                        ru: 'запустить зону за x секунды',
                        pt: 'zona de execução por x segundos',
                        nl: 'ren zone voor x seconden',
                        fr: 'zone de course pour x secondes',
                        it: 'zona di corsa per x secondi',
                        es: 'zona de ejecución por x segundos',
                        pl: 'strefa x sekundy',
                        uk: 'зона запуску для x секунд',
                        'zh-cn': '×二区',
                    },
                    type: 'number',
                    role: 'level',
                    read: true,
                    write: true,
                },
                native: {},
            });

            await this.setObjectNotExistsAsync(`schedule.${relay.relay}.suspendZone`, {
                type: 'state',
                common: {
                    name: {
                        en: 'suspend zone for x seconds',
                        de: 'Zone für x Sekunden aussetzen',
                        ru: 'приостановить зону на x секунды',
                        pt: 'zona de suspensão por x segundos',
                        nl: 'quality over quantity (qoq) releases vertaling:',
                        fr: 'zone de suspension pour x secondes',
                        it: 'zona di sospensione per x secondi',
                        es: 'zona de suspensión por x segundos',
                        pl: 'strefa zawiesła na x sekundy',
                        uk: 'зона підвіски для x секунд',
                        'zh-cn': '停止x二区',
                    },
                    type: 'number',
                    role: 'level',
                    read: true,
                    write: true,
                },
                native: {},
            });

            await this.setObjectNotExistsAsync(`schedule.${relay.relay}.runDefault`, {
                type: 'state',
                common: {
                    name: {
                        en: 'run zone for default time',
                        de: 'Zone mit Standardlaufzeit starten',
                        ru: 'запустить зону для времени по умолчанию',
                        pt: 'fuso de execução para o tempo padrão',
                        nl: 'run zone for default time',
                        fr: 'run zone for default time',
                        it: 'run zone per il tempo predefinito',
                        es: 'zona de ejecución por tiempo predeterminado',
                        pl: 'strefa czasu domyślnego',
                        uk: 'зона запуску за замовчуванням',
                        'zh-cn': 'a. 暂停时间区',
                    },
                    type: 'boolean',
                    role: 'button.start',
                    read: true,
                    write: true,
                },
                native: {},
            });
        }

        for (const sensor of content.sensors || []) {
            await this.setObjectNotExistsAsync(`schedule.sensors.${sensor.input}`, {
                type: 'channel',
                common: {
                    name: 'sensors',
                },
                native: {},
            });

            for (const rawKey of Object.keys(sensor)) {
                if (rawKey === 'relays') {
                    continue;
                }
                const key = this.name2id(rawKey);
                await this.setObjectNotExistsAsync(`schedule.sensors.${sensor.input}.${key}`, {
                    type: 'state',
                    common: {
                        name: key,
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: false,
                    },
                    native: {},
                });
            }
        }
    }

    private updateScheduleStates(content: any): void {
        for (const rawKey of Object.keys(content)) {
            const key = this.name2id(rawKey);
            if (!isScalarKey(key, SCHEDULE_SKIP_KEYS)) {
                continue;
            }

            void this.setStateChangedAsync(`schedule.${key}`, content[rawKey], true);

            if (key === 'time') {
                const t = new Date(content[rawKey] * 1000);
                void this.setStateChangedAsync('schedule.timestr', t.toString(), true);
            }
        }

        for (const relay of content.relays || []) {
            this.relays[relay.relay] = relay.relay_id;

            for (const rawKey of Object.keys(relay)) {
                const key = this.name2id(rawKey);
                let value = relay[rawKey];

                if (key === 'timestr') {
                    const t = new Date();
                    t.setSeconds(t.getSeconds() + relay.time);
                    value = t.toString();
                }

                void this.setStateChangedAsync(`schedule.${relay.relay}.${key}`, value, true);
            }
        }

        for (const sensor of content.sensors || []) {
            for (const rawKey of Object.keys(sensor)) {
                if (rawKey === 'relays') {
                    continue;
                }
                const key = this.name2id(rawKey);
                void this.setStateChangedAsync(`schedule.sensors.${sensor.input}.${key}`, sensor[rawKey], true);
            }
        }
    }

    private scheduleCustomerPoll(delayMs: number): void {
        if (this.pollCustomerTimer) {
            this.clearTimeout(this.pollCustomerTimer);
        }
        this.pollCustomerTimer = this.setTimeout(
            () => {
                this.pollCustomerTimer = undefined;
                void this.runCustomerPoll();
            },
            Math.max(0, delayMs),
        );
    }

    private async runCustomerPoll(): Promise<void> {
        const delay = await this.GetCustomerDetails();
        this.scheduleCustomerPoll(delay);
    }

    private async GetCustomerDetails(): Promise<number> {
        if (this.customerPollRunning) {
            this.log.debug('Skipping overlapping customer details poll');
            return CUSTOMER_INTERVAL_MS;
        }

        const elapsed = this.lastCustomerCallAt ? Date.now() - this.lastCustomerCallAt : CUSTOMER_INTERVAL_MS;
        if (this.lastCustomerCallAt && elapsed < CUSTOMER_INTERVAL_MS) {
            this.log.debug('Skipping customer details poll (inside 5 minute window)');
            return CUSTOMER_INTERVAL_MS - elapsed;
        }

        this.customerPollRunning = true;
        this.lastCustomerCallAt = Date.now();
        try {
            const response = await this.buildRequest('customerdetails.php', { api_key: this.config.apiKey });
            if (response.status !== 200) {
                return CUSTOMER_INTERVAL_MS;
            }

            const content = response.data;
            this.customerBackoffFails = 0;
            if (content?.controller_id != null) {
                this.v1ControllerId = Number(content.controller_id);
            }

            const controllerNames = (content.controllers || []).map((c: any) => this.name2id(c.name));
            const nextStructureKey = structureSignature([], [], controllerNames);
            const needObjects = !this.customerObjectsReady || this.customerStructureKey !== nextStructureKey;

            if (needObjects) {
                await this.ensureCustomerObjects(content);
                this.customerStructureKey = nextStructureKey;
                this.customerObjectsReady = true;
            }

            this.updateCustomerStates(content);
            return CUSTOMER_INTERVAL_MS;
        } catch (error: any) {
            if (isRateLimitError(error)) {
                this.customerBackoffFails += 1;
                const delay = nextBackoffMs(this.customerBackoffFails, getRetryAfterSec(error));
                this.log.warn(
                    `customerdetails rate limited, next poll in ${Math.round(delay / 1000)}s (attempt ${this.customerBackoffFails})`,
                );
                return delay;
            }

            this.log.debug(`(customer) received error: ${error?.message || error}`);
            return CUSTOMER_INTERVAL_MS;
        } finally {
            this.customerPollRunning = false;
        }
    }

    private async ensureCustomerObjects(content: any): Promise<void> {
        for (const rawKey of Object.keys(content)) {
            if (!isScalarKey(rawKey, CUSTOMER_SKIP_KEYS)) {
                continue;
            }
            const key = this.name2id(rawKey);

            await this.setObjectNotExistsAsync(`customer.${key}`, {
                type: 'state',
                common: {
                    name: key,
                    type: key === 'message' || key === 'current_controller' ? 'string' : 'number',
                    role: key === 'message' || key === 'current_controller' ? 'text' : 'value',
                    read: true,
                    write: false,
                },
                native: {},
            });
        }

        for (const controller of content.controllers || []) {
            const controllerId = this.name2id(controller.name);
            await this.setObjectNotExistsAsync(`customer.controllers.${controllerId}`, {
                type: 'channel',
                common: {
                    name: controller.name,
                },
                native: {},
            });

            for (const rawKey of Object.keys(controller)) {
                const key = this.name2id(rawKey);
                await this.setObjectNotExistsAsync(`customer.controllers.${controllerId}.${key}`, {
                    type: 'state',
                    common: {
                        name: key,
                        type: key !== 'controller_id' ? 'string' : 'number',
                        role: key !== 'controller_id' ? 'text' : 'value',
                        read: true,
                        write: false,
                    },
                    native: {},
                });
            }
        }
    }

    private updateCustomerStates(content: any): void {
        for (const rawKey of Object.keys(content)) {
            if (!isScalarKey(rawKey, CUSTOMER_SKIP_KEYS)) {
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

                if (key === 'last_contact') {
                    const t = new Date(controller[rawKey] * 1000);
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
    async buildRequest(service: string, params: Record<string, string | number | boolean>): Promise<ApiResponse> {
        if (!params.api_key) {
            throw new Error('API key is not configured');
        }

        const url = buildHydrawiseUrl(service, params);
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 30_000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: abort.signal,
                headers: { Accept: 'application/json' },
            });

            this.lastErrorCode = 0;

            let data: any = null;
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
                    `received ${response.status} response from /api/v1/${service} with content: ${JSON.stringify(data)}`,
                );
                throw Object.assign(new Error(`HTTP ${response.status}`), {
                    code: response.status,
                    retryAfter: parseRetryAfter(response.headers.get('Retry-After')),
                    response: { status: response.status, data },
                });
            }

            return { status: response.status, data };
        } catch (error: any) {
            if (error?.response) {
                // already logged above for HTTP errors
            } else if (error?.name === 'AbortError') {
                const code = 'ECONNABORTED';
                if (code === this.lastErrorCode) {
                    this.log.debug(`timeout from ${HYDRAWISE_BASE_URL}/api/v1/${service}`);
                } else {
                    this.log.info(`error ${code} from /api/v1/${service}: request timed out`);
                    this.lastErrorCode = code;
                }
                throw Object.assign(new Error('request timed out'), { code });
            } else if (error?.message) {
                const code = error.code || error.cause?.code || 'ENOTFOUND';
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
    private onUnload(callback: () => void): void {
        try {
            if (this.pollScheduleTimer) {
                this.clearInterval(this.pollScheduleTimer);
                this.pollScheduleTimer = undefined;
            }
            if (this.pollCustomerTimer) {
                this.clearTimeout(this.pollCustomerTimer);
                this.pollCustomerTimer = undefined;
            }
            if (this.pollV2Timer) {
                this.clearTimeout(this.pollV2Timer);
                this.pollV2Timer = undefined;
            }
            if (this.resetSwitchTimer) {
                this.clearTimeout(this.resetSwitchTimer);
                this.resetSwitchTimer = undefined;
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
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state) {
            return;
        }
        if (state.ack && state.from === `system.adapter.${this.namespace}`) {
            return;
        }
        void this.handleStateChange(id, state);
    }

    private async handleStateChange(id: string, state: ioBroker.State): Promise<void> {
        try {
            if (id.includes('.zones.')) {
                await this.handleV2Command(id, state);
                return;
            }
            if (!this.isV1Enabled() || !id.includes('.schedule.')) {
                return;
            }

            let commandSent = false;

            if (id.includes('stopall')) {
                await this.buildRequest('setzone.php', { api_key: this.config.apiKey, action: 'stopall' });
                commandSent = true;
            } else if (id.includes('stopZone')) {
                const relay = id.match(/.*schedule\.(.*)\.stopZone/);
                if (relay && relay.length > 1) {
                    await this.buildRequest('setzone.php', {
                        api_key: this.config.apiKey,
                        action: 'stop',
                        relay_id: this.relays[relay[1]],
                    });
                    commandSent = true;
                }
            }

            if (id.includes('runall') && (state.val || state.val === 0)) {
                await this.buildRequest('setzone.php', {
                    api_key: this.config.apiKey,
                    action: 'runall',
                    period_id: 999,
                    custom: state.val,
                });
                commandSent = true;
            } else if (id.includes('runZone') && (state.val || state.val === 0)) {
                const relay = id.match(/.*schedule\.(.*)\.runZone/);
                if (relay && relay.length > 1) {
                    await this.buildRequest('setzone.php', {
                        api_key: this.config.apiKey,
                        action: 'run',
                        period_id: 999,
                        custom: state.val,
                        relay_id: this.relays[relay[1]],
                    });
                    commandSent = true;
                }
            }

            if (id.includes('runDefault') && state.val !== null) {
                await this.initRunDefault(id, state.val as boolean);
                commandSent = true;
            }

            if (id.includes('suspendall') && (state.val || state.val === 0)) {
                const num = state.val as number;
                await this.buildRequest('setzone.php', {
                    api_key: this.config.apiKey,
                    action: 'suspendall',
                    period_id: 999,
                    custom: Math.trunc((state.ts + num) / 1000),
                });
                commandSent = true;
            } else if (id.includes('suspendZone') && (state.val || state.val === 0)) {
                const num = state.val as number;
                const relay = id.match(/.*schedule\.(.*)\.suspendZone/);
                if (relay && relay.length > 1) {
                    await this.buildRequest('setzone.php', {
                        api_key: this.config.apiKey,
                        action: 'suspend',
                        period_id: 999,
                        custom: Math.trunc((state.ts + num) / 1000),
                        relay_id: this.relays[relay[1]],
                    });
                    commandSent = true;
                }
            }

            if (commandSent && !id.includes('runDefault')) {
                await this.GetStatusSchedule();
            }
        } catch (error: any) {
            this.log.error(`Command failed for ${id}: ${error?.message || error}`);
        }
    }

    async initRunDefault(id: string, run: boolean): Promise<void> {
        const relay = id.match(/(.*schedule.*\.)runDefault/);

        if (this.resetSwitchTimer) {
            this.clearTimeout(this.resetSwitchTimer);
            this.resetSwitchTimer = undefined;
        }

        if (relay) {
            if (run) {
                const defaultRunTime = await this.getStateAsync(`${relay[1]}run`);
                if (defaultRunTime && defaultRunTime.val) {
                    void this.setState(`${relay[1]}runZone`, defaultRunTime.val, false);
                    this.resetSwitchTimer = this.setTimeout(
                        () => {
                            void this.setState(id, false, true);
                            this.resetSwitchTimer = undefined;
                        },
                        (defaultRunTime.val as number) * 1000,
                    );
                }
            } else {
                void this.setState(`${relay[1]}stopZone`, true, false);
            }
        }
    }

    private async subscribeV1Commands(): Promise<void> {
        await this.subscribeStatesAsync('schedule.stopall');
        await this.subscribeStatesAsync('schedule.runall');
        await this.subscribeStatesAsync('schedule.suspendall');
        await this.subscribeStatesAsync('schedule.*.stopZone');
        await this.subscribeStatesAsync('schedule.*.runZone');
        await this.subscribeStatesAsync('schedule.*.suspendZone');
        await this.subscribeStatesAsync('schedule.*.runDefault');
    }

    private async subscribeV2Commands(): Promise<void> {
        await this.subscribeStatesAsync('zones.stopall');
        await this.subscribeStatesAsync('zones.runall');
        await this.subscribeStatesAsync('zones.suspendall');
        await this.subscribeStatesAsync('zones.*.stopZone');
        await this.subscribeStatesAsync('zones.*.runZone');
        await this.subscribeStatesAsync('zones.*.suspendZone');
        await this.subscribeStatesAsync('zones.*.runDefault');
    }

    private v2IntervalMs(): number {
        return Math.max(120, Number(this.config.apiIntervalV2) || 300) * 1000;
    }

    private scheduleV2Poll(delayMs: number): void {
        if (this.pollV2Timer) {
            this.clearTimeout(this.pollV2Timer);
        }
        this.pollV2Timer = this.setTimeout(
            () => {
                this.pollV2Timer = undefined;
                void this.runV2Poll();
            },
            Math.max(0, delayMs),
        );
    }

    private async runV2Poll(statusOnly = false): Promise<void> {
        if (this.v2PollRunning) {
            this.log.debug('Skipping overlapping v2 poll');
            return;
        }

        this.v2PollRunning = true;
        let delay = this.v2IntervalMs();
        try {
            const statusResult = await this.pollV2Status();
            if (statusResult === 'rate-limit') {
                this.v2BackoffFails += 1;
                delay = nextBackoffMs(this.v2BackoffFails, this.v2LastRetryAfter);
                this.log.warn(`v2 rate limited, next poll in ${Math.round(delay / 1000)}s`);
                return;
            }

            if (statusOnly || !this.v2ControllerId) {
                return;
            }

            const weatherResult = await this.pollV2Weather();
            if (weatherResult === 'rate-limit') {
                this.v2BackoffFails += 1;
                delay = nextBackoffMs(this.v2BackoffFails, this.v2LastRetryAfter);
                this.log.warn(`v2 rate limited, next poll in ${Math.round(delay / 1000)}s`);
                return;
            }

            const todayResult = await this.pollV2Water('today');
            if (todayResult === 'rate-limit') {
                this.v2BackoffFails += 1;
                delay = nextBackoffMs(this.v2BackoffFails, this.v2LastRetryAfter);
                this.log.warn(`v2 rate limited, next poll in ${Math.round(delay / 1000)}s`);
                return;
            }

            const { period, nextIndex } = nextLongPeriod(this.v2LongPeriodIndex);
            const longResult = await this.pollV2Water(period);
            if (longResult === 'rate-limit') {
                this.v2BackoffFails += 1;
                delay = nextBackoffMs(this.v2BackoffFails, this.v2LastRetryAfter);
                this.log.warn(`v2 rate limited, next poll in ${Math.round(delay / 1000)}s`);
                return;
            }
            this.v2LongPeriodIndex = nextIndex;
            this.v2BackoffFails = 0;
        } finally {
            this.v2PollRunning = false;
            if (!statusOnly) {
                this.scheduleV2Poll(delay);
            }
        }
    }

    private async ensureV2Token(): Promise<V2Token> {
        if (tokenNeedsRefresh(this.v2Token)) {
            if (this.v2Token?.refreshToken) {
                try {
                    this.v2Token = await refreshAccessToken(this.v2Token.refreshToken);
                } catch {
                    this.v2Token = await fetchAccessToken(this.config.v2Username, this.config.v2Password);
                }
            } else {
                this.v2Token = await fetchAccessToken(this.config.v2Username, this.config.v2Password);
            }
        }
        if (!this.v2Token) {
            throw new HydrawiseV2Error('No v2 token', 'unauthorized');
        }
        return this.v2Token;
    }

    private async v2Graphql(request: { query: string; variables?: Record<string, unknown> }): Promise<any> {
        const token = await this.ensureV2Token();
        try {
            return await graphqlRequest(token, request);
        } catch (error) {
            if (error instanceof HydrawiseV2Error && error.code === 401) {
                this.v2Token = await fetchAccessToken(this.config.v2Username, this.config.v2Password);
                return await graphqlRequest(this.v2Token, request);
            }
            throw error;
        }
    }

    private async v2Mutate(request: { query: string; variables?: Record<string, unknown> }): Promise<any> {
        const data = await this.v2Graphql(request);
        const failed = mutationErrorSummary(data);
        if (failed) {
            throw new HydrawiseV2Error(failed, 'mutation', data);
        }
        return data;
    }

    private async applyMappedNodes(nodes: MappedNode[], createObjects: boolean): Promise<void> {
        for (const node of nodes) {
            if (createObjects) {
                await this.setObjectNotExistsAsync(node.id, {
                    type: node.type,
                    common: node.common as any,
                    native: {},
                });
            }
            if (node.type === 'state' && node.value !== undefined) {
                void this.setStateChangedAsync(node.id, node.value, true);
            }
        }
    }

    private async pollV2Status(): Promise<'ok' | 'rate-limit' | 'error'> {
        try {
            const data = await this.v2Graphql({ query: STATUS_QUERY });
            const controller = pickController(
                data?.me?.controllers,
                data?.me?.currentController?.id,
                this.v1ControllerId,
            );
            if (!controller) {
                this.log.warn('v2 status: no controller in response');
                void this.setStateChangedAsync('info.connectionV2', false, true);
                return 'error';
            }

            this.v2ControllerId = Number(controller.id);
            this.v2ZoneIds = zoneIdMap(controller);

            const nextKey = v2StructureKey(controller);
            const needObjects = !this.v2ObjectsReady || this.v2StructureSig !== nextKey;
            if (needObjects) {
                await this.applyMappedNodes(mapAllZoneCommandObjects(), true);
                for (const zone of controller.zones || []) {
                    const n = zone?.number?.value;
                    if (n !== undefined && n !== null) {
                        await this.applyMappedNodes(mapZoneCommandObjects(n), true);
                    }
                }
                this.v2StructureSig = nextKey;
                this.v2ObjectsReady = true;
                await this.subscribeV2Commands();
            }

            await this.applyMappedNodes(mapControllerStates(controller), needObjects);
            for (const zone of controller.zones || []) {
                await this.applyMappedNodes(mapZoneStates(zone), needObjects);
            }
            for (const sensor of controller.sensors || []) {
                await this.applyMappedNodes(mapSensorStates(sensor), needObjects);
            }

            void this.setStateChangedAsync('info.connectionV2', true, true);
            return 'ok';
        } catch (error: any) {
            this.v2LastRetryAfter = getRetryAfterSec(error);
            this.log.debug(`v2 status: ${error?.message || error}`);
            void this.setStateChangedAsync('info.connectionV2', false, true);
            return isRateLimitError(error) ? 'rate-limit' : 'error';
        }
    }

    private async pollV2Weather(): Promise<'ok' | 'rate-limit' | 'error'> {
        if (!this.v2ControllerId) {
            return 'error';
        }
        try {
            const data = await this.v2Graphql(weatherRequest(this.v2ControllerId));
            await this.applyMappedNodes(mapWeatherStates(data?.controller?.location?.forecast), true);
            return 'ok';
        } catch (error: any) {
            this.v2LastRetryAfter = getRetryAfterSec(error);
            this.log.debug(`v2 weather: ${error?.message || error}`);
            return isRateLimitError(error) ? 'rate-limit' : 'error';
        }
    }

    private async pollV2Water(period: WaterPeriod): Promise<'ok' | 'rate-limit' | 'error'> {
        if (!this.v2ControllerId) {
            return 'error';
        }
        try {
            const request = waterRequest(this.v2ControllerId, period);
            const data = await this.v2Graphql(request);
            const summary = computeWaterSummary(data?.controller);
            await this.applyMappedNodes(mapWaterStates(period, summary), true);
            return 'ok';
        } catch (error: any) {
            this.v2LastRetryAfter = getRetryAfterSec(error);
            this.log.debug(`v2 water (${period}): ${error?.message || error}`);
            return isRateLimitError(error) ? 'rate-limit' : 'error';
        }
    }

    private async handleV2Command(id: string, state: ioBroker.State): Promise<void> {
        if (!this.config.enableV2) {
            return;
        }
        if (!this.v2ControllerId) {
            this.log.warn('v2 command ignored: controller id is unknown');
            return;
        }

        try {
            let sent = false;
            const zoneMatch = id.match(/\.zones\.(\d+)\.(stopZone|runZone|suspendZone|runDefault)$/);

            if (id.endsWith('.zones.stopall')) {
                await this.v2Mutate(stopAllZonesMutation(this.v2ControllerId));
                sent = true;
            } else if (id.endsWith('.zones.runall') && (state.val || state.val === 0)) {
                await this.v2Mutate(startAllZonesMutation(this.v2ControllerId, Number(state.val)));
                sent = true;
            } else if (id.endsWith('.zones.suspendall') && (state.val || state.val === 0)) {
                const until = new Date(state.ts + Number(state.val) * 1000);
                await this.v2Mutate(suspendAllZonesMutation(this.v2ControllerId, until));
                sent = true;
            } else if (zoneMatch) {
                const zoneId = this.v2ZoneIds[zoneMatch[1]];
                if (!zoneId) {
                    this.log.warn(`v2 command ignored: unknown zone ${zoneMatch[1]}`);
                    return;
                }
                const action = zoneMatch[2];
                if (action === 'stopZone') {
                    await this.v2Mutate(stopZoneMutation(zoneId));
                    sent = true;
                } else if (action === 'runZone' && (state.val || state.val === 0)) {
                    this.log.info(`v2 start zone ${zoneMatch[1]} for ${Number(state.val)}s`);
                    await this.v2Mutate(startZoneMutation(zoneId, Number(state.val)));
                    sent = true;
                } else if (action === 'runDefault' && state.val) {
                    this.log.info(`v2 start zone ${zoneMatch[1]} with default duration`);
                    await this.v2Mutate(startZoneMutation(zoneId));
                    void this.setState(id, false, true);
                    sent = true;
                } else if (action === 'suspendZone' && (state.val || state.val === 0)) {
                    const until = new Date(state.ts + Number(state.val) * 1000);
                    await this.v2Mutate(suspendZoneMutation(zoneId, until));
                    sent = true;
                }
            }

            if (sent) {
                if (zoneMatch?.[2] !== 'runDefault') {
                    void this.setState(id, state.val, true);
                }
                await this.pollV2Status();
            }
        } catch (error: any) {
            if (isRateLimitError(error)) {
                this.v2BackoffFails += 1;
                const delay = nextBackoffMs(this.v2BackoffFails, getRetryAfterSec(error));
                this.log.warn(`v2 command rate limited, delaying poll by ${Math.round(delay / 1000)}s`);
                this.scheduleV2Poll(delay);
                return;
            }
            this.log.error(`v2 command failed for ${id}: ${error?.message || error}`);
        }
    }

    name2id(pName: string): string {
        return sanitizeId(pName, this.FORBIDDEN_CHARS);
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Hydrawise(options);
} else {
    // otherwise start the instance directly
    (() => new Hydrawise())();
}
