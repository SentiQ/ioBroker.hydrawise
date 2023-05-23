/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

// Hydrawise REST-API URL
const hydrawise_url = "https://api.hydrawise.com";
let nextpoll: any = null;

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

		// await this.GetCustomerDetails(this.config.apiKey);

		await this.GetStatusSchedule(this.config.apiKey);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  */
	// private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 */
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  */
	// private onMessage(obj: ioBroker.Message): void {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

	private async GetStatusSchedule(apiKey: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.log.debug("refreshing device state");

			this.log.debug("re-creating refresh state timeout");

			nextpoll =
				nextpoll ||
				this.setTimeout(() => {
					nextpoll = null;
					this.GetStatusSchedule(apiKey);
				}, 60000);

			this.buildRequest("statusschedule.php", "GET")
				.then(async (response) => {
					if (response.status === 200) {
						const content = response.data;

						this.setStateChangedAsync("info.connection", true, true);

						for (const key in content) {
							if (key !== "relays" && key !== "sensors") {
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
						}

						// ToDo
						// for (const sensor of content.sensors) {
						// await this.setObjectNotExistsAsync(`schedule.${sensor.name}`, {
						// 	type: "channel",
						// 	common: {
						// 		name: sensor.name,
						// 	},
						// 	native: {},
						// });
						// for (const key in sensor) {
						// 	await this.setObjectNotExistsAsync(`schedule.${sensor.name}.${key}`, {
						// 		type: "state",
						// 		common: {
						// 			name: key,
						// 			type: key === "name" ? "string" : "number",
						// 			role: key === "name" ? "text" : "value",
						// 			read: true,
						// 			write: false,
						// 		},
						// 		native: {},
						// 	});
						// 	this.setStateChangedAsync(`schedule.${sensor.name}.${key}`, sensor[key], true);
						// }
						// }
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
		const url = hydrawise_url + "customerdetails.php";
		try {
			const customerDetails = await axios.get<CustomerDetails>(url, {
				headers: {
					Accept: "application/json",
				},
				params: {
					api_key: apiKey,
				},
			});

			this.log.info("customerDetails: " + JSON.stringify(customerDetails.data, null, 4));
		} catch (error) {
			if (axios.isAxiosError(error)) {
				this.log.error("error message: " + error.message);
			} else {
				this.log.error("unexpected error: " + error);
			}
		}
	}

	buildRequest(service: string, method: string, data?: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const url = `/api/v1/${service}`;
			let lastErrorCode = 0;

			if (this.config.apiKey) {
				if (data) {
					this.log.debug(`sending "${method}" request to "${url}" with data: ${JSON.stringify(data)}`);
				} else {
					this.log.debug(`sending "${method}" request to "${url}" without data`);
				}

				axios({
					method: method,
					data: data,
					baseURL: hydrawise_url,
					url: url,
					timeout: 3000,
					responseType: "json",
					params: {
						api_key: this.config.apiKey,
					},
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
}

interface StatusSchedule {
	message: string;
	nextpoll: number;
	time: number;
	relays?: {
		relay_id: number;
		relay: number;
		name: string;
		timestr: string;
		time: number;
		run: string;
	};
	master: number;
	master_timer: number;
	sensors?: {
		input: number;
		type: number;
		mode: number;
		relay?: {
			id: number;
		};
	};
}

interface CustomerDetails {
	controller_id: number;
	customer_id: number;
	current_controller: string;
	controller?: {
		name: string;
		last_contact: string;
		serial_number: string;
		controller_id: number;
		status: string;
	};
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Hydrawise(options);
} else {
	// otherwise start the instance directly
	(() => new Hydrawise())();
}
