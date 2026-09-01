import { expect } from 'chai';
import {
    CUSTOMER_SKIP_KEYS,
    SCHEDULE_SKIP_KEYS,
    buildHydrawiseUrl,
    isScalarKey,
    name2id,
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
