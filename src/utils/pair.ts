import BigNumber from "bignumber.js";
import log from "loglevel";

import { config } from "../config";
import { AssetType } from "../configs/base";
import { BTC, LN, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type {
    ChainPairTypeTaproot,
    Pairs,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "./boltzClient";
import { calculateBoltzFeeOnSend, calculateSendAmount } from "./calculate";

export const enum RequiredInput {
    Address,
    Invoice,
    Web3,
    Unknown,
}

type Hop = {
    type: SwapType;
    pair?:
        | SubmarinePairTypeTaproot
        | ReversePairTypeTaproot
        | ChainPairTypeTaproot;
    from: string;
    to: string;
};

export default class Pair {
    private readonly route: Hop[] = [];

    constructor(
        public readonly pairs: Pairs | undefined,
        private readonly from: string,
        private readonly to: string,
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
        if (toAsset.type === AssetType.ERC20) {
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
                    },
                ];
                return;
            }
        }
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
            .reduce((max, hop) => {
                const fee = (
                    hop.pair.fees as unknown as SubmarinePairTypeTaproot
                ).fees.maximalRoutingFee;
                return Math.max(max, fee);
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
                            (hop.pair as unknown as SubmarinePairTypeTaproot)
                                .fees.minerFees
                        );
                    case SwapType.Reverse: {
                        const pair = (
                            hop.pair as unknown as ReversePairTypeTaproot
                        ).fees.minerFees;
                        return acc + pair.claim + pair.lockup;
                    }
                    case SwapType.Chain: {
                        const chainPair = (
                            hop.pair as unknown as ChainPairTypeTaproot
                        ).fees.minerFees;
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
        // TODO
        return 0;
    }

    public get swapToCreate() {
        return this.route.find((hop) => hop.type !== SwapType.Dex);
    }

    public feeOnSend(sendAmount: BigNumber) {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        return calculateBoltzFeeOnSend(
            sendAmount,
            this.feePercentage,
            this.minerFees,
            this.route[0].type,
        );
    }

    public calculateSendAmount = async (receiveAmount: BigNumber) => {
        return BigNumber(21_000);
    };

    public calculateReceiveAmount = async (sendAmount: BigNumber) => {
        return BigNumber(42_000);
    };
}
