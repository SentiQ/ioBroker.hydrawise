const path = require('path');
const { tests } = require('@iobroker/testing');

// Run tests
tests.integration(path.join(__dirname, '..'), {
    // If the adapter may call process.exit during startup, define here which exit codes are allowed.
    // By default, termination during startup is not allowed.
    allowedExitCodes: [6],

    // Failure path: adapter must start without API key and stay disconnected
    defineAdditionalTests({ suite }) {
        suite('Without API key', getHarness => {
            it('should leave info.connection false when apiKey is empty', async function () {
                this.timeout(60_000);
                const harness = getHarness();

                await harness.changeAdapterConfig('hydrawise', {
                    native: {
                        apiKey: '',
                        apiInterval: 60,
                    },
                });

                await harness.startAdapterAndWait();
                await new Promise(resolve => setTimeout(resolve, 3_000));

                const connection = await harness.states.getStateAsync('hydrawise.0.info.connection');
                if (connection?.val === true) {
                    throw new Error('Expected info.connection to be false without API key');
                }

                await harness.stopAdapter();
            });
        });
    },
});
