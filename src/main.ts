/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import axios from "axios";

const hydrawise_url = "https://api.hydrawise.com";
let nextpollSchedule: any = null;
let nextpollCustomer: any = null;
const RELAYS: any = Object;

class Hydrawise extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "hydrawise",
		});

		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
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

	private async GetStatusSchedule(apiKey: string): Promise<void> {
		return new Promise((resolve, reject) => {
			nextpollSchedule =
				nextpollSchedule ||
				this.setTimeout(() => {
					nextpollSchedule = null;
					this.GetStatusSchedule(apiKey);
				}, 5 * 60 * 1000);

			this.buildRequest("statusschedule.php", { api_key: this.config.apiKey })
				.then(async (response) => {
					if (response.status === 200) {
						const content = response.data;

						this.setStateChangedAsync("info.connection", true, true);

						await this.setObjectNotExistsAsync("schedule.stopall", {
							type: "state",
							common: {
								name: {
									en: "stop all zones",
									de: "alle Zonen stoppen",
									ru: "остановить все зоны",
									pt: "parar todas as zonas",
									nl: "stop alle zones",
									fr: "arrêter toutes les zones",
									it: "fermare tutte le zone",
									es: "detener todas las zonas",
									pl: "zatrzymują wszystkie strefy",
									uk: "зупинити всі зони",
									"zh-cn": "停止所有地区",
								},
								type: "boolean",
								role: "button",
								read: false,
								write: true,
							},
							native: {},
						});

						await this.setObjectNotExistsAsync("schedule.runall", {
							type: "state",
							common: {
								name: {
									en: "run all zones for x seconds",
									de: "alle Zonen für x Sekunden ausführen",
									ru: "запустить все зоны за x секунды",
									pt: "executar todas as zonas por x segundos",
									nl: "ren alle zones voor x seconden",
									fr: "exécuter toutes les zones pendant x secondes",
									it: "eseguire tutte le zone per x secondi",
									es: "ejecutar todas las zonas durante x segundos",
									pl: "wszystkie strefy startują dla x sekundy",
									uk: "запустити всі зони для x секунд",
									"zh-cn": "跑道区",
								},
								type: "number",
								role: "value",
								unit: "seconds",
								read: false,
								write: true,
							},
							native: {},
						});

						await this.setObjectNotExistsAsync("schedule.suspendall", {
							type: "state",
							common: {
								name: {
									en: "suspend all zones for x seconds",
									de: "alle Zonen für x Sekunden aussetzen",
									ru: "приостановить все зоны за x секунды",
									pt: "suspender todas as zonas por x segundos",
									nl: "vertaling:",
									fr: "suspendre toutes les zones pendant x secondes",
									it: "sospendere tutte le zone per x secondi",
									es: "suspender todas las zonas durante x segundos",
									pl: "wszystkie strefy zawieszenia dla x sekundy",
									uk: "призупинити всі зони на x секунд",
									"zh-cn": "停止所有×二区",
								},
								type: "number",
								role: "value",
								read: false,
								write: true,
							},
							native: {},
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
										write: false,
									},
									native: {},
								});

								this.setStateChangedAsync(`schedule.${key}`, content[key], true);
							}
						}

						for (const relay of content.relays) {
							const name = relay.relay;
							await this.setObjectNotExistsAsync(`schedule.${relay.relay}`, {
								type: "channel",
								common: {
									name: name.toString(),
								},
								native: {},
							});

							RELAYS[relay.relay] = relay.relay_id;

							for (const key in relay) {
								await this.setObjectNotExistsAsync(`schedule.${relay.relay}.${key}`, {
									type: "state",
									common: {
										name: key,
										type: key === "name" || key === "timestr" ? "string" : "number",
										role: key === "name" || key === "timestr" ? "text" : "value",
										read: true,
										write: false,
									},
									native: {},
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
										ru: "зона остановки",
										pt: "zona de paragem",
										nl: "stop zone",
										fr: "zone d ' arrêt",
										it: "zona di sosta",
										es: "zona de parada",
										pl: "strefa stopu",
										uk: "зона зупинки",
										"zh-cn": "停止地区",
									},
									type: "boolean",
									role: "button",
									read: false,
									write: true,
								},
								native: {},
							});

							await this.setObjectNotExistsAsync(`schedule.${relay.relay}.runZone`, {
								type: "state",
								common: {
									name: {
										en: "run zone for x seconds",
										de: "Zone für x Sekunden starten",
										ru: "запустить зону за x секунды",
										pt: "zona de execução por x segundos",
										nl: "ren zone voor x seconden",
										fr: "zone de course pour x secondes",
										it: "zona di corsa per x secondi",
										es: "zona de ejecución por x segundos",
										pl: "strefa x sekundy",
										uk: "зона запуску для x секунд",
										"zh-cn": "×二区",
									},
									type: "number",
									role: "value",
									read: false,
									write: true,
								},
								native: {},
							});

							await this.setObjectNotExistsAsync(`schedule.${relay.relay}.suspendZone`, {
								type: "state",
								common: {
									name: {
										en: "suspend zone for x seconds",
										de: "Zone für x Sekunden aussetzen",
										ru: "приостановить зону на x секунды",
										pt: "zona de suspensão por x segundos",
										nl: "quality over quantity (qoq) releases vertaling:",
										fr: "zone de suspension pour x secondes",
										it: "zona di sospensione per x secondi",
										es: "zona de suspensión por x segundos",
										pl: "strefa zawiesła na x sekundy",
										uk: "зона підвіски для x секунд",
										"zh-cn": "停止x二区",
									},
									type: "number",
									role: "value",
									read: false,
									write: true,
								},
								native: {},
							});
						}

						for (const sensor of content.sensors) {
							await this.setObjectNotExistsAsync(`schedule.sensors.${sensor.input}`, {
								type: "channel",
								common: {
									name: "sensors",
								},
								native: {},
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
											write: false,
										},
										native: {},
									});

									this.setStateChangedAsync(
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
				.catch((error) => {
					if (error.response.status === 429) {
						nextpollSchedule =
							nextpollSchedule ||
							this.setTimeout(() => {
								nextpollSchedule = null;
								this.GetStatusSchedule(apiKey);
							}, 5 * 60 * 1000);
					} else {
						this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);

						this.setStateChangedAsync("info.connection", false, true);

						reject(error);
					}
				});
		});
	}

	private async GetCustomerDetails(apiKey: string): Promise<void> {
		return new Promise((resolve, reject) => {
			nextpollCustomer =
				nextpollCustomer ||
				this.setTimeout(() => {
					nextpollCustomer = null;
					this.GetCustomerDetails(apiKey);
				}, 5 * 60 * 1000);

			this.buildRequest("customerdetails.php", { api_key: this.config.apiKey })
				.then(async (response) => {
					if (response.status === 200) {
						const content = response.data;

						this.setStateChangedAsync("info.connection", true, true);

						for (const key in content) {
							if (key !== "controllers") {
								await this.setObjectNotExistsAsync(`customer.${key}`, {
									type: "state",
									common: {
										name: key,
										type: key === "message" || key === "current_controller" ? "string" : "number",
										role: key === "message" || key === "current_controller" ? "text" : "value",
										read: true,
										write: false,
									},
									native: {},
								});

								this.setStateChangedAsync(`customer.${key}`, content[key], true);
							}
						}

						for (const controller of content.controllers) {
							await this.setObjectNotExistsAsync(`customer.controllers.${controller.name}`, {
								type: "channel",
								common: {
									name: controller.name,
								},
								native: {},
							});

							for (const key in controller) {
								await this.setObjectNotExistsAsync(`customer.controllers.${controller.name}.${key}`, {
									type: "state",
									common: {
										name: key,
										type: key !== "controller_id" && key !== "last_contact" ? "string" : "number",
										role: key !== "controller_id" && key !== "last_contact" ? "text" : "value",
										read: true,
										write: false,
									},
									native: {},
								});

								this.setStateChangedAsync(
									`customer.controllers.${controller.name}.${key}`,
									controller[key],
									true,
								);
							}
						}
					}

					resolve(response.status);
				})
				.catch((error) => {
					if (error.response.status === 429) {
						nextpollCustomer =
							nextpollCustomer ||
							this.setTimeout(() => {
								nextpollCustomer = null;
								this.GetCustomerDetails(apiKey);
							}, 5 * 60 * 1000);
					} else {
						this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);

						this.setStateChangedAsync("info.connection", false, true);

						reject(error);
					}
				});
		});
	}

	buildRequest(service: string, params: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const url = `/api/v1/${service}`;
			let lastErrorCode = 0;

			if (params.api_key) {
				axios({
					method: "GET",
					baseURL: hydrawise_url,
					url: url,
					timeout: 30000,
					responseType: "json",
					params: params,
				})
					.then((response) => {
						// no error - clear up reminder
						lastErrorCode = 0;

						resolve(response);
					})
					.catch((error) => {
						if (error.response) {
							// The request was made and the server responded with a status code

							this.log.warn(
								`received ${error.response.status} response from ${url} with content: ${JSON.stringify(
									error.response.data,
								)}`,
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

						reject(error);
					});
			} else {
				reject("Device IP is not configured");
			}
		});
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			clearTimeout(nextpollSchedule);
			clearTimeout(nextpollCustomer);

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 */
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			if (id.indexOf("stopall") !== -1) {
				this.buildRequest("setzone.php", { api_key: this.config.apiKey, action: "stopall" });
			} else if (id.indexOf("stop") !== -1) {
				const relay = id.match(/.*schedule\.(.*)\.stopZone/);

				if (relay && relay?.length > 1) {
					this.buildRequest("setzone.php", {
						api_key: this.config.apiKey,
						action: "stop",
						relay_id: RELAYS[relay[1]],
					});
				}
			}
			if (id.indexOf("runall") !== -1 && (state.val || state.val === 0)) {
				this.buildRequest("setzone.php", {
					api_key: this.config.apiKey,
					action: "runall",
					period_id: 999,
					custom: state.val,
				});
			} else if (id.indexOf("run") !== -1 && (state.val || state.val === 0)) {
				const relay = id.match(/.*schedule\.(.*)\.runZone/);

				if (relay && relay?.length > 1) {
					this.buildRequest("setzone.php", {
						api_key: this.config.apiKey,
						action: "run",
						period_id: 999,
						custom: state.val,
						relay_id: RELAYS[relay[1]],
					});
				}
			}

			if (id.indexOf("suspendall") !== -1 && (state.val || state.val === 0)) {
				const num = state.val as number;

				this.buildRequest("setzone.php", {
					api_key: this.config.apiKey,
					action: "suspendall",
					period_id: 999,
					custom: Math.trunc((state.ts + num) / 1000),
				});
			} else if (id.indexOf("suspend") !== -1 && (state.val || state.val === 0)) {
				const num = state.val as number;
				const relay = id.match(/.*schedule\.(.*)\.suspendZone/);

				if (relay && relay?.length > 1) {
					this.buildRequest("setzone.php", {
						api_key: this.config.apiKey,
						action: "suspend",
						period_id: 999,
						custom: Math.trunc((state.ts + num) / 1000),
						relay_id: RELAYS[relay[1]],
					});
				}
			}
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Hydrawise(options);
} else {
	// otherwise start the instance directly
	(() => new Hydrawise())();
}
