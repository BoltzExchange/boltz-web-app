import type { Pairs } from "../src/utils/boltzClient";

export const pairs: Pairs = {
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
                    minimalBatched: 21,
                },
                fees: {
                    percentage: 0.1,
                    minerFees: 19,
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
    chain: {
        BTC: {
            "L-BTC": {
                hash: "721782fd58c8f7c71f48ec5cf02c3860907cfa9e00dda3a8d564acde038b4e70",
                rate: 1,
                limits: {
                    maximal: 40294967,
                    minimal: 50000,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0.1,
                    minerFees: {
                        server: 11376,
                        user: {
                            claim: 143,
                            lockup: 15400,
                        },
                    },
                },
            },
            RBTC: {
                hash: "6e6a5f596ceba75b80ac5636ba30a7f373f3c55d77625a2e32390762c614a728",
                rate: 1,
                limits: {
                    maximal: 4294967,
                    minimal: 50000,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0.5,
                    minerFees: {
                        server: 19346,
                        user: {
                            claim: 4423,
                            lockup: 15400,
                        },
                    },
                },
            },
        },
        "L-BTC": {
            BTC: {
                hash: "4529619084bb742bf533a1245e41e91402c9d44609005ced2956342fe2f33f0d",
                rate: 1,
                limits: {
                    maximal: 40294967,
                    minimal: 50000,
                    maximalZeroConf: 40294967,
                },
                fees: {
                    percentage: 0.1,
                    minerFees: {
                        server: 15543,
                        user: {
                            claim: 11100,
                            lockup: 276,
                        },
                    },
                },
            },
        },
        RBTC: {
            BTC: {
                hash: "1e7b3199eb7b3395d1528dba8da28a436d9c3a040d5d7e1a3a3746a6136c88f8",
                rate: 1,
                limits: {
                    maximal: 4294967,
                    minimal: 50000,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0.5,
                    minerFees: {
                        server: 19823,
                        user: {
                            claim: 11100,
                            lockup: 8246,
                        },
                    },
                },
            },
        },
    },
};
