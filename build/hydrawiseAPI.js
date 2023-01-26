"use strict";
const axios = require("axios");
var hydrawise_url = "https://app.hydrawise.com/api/v1/";
class hydrawiseAPI {
  GetStatusSchedule(apiKey, controllerId) {
  }
  SetZone(apiKey) {
  }
}
function GetCustomerDetails(apiKey) {
  var url = hydrawise_url + "customerdetails.php";
  axios.get(url, {
    params: {
      api_Key: apiKey
    }
  });
}
//# sourceMappingURL=hydrawiseAPI.js.map
