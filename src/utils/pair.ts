import BigNumber from "bignumber.js";
import { ZeroAddress } from "ethers";
import log from "loglevel";

import { config } from "../config";
import { AssetType } from "../configs/base";
import { BTC, LN, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import {
    type ChainPairTypeTaproot,
    type Pairs,
    type ReversePairTypeTaproot,
    type SubmarinePairTypeTaproot,
    quoteDexAmountIn,
} from "./boltzClient";
import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "./calculate";
import { satoshiToWei } from "./rootstock";

export const enum RequiredInput {
    Address,
    Invoice,
    Web3,
    Unknown,
}

type Hop = {
    type: SwapType;
    from: string;
    to: string;
    pair?:
        | SubmarinePairTypeTaproot
        | ReversePairTypeTaproot
        | ChainPairTypeTaproot;
    dexDetails?: {
        tokenIn: string;
        tokenOut: string;
    };
};

export default class Pair {
    private readonly route: Hop[] = [];

    constructor(
        public readonly pairs: Pairs | undefined,
        private readonly from: string,
        private readonly to: string,
        private readonly regularPairs?: Pairs,
    ) {
        const pair = Pair.findPair(pairs, from, to);
        if (pair !== undefined) {
            log.debug(`Found direct pair for ${from} -> ${to}`);
            this.route = [
                {
                    type: pair.type,
                    pair: pair.pair,
                    from,
                    to,
                },
            ];
            return;
        }

        const toAsset = config.assets[to];
        if (toAsset !== undefined && toAsset.type === AssetType.ERC20) {
            const hopAsset = toAsset.erc20.chain;
            const hopPair = Pair.findPair(pairs, from, hopAsset);

            if (hopPair !== undefined) {
                log.debug(`Found route for ${from} -> ${hopAsset} -> ${to}`);
                this.route = [
                    {
                        type: hopPair.type,
                        pair: hopPair.pair,
                        from,
                        to: hopAsset,
                    },
                    {
                        type: SwapType.Dex,
                        from: hopAsset,
                        to,
                        dexDetails: {
                            tokenIn: ZeroAddress,
                            tokenOut: toAsset.erc20.address,
                        },
                    },
                ];
                return;
            }
        }

        log.info(`No pair found for ${from} -> ${to}`);
    }

    private static findPair = (
        pairs: Pairs | undefined,
        from: string,
        to: string,
    ): Pick<Hop, "type" | "pair"> | undefined => {
        if (pairs === undefined) {
            return undefined;
        }

        // Wrap in a try/catch to prevent throws when reading properties of undefined
        try {
            if (to === LN) {
                const pair = pairs[SwapType.Submarine][from][BTC];
                if (pair === undefined) {
                    return undefined;
                }

                return {
                    type: SwapType.Submarine,
                    pair,
                };
            } else if (from === LN) {
                const pair = pairs[SwapType.Reverse][BTC][to];
                if (pair === undefined) {
                    return undefined;
                }

                return {
                    type: SwapType.Reverse,
                    pair,
                };
            } else {
                const pair = pairs[SwapType.Chain][from][to];
                if (pair === undefined) {
                    return undefined;
                }

                return {
                    type: SwapType.Chain,
                    pair,
                };
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            return undefined;
        }
    };

    public get isRoutable() {
        return this.route.length > 0;
    }

    public get needsNetworkForQuote() {
        return this.route.some((hop) => hop.type === SwapType.Dex);
    }

    public get requiredInput() {
        if (!this.isRoutable) {
            return RequiredInput.Unknown;
        }

        const lastHop = this.route[this.route.length - 1];

        if (lastHop.type === SwapType.Submarine) {
            return RequiredInput.Invoice;
        }

        if (lastHop.to === RBTC || lastHop.type === SwapType.Dex) {
            return RequiredInput.Web3;
        }

        return RequiredInput.Address;
    }

    public get needsBackup() {
        return this.route.some(
            (hop) =>
                hop.from !== RBTC &&
                (hop.type === SwapType.Submarine ||
                    hop.type === SwapType.Chain),
        );
    }

    public get fromAsset() {
        return this.from;
    }

    public get toAsset() {
        return this.to;
    }

    public get canZeroAmount() {
        return (
            this.route.length === 1 &&
            this.route[0].type === SwapType.Chain &&
            this.route[0].from !== RBTC
        );
    }

    public get feePercentage() {
        return this.route
            .filter((hop) => hop.pair !== undefined)
            .reduce((acc, hop) => acc + hop.pair.fees.percentage, 0);
    }

    public get maxRoutingFee() {
        if (!this.isRoutable) {
            return 0;
        }

        const maxFee = this.route
            .filter(
                (hop) =>
                    hop.pair !== undefined && hop.type === SwapType.Submarine,
            )
            .reduce((min, hop) => {
                const fee = (hop.pair as SubmarinePairTypeTaproot).fees
                    .maximalRoutingFee;
                return Math.min(min, fee || 0);
            }, 0);

        if (maxFee === 0) {
            return undefined;
        }

        return maxFee;
    }

    public get minerFees() {
        return this.route
            .filter((hop) => hop.pair !== undefined)
            .reduce((acc, hop) => {
                switch (hop.type) {
                    case SwapType.Submarine:
                        return (
                            acc +
                            (hop.pair as SubmarinePairTypeTaproot).fees
                                .minerFees
                        );
                    case SwapType.Reverse: {
                        const pair = (hop.pair as ReversePairTypeTaproot).fees
                            .minerFees;
                        return acc + pair.claim + pair.lockup;
                    }
                    case SwapType.Chain: {
                        const chainPair = (hop.pair as ChainPairTypeTaproot)
                            .fees.minerFees;
                        return acc + chainPair.server + chainPair.user.claim;
                    }
                    default:
                        return acc;
                }
            }, 0);
    }

    public get minimum() {
        const firstHop = this.route[0];

        if (firstHop.type !== SwapType.Submarine) {
            return firstHop.pair.limits.minimal;
        }

        return calculateSendAmount(
            BigNumber(
                (firstHop.pair as unknown as SubmarinePairTypeTaproot).limits
                    .minimalBatched || firstHop.pair.limits.minimal,
            ),
            this.feePercentage,
            this.minerFees,
            firstHop.type,
        ).toNumber();
    }

    public get maximum() {
        const firstHop = this.route[0];

        if (firstHop.type !== SwapType.Submarine) {
            return firstHop.pair.limits.maximal;
        }

        return calculateSendAmount(
            BigNumber(firstHop.pair.limits.maximal),
            this.feePercentage,
            this.minerFees,
            firstHop.type,
        ).toNumber();
    }

    public get feeWithoutPro() {
        if (this.regularPairs === undefined) {
            return this.feePercentage;
        }

        const fee = this.route
            .filter((hop) => hop.pair !== undefined)
            .reduce((acc, hop) => {
                const pair = Pair.findPair(this.regularPairs, hop.from, hop.to);
                if (pair === undefined) {
                    return acc;
                }

                return acc + pair.pair.fees.percentage;
            }, 0);
        return fee;
    }

    public get swapToCreate() {
        return this.route.find((hop) => hop.type !== SwapType.Dex);
    }

    public feeOnSend = (sendAmount: BigNumber) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        return calculateBoltzFeeOnSend(
            sendAmount,
            this.feePercentage,
            this.minerFees,
            this.route[0].type,
        );
    };

    public calculateReceiveAmount = async (
        sendAmount: BigNumber,
        minerFees: number,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        let amount = sendAmount;

        for (const hop of this.route) {
            switch (hop.type) {
                case SwapType.Dex: {
                    if (Number.isNaN(sendAmount.toNumber())) {
                        amount = BigNumber(0);
                        continue;
                    }

                    const quote = await quoteDexAmountIn(
                        hop.from,
                        hop.dexDetails.tokenIn,
                        hop.dexDetails.tokenOut,
                        BigInt(satoshiToWei(sendAmount.toNumber())),
                    );
                    amount = BigNumber(
                        quote.reduce((max, q) => {
                            const amountOut = BigNumber(q.quote);
                            return amountOut.gt(max) ? amountOut : max;
                        }, BigNumber(0)),
                    );
                    break;
                }

                default:
                    amount = calculateReceiveAmount(
                        amount,
                        hop.pair!.fees.percentage,
                        minerFees,
                        hop.type,
                    );
            }
        }

        return amount;
    };

    public calculateSendAmount = async (
        receiveAmount: BigNumber,
        minerFees: number,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        let amount = receiveAmount;

        for (const hop of this.route) {
            switch (hop.type) {
                case SwapType.Dex:
                    // TODO
                    amount = await Promise.resolve(BigNumber(0));
                    break;

                default:
                    amount = calculateSendAmount(
                        amount,
                        hop.pair!.fees.percentage,
                        minerFees,
                        hop.type,
                    );
            }
        }

        return amount;
    };
}
