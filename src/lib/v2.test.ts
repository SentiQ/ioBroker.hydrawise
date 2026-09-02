import { expect } from 'chai';
import { tokenNeedsRefresh } from './v2/auth';
import {
    computeWaterSummary,
    mapControllerStates,
    mapSensorStates,
    mapWaterStates,
    mapZoneStates,
    pickController,
    v2StructureKey,
} from './v2/mapper';
import {
    WATER_QUERY,
    countFieldSelections,
    formatSuspendUntil,
    nextLongPeriod,
    periodWindow,
    mutationErrorSummary,
    startZoneMutation,
    stopAllZonesMutation,
    suspendZoneMutation,
} from './v2/queries';

describe('v2 => queries', () => {
    it('should contain one flowSummary and one watering selection', () => {
        expect(countFieldSelections(WATER_QUERY, 'flowSummary')).to.equal(1);
        expect(countFieldSelections(WATER_QUERY, 'watering')).to.equal(1);
    });

    it('should rotate long-term periods week → month → year', () => {
        const a = nextLongPeriod(0);
        expect(a.period).to.equal('week');
        const b = nextLongPeriod(a.nextIndex);
        expect(b.period).to.equal('month');
        const c = nextLongPeriod(b.nextIndex);
        expect(c.period).to.equal('year');
        expect(nextLongPeriod(c.nextIndex).period).to.equal('week');
    });

    it('should compute local calendar windows', () => {
        const now = new Date(2026, 8, 2, 14, 30, 0);
        const today = periodWindow('today', now);
        expect(today.start).to.equal(Math.floor(new Date(2026, 8, 2).getTime() / 1000));
        expect(today.end).to.equal(Math.floor(now.getTime() / 1000));

        const month = periodWindow('month', now);
        expect(month.start).to.equal(Math.floor(new Date(2026, 8, 1).getTime() / 1000));

        const year = periodWindow('year', now);
        expect(year.start).to.equal(Math.floor(new Date(2026, 0, 1).getTime() / 1000));
    });

    it('should format suspend until like the Hydrawise app', () => {
        const date = new Date(2026, 8, 2, 15, 4, 5);
        const formatted = formatSuspendUntil(date);
        expect(formatted).to.match(/^Wed, 02 Sep 26 15:04:05 [+-]\d{4}$/);
    });

    it('should extract mutation ERROR summaries', () => {
        expect(mutationErrorSummary({ startZone: { status: 'OK', summary: 'started' } })).to.equal(undefined);
        expect(mutationErrorSummary({ startZone: { status: 'ERROR', summary: 'Zone is suspended' } })).to.equal(
            'Zone is suspended',
        );
    });

    it('should build mutation payloads', () => {
        const start = startZoneMutation(9, 60);
        expect(start.query).to.include('startZone');
        expect(start.variables.zoneId).to.equal(9);
        expect(start.variables.customRunDuration).to.equal(60);

        const stopAll = stopAllZonesMutation(42);
        expect(stopAll.query).to.include('stopAllZones');
        expect(stopAll.variables.controllerId).to.equal(42);

        const suspend = suspendZoneMutation(9, new Date(2026, 8, 2, 16, 0, 0));
        expect(suspend.query).to.include('suspendZone');
        expect(suspend.variables.until).to.be.a('string');
    });
});

describe('v2 => mapper', () => {
    const controller = {
        id: 10,
        name: 'Garden',
        online: true,
        hardware: { serialNumber: 'ABC', model: { name: 'HPC-38' } },
        status: { summary: 'All good', lastContact: { timestamp: 1_725_000_000 } },
        lastContactTime: { timestamp: 1_725_000_000 },
        zones: [
            {
                id: 1001,
                name: 'Lawn',
                number: { value: 1 },
                status: { suspendedUntil: null },
                scheduledRuns: {
                    currentRun: { remainingTime: 90, duration: 5 },
                    nextRun: { startTime: { timestamp: 1_725_000_100 } },
                },
            },
        ],
        sensors: [
            {
                id: 5,
                name: 'Flow',
                input: { number: 3 },
                status: { active: true, waterFlow: { value: 12.5, unit: 'L' } },
                model: { sensorType: 'FLOW' },
            },
        ],
    };

    it('should pick controller by v1 id', () => {
        const list = [{ id: 1 }, { id: 10, name: 'Garden' }, { id: 2 }];
        expect(pickController(list, 99, 10)?.id).to.equal(10);
        expect(pickController(list, 2)?.id).to.equal(2);
        expect(pickController(list)?.id).to.equal(1);
    });

    it('should map controller, zone and sensor states', () => {
        const c = mapControllerStates(controller);
        expect(c.find(n => n.id === 'controller.name')?.value).to.equal('Garden');
        expect(c.find(n => n.id === 'controller.online')?.value).to.equal(true);

        const z = mapZoneStates(controller.zones[0]);
        expect(z.find(n => n.id === 'zones.1.running')?.value).to.equal(true);
        expect(z.find(n => n.id === 'zones.1.remaining')?.value).to.equal(90);

        const s = mapSensorStates(controller.sensors[0]);
        expect(s.find(n => n.id === 'sensors.3.waterFlow')?.value).to.equal(12.5);
        expect(s.find(n => n.id === 'sensors.3.type')?.value).to.equal('FLOW');
    });

    it('should change structure key when zones change', () => {
        const a = v2StructureKey(controller);
        const b = v2StructureKey({ ...controller, zones: [] });
        expect(a).to.not.equal(b);
    });

    it('should compute water summary and leak from inactive use', () => {
        const summary = computeWaterSummary({
            sensors: [
                {
                    model: { sensorType: 'FLOW' },
                    flowSummary: { totalWaterVolume: { value: 40, unit: 'L' } },
                },
            ],
            reports: {
                watering: [
                    {
                        runEvent: {
                            zone: { id: 1001, number: { value: 1 } },
                            reportedDuration: 120,
                            reportedWaterUsage: { value: 25, unit: 'L' },
                        },
                    },
                ],
            },
        });
        expect(summary.totalUse).to.equal(40);
        expect(summary.activeUse).to.equal(25);
        expect(summary.inactiveUse).to.equal(15);
        expect(summary.leakSuspected).to.equal(true);
        expect(summary.byZone['1'].activeTime).to.equal(120);

        const nodes = mapWaterStates('today', summary);
        expect(nodes.find(n => n.id === 'water.leakSuspected')?.value).to.equal(true);
        expect(nodes.find(n => n.id === 'water.today.activeUse')?.value).to.equal(25);
        expect(nodes.find(n => n.id === 'zones.1.today.activeUse')?.value).to.equal(25);
    });
});

describe('v2 => auth helpers', () => {
    it('should refresh when token is missing or near expiry', () => {
        expect(tokenNeedsRefresh(null)).to.equal(true);
        expect(
            tokenNeedsRefresh({
                accessToken: 'a',
                refreshToken: 'r',
                tokenType: 'Bearer',
                expiresAt: Date.now() + 60_000,
            }),
        ).to.equal(true);
        expect(
            tokenNeedsRefresh({
                accessToken: 'a',
                refreshToken: 'r',
                tokenType: 'Bearer',
                expiresAt: Date.now() + 20 * 60 * 1000,
            }),
        ).to.equal(false);
    });
});
