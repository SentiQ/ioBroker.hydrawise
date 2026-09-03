import { expect } from 'chai';
import {
    CUSTOMER_INTERVAL_MS,
    CUSTOMER_SKIP_KEYS,
    SCHEDULE_SKIP_KEYS,
    buildHydrawiseUrl,
    isRateLimitError,
    isRateLimited,
    isScalarKey,
    instanceConnected,
    name2id,
    nextBackoffMs,
    parseRetryAfter,
    structureSignature,
} from './lib/helpers';

// Approximate FORBIDDEN_CHARS from adapter-core (for unit tests only).
const FORBIDDEN_CHARS = /[\][*,;'"`<>\\\s?]/g;

describe('helpers => name2id', () => {
    it('should replace forbidden characters with underscore', () => {
        expect(name2id('Front Lawn*', FORBIDDEN_CHARS)).to.equal('Front_Lawn_');
        expect(name2id('a/b', FORBIDDEN_CHARS)).to.equal('a/b');
        expect(name2id('', FORBIDDEN_CHARS)).to.equal('');
    });
});

describe('helpers => isScalarKey', () => {
    it('should skip nested schedule arrays', () => {
        expect(isScalarKey('relays', SCHEDULE_SKIP_KEYS)).to.equal(false);
        expect(isScalarKey('sensors', SCHEDULE_SKIP_KEYS)).to.equal(false);
        expect(isScalarKey('expanders', SCHEDULE_SKIP_KEYS)).to.equal(false);
        expect(isScalarKey('time', SCHEDULE_SKIP_KEYS)).to.equal(true);
        expect(isScalarKey('message', SCHEDULE_SKIP_KEYS)).to.equal(true);
    });

    it('should skip controllers in customer payload', () => {
        expect(isScalarKey('controllers', CUSTOMER_SKIP_KEYS)).to.equal(false);
        expect(isScalarKey('message', CUSTOMER_SKIP_KEYS)).to.equal(true);
    });
});

describe('helpers => buildHydrawiseUrl', () => {
    it('should build API URL with query params', () => {
        const url = buildHydrawiseUrl('statusschedule.php', { api_key: 'secret', foo: 1 });
        expect(url).to.equal('https://api.hydrawise.com/api/v1/statusschedule.php?api_key=secret&foo=1');
    });

    it('should build setzone URL', () => {
        const url = buildHydrawiseUrl('setzone.php', {
            api_key: 'k',
            action: 'run',
            relay_id: 42,
            period_id: 999,
            custom: 60,
        });
        expect(url).to.include('https://api.hydrawise.com/api/v1/setzone.php?');
        expect(url).to.include('action=run');
        expect(url).to.include('relay_id=42');
        expect(url).to.include('custom=60');
    });
});

describe('helpers => structureSignature', () => {
    it('should be order-independent for relays and sensors', () => {
        const a = structureSignature([2, 1], [10, 9], ['B', 'A']);
        const b = structureSignature([1, 2], [9, 10], ['A', 'B']);
        expect(a).to.equal(b);
    });

    it('should change when relays change', () => {
        const a = structureSignature([1], [], []);
        const b = structureSignature([1, 2], [], []);
        expect(a).to.not.equal(b);
    });
});

describe('relay mapping', () => {
    it('should map relay number to relay_id like the adapter does', () => {
        const relays: Record<string, number> = {};
        const contentRelays = [
            { relay: 1, relay_id: 1001 },
            { relay: 2, relay_id: 1002 },
        ];
        for (const relay of contentRelays) {
            relays[relay.relay] = relay.relay_id;
        }
        expect(relays[1]).to.equal(1001);
        expect(relays[2]).to.equal(1002);
        expect(relays[3]).to.equal(undefined);
    });
});

describe('helpers => rate limit', () => {
    const noJitter = (): number => 0.5;

    it('should detect HTTP 429 and body text', () => {
        expect(isRateLimited(429, 'ok')).to.equal(true);
        expect(
            isRateLimited(
                200,
                'Exceeded maximum number of requests. You cannot make more than 5 requests in any 5 minute period to this endpoint.',
            ),
        ).to.equal(true);
        expect(isRateLimited(200, { message: 'ok' })).to.equal(false);
    });

    it('should detect thrown rate-limit errors', () => {
        const err = Object.assign(new Error('HTTP 429'), {
            code: 429,
            response: { status: 429, data: 'Exceeded maximum number of requests' },
        });
        expect(isRateLimitError(err)).to.equal(true);
        expect(isRateLimitError(new Error('network'))).to.equal(false);
    });

    it('should parse Retry-After seconds', () => {
        expect(parseRetryAfter('120')).to.equal(120);
        expect(parseRetryAfter(null)).to.equal(undefined);
    });

    it('should compute exponential backoff with cap', () => {
        expect(nextBackoffMs(1, undefined, noJitter)).to.equal(CUSTOMER_INTERVAL_MS);
        expect(nextBackoffMs(2, undefined, noJitter)).to.equal(CUSTOMER_INTERVAL_MS * 2);
        expect(nextBackoffMs(3, undefined, noJitter)).to.equal(CUSTOMER_INTERVAL_MS * 4);
        expect(nextBackoffMs(10, undefined, noJitter)).to.equal(30 * 60 * 1000);
        expect(nextBackoffMs(1, 600, noJitter)).to.equal(600_000);
    });
});

describe('helpers => instanceConnected', () => {
    it('should be true when only v2 is enabled and online', () => {
        expect(instanceConnected(false, true, false, true)).to.equal(true);
    });

    it('should be false when only v2 is enabled and offline', () => {
        expect(instanceConnected(false, true, false, false)).to.equal(false);
    });

    it('should require every enabled API to be online', () => {
        expect(instanceConnected(true, true, true, true)).to.equal(true);
        expect(instanceConnected(true, true, true, false)).to.equal(false);
        expect(instanceConnected(true, true, false, true)).to.equal(false);
        expect(instanceConnected(true, false, true, false)).to.equal(true);
        expect(instanceConnected(false, false, false, false)).to.equal(false);
    });
});
