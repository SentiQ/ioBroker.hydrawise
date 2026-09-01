# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.5.7
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

---

## Project Context

You are working on **ioBroker.hydrawise**, a cloud-polling adapter that integrates Hunter Hydrawise irrigation controllers into ioBroker.

- API base: `https://api.hydrawise.com/api/v1/`
- Endpoints: `statusschedule.php`, `customerdetails.php`, `setzone.php`
- Auth: API key (`encryptedNative` / `protectedNative`)
- Polling: schedule via configurable `apiInterval` (seconds); customer details every 5 minutes
- Admin UI: JSON Config (`admin/jsonConfig.json`) with flat i18n under `admin/i18n/*.json`
- Runtime: TypeScript → `build/main.js`, Node.js `>=22`, compact mode supported
- HTTP: native `fetch` (no axios)
- Helpers: pure functions in `src/lib/helpers.ts` (prefer extending these for unit-testable logic)

---

## Code Quality & Standards

### Code Style Guidelines

- Follow TypeScript best practices
- Use async/await for asynchronous operations
- Keep timers/intervals as **instance fields**; clean them up in `onUnload` (including timeouts)
- Prefer `setStateChangedAsync` for polls; create objects only when structure changes
- Guard overlapping polls with running flags
- Use semantic versioning for adapter releases
- Include JSDoc for public/exported helpers

### ESLint Configuration

- Use `@iobroker/eslint-config`
- Lint must run first in CI (`check-and-lint` before adapter tests)
- `npm run lint` uses `--max-warnings 0`
- `npm run lint:fix` for auto-fixable issues

---

## Testing

### Unit Testing

- Mocha + chai (create-adapter default); keep this stack
- Put pure logic in `src/lib/helpers.ts` and test it from `src/main.test.ts`
- Mock external API calls; do not hit Hydrawise from unit tests

### Integration Testing

- Use official `@iobroker/testing` in `test/integration.js`
- Configure via harness; start with `startAdapterAndWait`
- Never bypass the harness or call API URLs directly in integration tests

---

## Development Best Practices

### Dependency Management

- Prefer built-in Node.js APIs (`fetch`, `fs/promises`)
- Keep dependencies minimal; update them in separate PRs
- Commit `package.json` and `package-lock.json` together

### HTTP Client Libraries

- **Preferred:** native `fetch` with `AbortSignal` timeout
- **Avoid:** axios unless a specific feature is required

### Error Handling

- Catch and log with `this.log.*`
- Set `info.connection` to `false` on failures; keep intervals running
- Avoid clear/recreate of intervals on transient network errors
- Always clean up timers in `onUnload`

---

## Admin UI Configuration

- JSON-Config only
- Keep translation keys in sync with `label`/`help` in `admin/jsonConfig.json`
- Minimum languages: English and German (all 11 preferred)

---

## Documentation

### README / Changelog

- For every PR, add user-facing entries under `## **WORK IN PROGRESS**`
- Format: `* (author) **TYPE**: Description` with types **NEW**, **FIXED**, **ENHANCED**, **TESTING**, **CI/CD**
- Release-script placeholder must stay at the top of the Changelog section

---

## CI/CD & GitHub Actions

- Lint-first via `ioBroker/testing-action-check`
- Adapter tests via `ioBroker/testing-action-adapter` on Node 22.x / 24.x
- Deploy via `ioBroker/testing-action-deploy` on version tags
