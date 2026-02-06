import BigNumber from "bignumber.js";
import log from "loglevel";

import { config } from "../config";
import { AssetKind, BTC, LN, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import {
    type ChainPairTypeTaproot,
    type Pairs,
    type ReversePairTypeTaproot,
    type SubmarinePairTypeTaproot,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "./boltzClient";
import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "./calculate";
import { coalesceLn } from "./helper";
import { assetAmountToSats, satsToAssetAmount } from "./rootstock";

/**
 * Whether an asset is a routed ERC20 (like USDT0) whose internal
 * representation is already in native token base units.
 * Non-routed assets (like TBTC) use sats internally and need conversion.
 */
const isRoutedAsset = (asset: string) =>
    config.assets[asset]?.token?.routeVia !== undefined;

/** Convert an internal amount to EVM base units for the DEX API. */
const toDexAmount = (amount: number, asset: string): bigint =>
    isRoutedAsset(asset)
        ? BigInt(Math.round(amount))
        : satsToAssetAmount(amount, asset);

/** Convert an EVM base unit amount from the DEX API back to internal representation. */
const fromDexAmount = (amount: bigint, asset: string): BigNumber =>
    isRoutedAsset(asset)
        ? BigNumber(amount.toString())
        : BigNumber(assetAmountToSats(amount, asset).toString());

export const enum HopsPosition {
    Before = "before",
    After = "after",
}

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
        chain: string;
        tokenIn: string;
        tokenOut: string;
    };
};

export type EncodedHop = Pick<Hop, "type" | "from" | "to" | "dexDetails">;

