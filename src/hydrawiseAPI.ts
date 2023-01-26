const axios = require("axios");

// Hydrawise REST-API URL
var hydrawise_url = "https://app.hydrawise.com/api/v1/";

class hydrawiseAPI {
	private GetStatusSchedule(apiKey: string, controllerId: string) {}

	private SetZone(apiKey: string) {}
}

function GetCustomerDetails(apiKey: string) {
	var url = hydrawise_url + "customerdetails.php";
	axios.get(url, {
		params: {
			api_Key: apiKey,
		},
	});
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
