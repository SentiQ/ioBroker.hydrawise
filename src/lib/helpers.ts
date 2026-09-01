export const HYDRAWISE_BASE_URL = 'https://api.hydrawise.com';

export const SCHEDULE_SKIP_KEYS = ['relays', 'sensors', 'expanders'] as const;
export const CUSTOMER_SKIP_KEYS = ['controllers'] as const;

/**
 * Replace characters forbidden in ioBroker object IDs.
 *
 * @param name raw name from API
 * @param forbiddenChars adapter FORBIDDEN_CHARS regex
 */
export function name2id(name: string, forbiddenChars: RegExp): string {
    return (name || '').replace(forbiddenChars, '_');
}

/**
 * True when the key is a scalar field (not a nested array/object list).
 *
 * @param key API response key
 * @param skipKeys keys to skip (arrays/objects)
 */
export function isScalarKey(key: string, skipKeys: readonly string[]): boolean {
    return !skipKeys.includes(key);
}

/**
 * Build a full Hydrawise API URL with query parameters.
 *
 * @param service endpoint file name (e.g. statusschedule.php)
 * @param params query parameters
 */
export function buildHydrawiseUrl(service: string, params: Record<string, string | number | boolean>): string {
    const url = new URL(`/api/v1/${service}`, HYDRAWISE_BASE_URL);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

/**
 * Stable signature of schedule/customer structure for object-sync decisions.
 *
 * @param relayIds relay numbers from status API
 * @param sensorInputs sensor input numbers
 * @param controllerNames controller names from customer API
 */
export function structureSignature(
    relayIds: Array<string | number>,
    sensorInputs: Array<string | number>,
    controllerNames: string[] = [],
): string {
    return JSON.stringify({
        relays: [...relayIds].map(String).sort(),
        sensors: [...sensorInputs].map(String).sort(),
        controllers: [...controllerNames].map(String).sort(),
    });
}
