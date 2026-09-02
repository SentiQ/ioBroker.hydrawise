// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            enableV1: boolean;
            apiKey: string;
            apiInterval: number;
            enableV2: boolean;
            v2Username: string;
            v2Password: string;
            apiIntervalV2: number;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
