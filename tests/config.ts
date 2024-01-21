import { Pairs } from "../src/utils/boltzClient";

export const cfg: Pairs = {
    legacy: {
        info: [],
        warnings: [],
        pairs: {},
    },
    submarine: {
        BTC: {
            BTC: {
                hash: "e31136f0bc5e7d0da49f352e4b1702865dd9aecb11d85a975c18fabaaf2bb09f",
                rate: 1,
                limits: {
                    maximal: 4294967,
                    minimal: 50000,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0.1,
                    minerFees: 6800,
                },
            },
        },
        "L-BTC": {
            BTC: {
                hash: "edddd7f91540d4dd8cb256a82a89c945c26e782c81fb6d4137e385a6841e6a77",
                rate: 1,
                limits: {
                    maximal: 4294967,
                    minimal: 10000,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0.1,
                    minerFees: 147,
                },
            },
        },
    },
    reverse: {
        BTC: {
            BTC: {
                hash: "d56335bf280db60b12c188748f93e274718d1f42b06970eb8f01edb074713a82",
                rate: 1,
                limits: {
                    maximal: 4294967,
                    minimal: 50000,
                },
                fees: {
                    percentage: 0.5,
                    minerFees: {
                        claim: 5520,
                        lockup: 6120,
                    },
                },
            },
            "L-BTC": {
                hash: "0749fd629a855f6ffb91d8ecf266c0016b5d0b305f6195a2fa554b6a7f095ee9",
                rate: 1,
                limits: {
                    maximal: 4294967,
                    minimal: 10000,
                },
                fees: {
                    percentage: 0.25,
                    minerFees: {
                        claim: 152,
                        lockup: 276,
                    },
                },
            },
        },
    },
};