const toEncodedHop = (hop: Hop): EncodedHop => {
    return {
        type: hop.type,
        from: hop.from,
        to: hop.to,
        dexDetails: hop.dexDetails,
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
        if (toAsset !== undefined && toAsset.type === AssetKind.ERC20) {
            const hopAssetSymbol = toAsset.token?.routeVia;
            const hopAsset = config.assets[hopAssetSymbol];
            const hopPair = Pair.findPair(pairs, from, hopAssetSymbol);

            if (hopPair !== undefined && hopAsset !== undefined) {
                log.debug(
                    `Found route for ${from} -> ${hopAssetSymbol} -> ${to}`,
                );
                this.route = [
                    {
                        type: hopPair.type,
                        pair: hopPair.pair,
                        from,
                        to: hopAssetSymbol,
                    },
                    {
                        type: SwapType.Dex,
                        from: hopAssetSymbol,
                        to,
                        dexDetails: {
                            chain: hopAsset.network?.symbol,
                            tokenIn: hopAsset.token?.address,
                            tokenOut: toAsset.token?.address,
                        },
                    },
                ];
                return;
            }
        }

        const fromAsset = config.assets[from];
        if (fromAsset !== undefined && fromAsset.type === AssetKind.ERC20) {
            const hopAssetSymbol = fromAsset.token?.routeVia;
            const hopAsset = config.assets[hopAssetSymbol];
            const hopPair = Pair.findPair(pairs, hopAssetSymbol, to);

            if (hopPair !== undefined && hopAsset !== undefined) {
                log.debug(
                    `Found route for ${from} -> ${hopAssetSymbol} -> ${to}`,
                );
                this.route = [
                    {
                        type: SwapType.Dex,
                        from,
                        to: hopAssetSymbol,
                        dexDetails: {
                            chain: fromAsset.network?.symbol,
                            tokenIn: fromAsset.token?.address,
                            tokenOut: hopAsset.token?.address,
                        },
                    },
                    {
                        type: hopPair.type,
                        pair: hopPair.pair,
                        from: hopAssetSymbol,
                        to,
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
                return Math.max(min, fee || 0);
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

    private get boltzHop() {
        return this.route.find((hop) => hop.pair !== undefined);
    }

    private get dexHopBeforeBoltz(): Hop | undefined {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) return undefined;

        const boltzIndex = this.route.indexOf(boltzHop);
        if (boltzIndex > 0) {
            const prevHop = this.route[boltzIndex - 1];
            if (prevHop.type === SwapType.Dex) {
                return prevHop;
            }
        }

        return undefined;
    }

    private convertThroughPrecedingDex = async (
        boltzSendAmount: number,
    ): Promise<number> => {
        const dexHop = this.dexHopBeforeBoltz;
        if (dexHop === undefined) {
            return boltzSendAmount;
        }

        const quote = await quoteDexAmountOut(
            dexHop.dexDetails.chain,
            dexHop.dexDetails.tokenIn,
            dexHop.dexDetails.tokenOut,
            toDexAmount(boltzSendAmount, dexHop.to),
        );

        const minQuote = quote.reduce((min, q) => {
            const amountIn = BigInt(q.quote);
            return min === BigInt(0) || amountIn < min ? amountIn : min;
        }, BigInt(0));

        return fromDexAmount(minQuote, dexHop.from).toNumber();
    };

    public getMinimum = async (): Promise<number> => {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return 0;
        }

        let boltzSendLimit: number;

        if (boltzHop.type !== SwapType.Submarine) {
            boltzSendLimit = boltzHop.pair.limits.minimal;
        } else {
            boltzSendLimit = calculateSendAmount(
                BigNumber(
                    (boltzHop.pair as unknown as SubmarinePairTypeTaproot)
                        .limits.minimalBatched || boltzHop.pair.limits.minimal,
                ),
                this.feePercentage,
                this.minerFees,
                boltzHop.type,
            ).toNumber();
        }

        return await this.convertThroughPrecedingDex(boltzSendLimit);
    };

    public getMaximum = async (): Promise<number> => {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return 0;
        }

        let boltzSendLimit: number;

        if (boltzHop.type !== SwapType.Submarine) {
            boltzSendLimit = boltzHop.pair.limits.maximal;
        } else {
            boltzSendLimit = calculateSendAmount(
                BigNumber(boltzHop.pair.limits.maximal),
                this.feePercentage,
                this.minerFees,
                boltzHop.type,
            ).toNumber();
        }

        return await this.convertThroughPrecedingDex(boltzSendLimit);
    };

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

        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return BigNumber(0);
        }

        return calculateBoltzFeeOnSend(
            sendAmount,
            this.feePercentage,
            this.minerFees,
            boltzHop.type,
        );
    };

    public calculateReceiveAmount = async (
        sendAmount: BigNumber,
        // TODO: only include lockup miner fees
        minerFees: number,
        route: Hop[] = this.route,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        let amount = sendAmount;

        for (const hop of route) {
            switch (hop.type) {
                case SwapType.Dex: {
                    if (Number.isNaN(amount.toNumber())) {
                        amount = BigNumber(0);
                        continue;
                    }

                    const quote = await quoteDexAmountIn(
                        hop.dexDetails.chain,
                        hop.dexDetails.tokenIn,
                        hop.dexDetails.tokenOut,
                        toDexAmount(amount.toNumber(), hop.from),
                    );

                    const maxQuote = quote.reduce((max, q) => {
                        const amountOut = BigInt(q.quote);
                        return amountOut > max ? amountOut : max;
                    }, BigInt(0));

                    amount = fromDexAmount(maxQuote, hop.to);
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

        for (const hop of [...this.route].reverse()) {
            switch (hop.type) {
                case SwapType.Dex: {
                    const quote = await quoteDexAmountOut(
                        hop.dexDetails.chain,
                        hop.dexDetails.tokenIn,
                        hop.dexDetails.tokenOut,
                        toDexAmount(amount.toNumber(), hop.to),
                    );

                    const minQuote = quote.reduce((min, q) => {
                        const amountIn = BigInt(q.quote);
                        return min === BigInt(0) || amountIn < min
                            ? amountIn
                            : min;
                    }, BigInt(0));

                    amount = fromDexAmount(minQuote, hop.from);
                    break;
                }

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

    public creationData = async (sendAmount: BigNumber, minerFees: number) => {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return undefined;
        }

        // If the first hop is a DEX, calculate the intermediate amount
        const firstHop = this.route[0];
        let boltzSendAmount = sendAmount;
        if (firstHop.type === SwapType.Dex) {
            boltzSendAmount = await this.calculateReceiveAmount(
                sendAmount,
                minerFees,
                [firstHop],
            );
        }

        const receiveAmount = await this.calculateReceiveAmount(
            boltzSendAmount,
            minerFees,
            [boltzHop],
        );

        const dexHops = this.route.filter((hop) => hop.type === SwapType.Dex);
        const boltzIndex = this.route.indexOf(boltzHop);
        return {
            type: boltzHop.type,
            sendAmount: boltzSendAmount,
            receiveAmount,
            from: coalesceLn(boltzHop.from),
            to: coalesceLn(boltzHop.to),
            hops: dexHops.map(toEncodedHop),
            hopsPosition:
                dexHops.length > 0
                    ? this.route.indexOf(dexHops[0]) < boltzIndex
                        ? HopsPosition.Before
                        : HopsPosition.After
                    : undefined,
        };
    };
}
