/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

// Hydrawise REST-API URL
const hydrawise_url = "https://api.hydrawise.com";
let nextpollSchedule: any = null;
let nextpollCustomer: any = null;
const RELAYS: any = Object;

// Load your modules here, e.g.:
// import * as fs from "fs";
import axios from "axios";

class Hydrawise extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "hydrawise",
		});

		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here

		// validate if apiKey is set
		if (!this.config.apiKey) {
			this.log.error("No API-Key definded!");
		} else {
			this.log.info("config apiKey: " + this.config.apiKey);
		}

		// Reset the connection indicator during startup
		this.setStateChangedAsync("info.connection", false, true);

		await this.GetStatusSchedule(this.config.apiKey);

		// await this.GetCustomerDetails(this.config.apiKey);

		// Subscribe for changes
		await this.subscribeStatesAsync("*");
	}

	private async GetStatusSchedule(apiKey: string): Promise<void> {
		return new Promise((resolve, reject) => {
			nextpollSchedule =
				nextpollSchedule ||
				this.setTimeout(() => {
					nextpollSchedule = null;
					this.GetStatusSchedule(apiKey);
				}, 60000);

			this.buildRequest("statusschedule.php", { api_key: this.config.apiKey })
				.then(async (response) => {
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
								write: true,
							},
							native: {},
						});

						await this.setObjectNotExistsAsync("schedule.runall", {
							type: "state",
							common: {
								name: "runall for x seconds",
								type: "number",
								role: "value",
								read: false,
								write: true,
							},
							native: {},
						});

						await this.setObjectNotExistsAsync("schedule.suspendall", {
							type: "state",
							common: {
								name: "suspendall for x seconds",
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
							await this.setObjectNotExistsAsync(`schedule.${relay.name}`, {
								type: "channel",
								common: {
									name: relay.name,
								},
								native: {},
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
										write: false,
									},
									native: {},
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
									write: true,
								},
								native: {},
							});

							await this.setObjectNotExistsAsync(`schedule.${relay.name}.runZone`, {
								type: "state",
								common: {
									name: "run zone for x seconds",
									type: "number",
									role: "value",
									read: false,
									write: true,
								},
								native: {},
							});

							await this.setObjectNotExistsAsync(`schedule.${relay.name}.suspendZone`, {
								type: "state",
								common: {
									name: "suspend zone for x seconds",
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
					this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);

					this.setStateChangedAsync("info.connection", false, true);

					reject(error);
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
				}, 60 * 5000);

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
										type: key === "message" ? "string" : "number",
										role: key === "message" ? "text" : "value",
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
										type: key !== "controller_id" ? "string" : "number",
										role: key !== "controller_id" ? "text" : "value",
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
					this.log.debug(`(stats) received error - API is now offline: ${JSON.stringify(error)}`);

					this.setStateChangedAsync("info.connection", false, true);

					reject(error);
				});
		});
	}

	buildRequest(service: string, params: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const url = `/api/v1/${service}`;
			let lastErrorCode = 0;

			if (params.api_key) {
				this.log.debug(`sending GET request to "${url}" with params: ${JSON.stringify(params)}`);

				axios({
					method: "GET",
					baseURL: hydrawise_url,
					url: url,
					timeout: 3000,
					responseType: "json",
					params: params,
				})
					.then((response) => {
						this.log.debug(
							`received ${response.status} response from "${url}" with content: ${JSON.stringify(
								response.data,
							)}`,
						);

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
			console.log("state", state);

			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

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
