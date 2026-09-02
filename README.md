![Logo](admin/hydrawise.jpg)

# ioBroker.hydrawise

[![NPM version](https://img.shields.io/npm/v/iobroker.hydrawise.svg?style=flat-square)](https://www.npmjs.com/package/iobroker.hydrawise)
[![Downloads](https://img.shields.io/npm/dm/iobroker.hydrawise.svg?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/iobroker.hydrawise)
![node-lts](https://img.shields.io/node/v-lts/iobroker.hydrawise?style=flat-square)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/iobroker.hydrawise?label=npm%20dependencies&style=flat-square)

![GitHub](https://img.shields.io/github/license/sentiq/iobroker.hydrawise?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/sentiq/iobroker.hydrawise?logo=github&style=flat-square)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/sentiq/iobroker.hydrawise?logo=github&style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/sentiq/iobroker.hydrawise?logo=github&style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/sentiq/iobroker.hydrawise?logo=github&style=flat-square)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/sentiq/iobroker.hydrawise/test-and-release.yml?branch=master&logo=github&style=flat-square)

## Versions

![Beta](https://img.shields.io/npm/v/iobroker.hydrawise.svg?color=red&label=beta)
![Stable](http://iobroker.live/badges/hydrawise-stable.svg)
![Installed](http://iobroker.live/badges/hydrawise-installed.svg)

Integrate your Hydrawise controller into iobroker.
You can see all controller information, schedules and sensors. It is also possible to suspend planned watering by x seconds.

The adapter can use either API, or both:

- **v1** (optional, API key, `schedule.*` / `customer.*`) — status, sensors configuration, run/stop/suspend.
- **v2** (optional, Hydrawise login, `zones.*` / `water.*` / `sensors.*` / `weather.*` / `controller.*`) — measured water usage, live sensor values, weather, leak indicator, and zone commands via GraphQL.

## Documentation

- log into https://app.hydrawise.com/config/account-details
- generate API Key by clicking "Generate API Key" under "Account Settings"
- paste key into adapter settings
- API documentation: https://support.hydrawise.com/hc/en-us/articles/360008965753-Hydrawise-API-Information

### v2 API (optional)

v2 is the unofficial GraphQL API used by the Hydrawise app (`app.hydrawise.com/api/v2/graph`). Enable it in instance settings and enter the same email/password as the app. v1 can be disabled independently if you only want GraphQL.

| Object tree | Source | Controls irrigation? |
| --- | --- | --- |
| `schedule.*` | v1 REST | yes (`setzone.php`) |
| `zones.*` | v2 GraphQL | yes (GraphQL mutations), only if v2 is enabled |
| `water.*`, `sensors.*`, `weather.*`, `controller.*` | v2 GraphQL | read-only |
| `info.connection` | v1 | — |
| `info.connectionV2` | v2 | — |

v1 `schedule.sensors.*` only contains sensor *configuration*. Measured flow, rainfall and leak suspicion come from v2 `sensors.*` / `water.leakSuspected`.

Default v2 poll interval is **300 seconds** (minimum 120). GraphQL is rate-limited per account (including the official app). Do not lower this without a reason.

`customerdetails.php` is polled on its own 5-minute timer with backoff after HTTP 429. Commands never call that endpoint.

> **Note**  
> After updating from 0.0.15 you have to re-enter your API key

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 2.0.0 (2026-09-02)

* (SentiQ) **NEW**: Optional Hydrawise v2 GraphQL API (water usage, live sensors, weather, leak indicator, zone commands)
* (SentiQ) **ENHANCED**: customerdetails.php polls on its own 5-minute timer with backoff after rate limits

### 1.1.0 (2026-09-01)

* (SentiQ) **FIXED**: Relay ID mapping no longer writes onto the Object constructor
* (SentiQ) **FIXED**: runDefault reset no longer accidentally stops the zone
* (SentiQ) **ENHANCED**: Object creation only on structure change; poll overlap protection
* (SentiQ) **ENHANCED**: Replaced axios with native fetch; timers cleaned up on unload
* (SentiQ) **TESTING**: Unit tests for helpers (name2id, URL builder, structure signature)

### 1.0.6 (2026-08-09)

- (SentiQ) updated dependencies
- (SentiQ) Adapter requires node.js >= 22 now

### 1.0.5 (2025-12-05)

- (SentiQ) updated js-controller dependency
- (SentiQ) updated @iobroker/adapter-dev dependency

### 1.0.4 (2025-12-05)

- (SentiQ) fixed dependencies
- (SentiQ) fixed schema URLs

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

MIT License

Copyright (c) 2025-2026 SentiQ <yves.nuesser@proton.me>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
