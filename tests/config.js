export const cfg = {
    "BTC/BTC": {
        rate: 1,
        limits: {
            maximal: 10000000,
            minimal: 50000,
            maximalZeroConf: {
                baseAsset: 0,
                quoteAsset: 0,
            },
        },
        fees: {
            percentage: 0.5,
            percentageSwapIn: 0.1,
            minerFees: {
                baseAsset: {
                    normal: 6800,
                    reverse: {
                        claim: 5520,
                        lockup: 6120,
                    },
                },
                quoteAsset: {
                    normal: 6800,
                    reverse: {
                        claim: 5520,
                        lockup: 6120,
                    },
                },
            },
        },
    },
    "L-BTC/BTC": {
        rate: 1,
        limits: {
            maximal: 5000000,
            minimal: 10000,
            maximalZeroConf: {
                baseAsset: 0,
                quoteAsset: 0,
            },
        },
        fees: {
            percentage: 0.25,
            percentageSwapIn: 0.1,
            minerFees: {
                baseAsset: {
                    normal: 147,
                    reverse: {
                        claim: 152,
                        lockup: 276,
                    },
                },
                quoteAsset: {
                    normal: 6800,
                    reverse: {
                        claim: 5520,
                        lockup: 6120,
                    },
                },
            },
        },
    },
};
