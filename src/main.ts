/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import axios from 'axios';

const hydrawise_url = 'https://api.hydrawise.com';
let nextpollSchedule: any = null;
let nextpollCustomer: any = null;
let resetSwitch: any = null;
const RELAYS: any = Object;

class Hydrawise extends utils.Adapter {
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'hydrawise',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        if (!this.config.apiKey) {
            this.log.error('No API-Key defined!');
        } else {
            void this.setStateChangedAsync('info.connection', false, true);

            try {
                await this.GetStatusSchedule();

                nextpollSchedule = this.setInterval(async () => {
                    await this.GetStatusSchedule();
                }, this.config.apiInterval * 1000);

                await this.GetCustomerDetails();

                nextpollCustomer = this.setInterval(
                    async () => {
                        await this.GetCustomerDetails();
                    },
                    5 * 60 * 1000,
                );
            } catch (error: any) {
                this.log.error(error.toString());
            }

            await this.subscribeStatesAsync('*');
        }
    }

    private async GetStatusSchedule(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.buildRequest('statusschedule.php', { api_key: this.config.apiKey })
                .then(async response => {
                    if (response?.status === 200) {
                        const content = response.data;

                        void this.setStateChangedAsync('info.connection', true, true);

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

                        for (let key in content) {
                            key = this.name2id(key);

                            if (key !== 'relays' && key !== 'sensors' && key !== 'expanders' && !Number.isNaN(key)) {
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

                                void this.setStateChangedAsync(`schedule.${key}`, content[key], true);

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

                                    const t = new Date(content[key] * 1000);

                                    void this.setStateChangedAsync('schedule.timestr', t.toString(), true);
                                }
                            }
                        }

                        for (const relay of content.relays) {
                            const name = relay.relay;
                            await this.setObjectNotExistsAsync(`schedule.${relay.relay}`, {
                                type: 'channel',
                                common: {
                                    name: name.toString(),
                                },
                                native: {},
                            });

                            RELAYS[relay.relay] = relay.relay_id;

                            for (let key in relay) {
                                key = this.name2id(key);

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

                                if (key === 'timestr') {
                                    const t = new Date();
                                    t.setSeconds(t.getSeconds() + relay.time);
                                    relay[key] = t.toString();
                                }

                                void this.setStateChangedAsync(`schedule.${relay.relay}.${key}`, relay[key], true);
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

                        for (const sensor of content.sensors) {
                            await this.setObjectNotExistsAsync(`schedule.sensors.${sensor.input}`, {
                                type: 'channel',
                                common: {
                                    name: 'sensors',
                                },
                                native: {},
                            });

                            for (let key in sensor) {
                                if (key !== 'relays') {
                                    key = this.name2id(key);

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

                                    void this.setStateChangedAsync(
                                        `schedule.sensors.${sensor.input}.${key}`,
                                        sensor[key],
                                        true,
                                    );
                                }
                            }
                        }
                    }

                    resolve(response.status);
                })
                .catch(error => {
                    this.clearInterval(nextpollSchedule);

                    if (
                        error.code === 'EAI_AGAIN' ||
                        error.code === 'ECONNABORTED' ||
                        error.code === 'ENOTFOUND' ||
                        error.response?.status === 429
                    ) {
                        nextpollSchedule = this.setInterval(async () => {
                            await this.GetStatusSchedule();
                        }, this.config.apiInterval * 1000);
                    } else {
                        this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);

                        void this.setStateChangedAsync('info.connection', false, true);

                        reject(new Error(error));
                    }
                });
        });
    }

    private async GetCustomerDetails(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.buildRequest('customerdetails.php', { api_key: this.config.apiKey })
                .then(async response => {
                    if (response?.status === 200) {
                        const content = response.data;

                        void this.setStateChangedAsync('info.connection', true, true);

                        for (let key in content) {
                            if (key !== 'controllers' && !Number.isNaN(key)) {
                                key = this.name2id(key);

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

                                void this.setStateChangedAsync(`customer.${key}`, content[key], true);
                            }
                        }

                        for (const controller of content.controllers) {
                            await this.setObjectNotExistsAsync(`customer.controllers.${controller.name}`, {
                                type: 'channel',
                                common: {
                                    name: controller.name,
                                },
                                native: {},
                            });

                            for (let key in controller) {
                                key = this.name2id(key);

                                await this.setObjectNotExistsAsync(`customer.controllers.${controller.name}.${key}`, {
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

                                if (key === 'last_contact') {
                                    const t = new Date(controller[key] * 1000);
                                    controller[key] = t.toString();
                                }

                                void this.setStateChangedAsync(
                                    `customer.controllers.${controller.name}.${key}`,
                                    controller[key],
                                    true,
                                );
                            }
                        }
                    }

                    resolve(response.status);
                })
                .catch(error => {
                    this.clearInterval(nextpollCustomer);

                    if (
                        error.code === 'EAI_AGAIN' ||
                        error.code === 'ECONNABORTED' ||
                        error.code === 'ENOTFOUND' ||
                        error.response?.status === 429
                    ) {
                        nextpollCustomer = this.setInterval(
                            async () => {
                                await this.GetCustomerDetails();
                            },
                            5 * 60 * 1000,
                        );
                    } else {
                        this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);

                        void this.setStateChangedAsync('info.connection', false, true);

                        reject(new Error(error));
                    }
                });
        });
    }

    buildRequest(service: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const url = `/api/v1/${service}`;
            let lastErrorCode = 0;

            if (params.api_key) {
                try {
                    axios({
                        method: 'GET',
                        baseURL: hydrawise_url,
                        url: url,
                        timeout: 30000,
                        responseType: 'json',
                        params: params,
                    })
                        .then(response => {
                            // no error - clear up reminder
                            lastErrorCode = 0;

                            resolve(response);
                        })
                        .catch(error => {
                            if (error.response) {
                                // The request was made and the server responded with a status code

                                this.log.warn(
                                    `received ${error.response.status} response from ${url} with content: ${JSON.stringify(error.response.data)}`,
                                );
                            } else if (error.request) {
                                // The request was made but no response was received
                                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                                // http.ClientRequest in node.js

                                // avoid spamming of the same error when stuck in a reconnection loop
                                if (error.code === lastErrorCode) {
                                    this.log.debug(error.message);
                                } else {
                                    this.log.info(`error ${error.code} from ${url}: ${error.message}`);
                                    lastErrorCode = error.code;
                                }
                            } else {
                                // Something happened in setting up the request that triggered an Error
                                this.log.error(error.message);
                            }

                            reject(new Error(error));
                        });
                } catch (error: any) {
                    reject(new Error(error));
                }
            } else {
                reject(new Error('API key is not configured'));
            }
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback callback function
     */
    private onUnload(callback: () => void): void {
        try {
            this.clearInterval(nextpollSchedule);
            this.clearInterval(nextpollCustomer);

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
        if (state && !state.ack) {
            if (id.indexOf('stopall') !== -1) {
                void this.buildRequest('setzone.php', { api_key: this.config.apiKey, action: 'stopall' });
            } else if (id.indexOf('stop') !== -1) {
                const relay = id.match(/.*schedule\.(.*)\.stopZone/);

                if (relay && relay?.length > 1) {
                    void this.buildRequest('setzone.php', {
                        api_key: this.config.apiKey,
                        action: 'stop',
                        relay_id: RELAYS[relay[1]],
                    });
                }
            }
            if (id.indexOf('runall') !== -1 && (state.val || state.val === 0)) {
                void this.buildRequest('setzone.php', {
                    api_key: this.config.apiKey,
                    action: 'runall',
                    period_id: 999,
                    custom: state.val,
                });
            } else if (id.indexOf('runZone') !== -1 && (state.val || state.val === 0)) {
                const relay = id.match(/.*schedule\.(.*)\.runZone/);

                if (relay && relay?.length > 1) {
                    void this.buildRequest('setzone.php', {
                        api_key: this.config.apiKey,
                        action: 'run',
                        period_id: 999,
                        custom: state.val,
                        relay_id: RELAYS[relay[1]],
                    });
                }
            }

            if (id.indexOf('runDefault') !== -1 && state.val !== null) {
                void this.initRunDefault(id, state.val as boolean);
            }

            if (id.indexOf('suspendall') !== -1 && (state.val || state.val === 0)) {
                const num = state.val as number;

                void this.buildRequest('setzone.php', {
                    api_key: this.config.apiKey,
                    action: 'suspendall',
                    period_id: 999,
                    custom: Math.trunc((state.ts + num) / 1000),
                });
            } else if (id.indexOf('suspend') !== -1 && (state.val || state.val === 0)) {
                const num = state.val as number;
                const relay = id.match(/.*schedule\.(.*)\.suspendZone/);

                if (relay && relay?.length > 1) {
                    void this.buildRequest('setzone.php', {
                        api_key: this.config.apiKey,
                        action: 'suspend',
                        period_id: 999,
                        custom: Math.trunc((state.ts + num) / 1000),
                        relay_id: RELAYS[relay[1]],
                    });
                }
            }
        }
    }

    async initRunDefault(id: string, run: boolean): Promise<void> {
        const relay = id.match(/(.*schedule.*\.)runDefault/);

        this.clearTimeout(resetSwitch);

        if (relay) {
            if (run) {
                const defaultRunTime = await this.getStateAsync(`${relay[1]}run`);
                if (defaultRunTime && defaultRunTime.val) {
                    void this.setState(`${relay[1]}runZone`, defaultRunTime.val, false);
                    resetSwitch = this.setTimeout(
                        () => {
                            void this.setState(id, false, false);
                        },
                        (defaultRunTime.val as number) * 1000,
                    );
                }
            } else {
                void this.setState(`${relay[1]}stopZone`, true, false);
            }
        }
    }

    name2id(pName: string): string {
        return (pName || '').replace(this.FORBIDDEN_CHARS, '_');
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Hydrawise(options);
} else {
    // otherwise start the instance directly
    (() => new Hydrawise())();
}
