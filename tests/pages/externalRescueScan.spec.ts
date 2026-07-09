import {
    BridgeKind,
    RskRescueMode,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";

import {
    getEvmRefundDisplayAmount,
    getEvmRefundDisplayQuoteParams,
} from "../../src/pages/RescueEvm";
import { getEvmDisplayAssets } from "../../src/pages/external-rescue/Results";
import {
    enrichEvmRescueResults,
    filterHydratedEvmSwaps,
    mapRestoredEvmClaimResult,
    mapRestoredEvmSwaps,
    mergeEvmRescueResults,
} from "../../src/pages/external-rescue/scan";
import type {
    EvmRescueResult,
    RestoredEvmSwap,
} from "../../src/pages/external-rescue/types";
import {
    isEvmRestoreCandidate,
    shouldShowEvmRestoreResult,
} from "../../src/pages/external-rescue/useExternalRescueSearch";
import { encryptSwapMetadata } from "../../src/utils/swapMetadata";

const baseEvent: EvmRescueResult = {
    action: RskRescueMode.Claim,
    asset: "TBTC",
    blockNumber: 100,
    transactionHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    preimageHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    amount: 1000n,
    claimAddress: "0x0000000000000000000000000000000000000001",
    refundAddress: "0x0000000000000000000000000000000000000002",
    timelock: 123n,
};

const restoredSwap: RestoredEvmSwap = {
    id: "swap-id",
    type: SwapType.Chain,
    status: "transaction.server.confirmed",
    createdAt: 1,
    from: "L-BTC",
    to: "TBTC",
    preimageHash: baseEvent.preimageHash,
    commitmentLockupTxHash: baseEvent.transactionHash,
    evmClaimDetails: {
        contractAddress: "0x0000000000000000000000000000000000000003",
        claimAddress: baseEvent.claimAddress,
        transaction: { id: baseEvent.transactionHash },
        timeoutBlockHeight: 123,
    },
    dex: {
        hops: [{ type: SwapType.Dex, from: "TBTC", to: "USDT0" }],
        position: SwapPosition.Post,
        quoteAmount: 1000,
    },
    bridge: {
        sourceAsset: "USDT0",
        destinationAsset: "USDT0-SOL",
        kind: BridgeKind.Oft,
        position: SwapPosition.Post,
    },
};

describe("external EVM rescue scan helpers", () => {
    test("deduplicates chain scan and backend restore events", () => {
        const merged = mergeEvmRescueResults(
            [baseEvent],
            [
                {
                    ...baseEvent,
                    preimage:
                        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                    restoredSwap,
                    dex: restoredSwap.dex,
                    bridge: restoredSwap.bridge,
                },
            ],
        );

        expect(merged).toHaveLength(1);
        expect(merged[0].preimage).toBe(
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        );
        expect(merged[0].restoredSwap?.id).toBe("swap-id");
        expect(merged[0].bridge?.destinationAsset).toBe("USDT0-SOL");
    });

    test("enriches scanner results with encrypted metadata transaction hash", () => {
        const [enriched] = enrichEvmRescueResults([baseEvent], [restoredSwap]);

        expect(enriched.restoredSwap?.id).toBe("swap-id");
        expect(enriched.dex?.hops[0].to).toBe("USDT0");
        expect(enriched.bridge?.destinationAsset).toBe("USDT0-SOL");
    });

    test("hydrates encrypted metadata transaction hash for matching", async () => {
        const mnemonic =
            "awake father sword slab matrix myth cargo lock river thumb inspire speed";
        const [restored] = await mapRestoredEvmSwaps(
            [
                {
                    id: "metadata-tx-swap",
                    type: SwapType.Chain,
                    status: "transaction.server.confirmed",
                    createdAt: 1,
                    from: "L-BTC",
                    to: "TBTC",
                    preimageHash:
                        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    metadata: await encryptSwapMetadata(mnemonic, {
                        swapId: "metadata-tx-swap",
                        lockupTx: baseEvent.transactionHash,
                        dex: restoredSwap.dex,
                        bridge: restoredSwap.bridge,
                    }),
                },
            ],
            mnemonic,
        );

        if (restored === undefined) {
            throw new Error("missing restored swap");
        }

        expect(restored.lockupTx).toBe(baseEvent.transactionHash);
        const [enriched] = enrichEvmRescueResults([baseEvent], [restored]);
        expect(enriched.restoredSwap?.id).toBe("metadata-tx-swap");
    });

    test("enriches scanner refund results with encrypted metadata refund transaction", () => {
        const refundTx =
            "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
        const [enriched] = enrichEvmRescueResults(
            [
                {
                    ...baseEvent,
                    action: RskRescueMode.Refund,
                    transactionHash: refundTx,
                    preimageHash: "0x",
                },
            ],
            [
                {
                    ...restoredSwap,
                    preimageHash: "",
                    commitmentLockupTxHash: refundTx,
                    refundDetails: {
                        tree: {
                            claimLeaf: { version: 192, output: "51" },
                            refundLeaf: { version: 192, output: "51" },
                        },
                        keyIndex: 0,
                        lockupAddress: "lockup",
                        serverPublicKey:
                            "020000000000000000000000000000000000000000000000000000000000000000",
                        timeoutBlockHeight: 1,
                        transaction: { id: refundTx, vout: 0 },
                    },
                },
            ],
        );

        expect(enriched.restoredSwap?.id).toBe("swap-id");
        expect(enriched.bridge?.destinationAsset).toBe("USDT0-SOL");
    });

    test("does not enrich scanner results by unambiguous claim address", () => {
        const [enriched] = enrichEvmRescueResults(
            [
                {
                    ...baseEvent,
                    action: RskRescueMode.Refund,
                    transactionHash:
                        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                    preimageHash: "0x",
                },
            ],
            [
                {
                    ...restoredSwap,
                    preimageHash: "",
                    evmClaimDetails: {
                        ...restoredSwap.evmClaimDetails!,
                        transaction: {
                            id: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                        },
                    },
                },
            ],
        );

        expect(enriched.restoredSwap).toBeUndefined();
        expect(enriched.bridge).toBeUndefined();
    });

    test("does not enrich scanner results by claim address when ambiguous", () => {
        const [enriched] = enrichEvmRescueResults(
            [
                {
                    ...baseEvent,
                    action: RskRescueMode.Refund,
                    transactionHash:
                        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                    preimageHash: "0x",
                },
            ],
            [
                {
                    ...restoredSwap,
                    preimageHash: "",
                    evmClaimDetails: {
                        ...restoredSwap.evmClaimDetails!,
                        transaction: {
                            id: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                        },
                    },
                },
                {
                    ...restoredSwap,
                    id: "other-swap-id",
                    preimageHash: "",
                    evmClaimDetails: {
                        ...restoredSwap.evmClaimDetails!,
                        transaction: {
                            id: "0x1111111111111111111111111111111111111111111111111111111111111111",
                        },
                    },
                },
            ],
        );

        expect(enriched.restoredSwap).toBeUndefined();
    });

    test("falls back to the original source asset for unmatched pre-bridge refund rows", () => {
        const refund: EvmRescueResult = {
            ...baseEvent,
            action: RskRescueMode.Refund,
            bridge: {
                sourceAsset: "USDT0-SOL",
                destinationAsset: "USDT0",
                kind: BridgeKind.Oft,
                position: SwapPosition.Pre,
            },
            dex: {
                hops: [{ type: SwapType.Dex, from: "USDT0", to: "TBTC" }],
                position: SwapPosition.Pre,
                quoteAmount: 1000,
            },
        };

        expect(getEvmDisplayAssets(refund)).toEqual(["USDT0-SOL"]);
    });

    test("does not infer source asset from unmatched pre-dex refund rows", () => {
        const refund: EvmRescueResult = {
            ...baseEvent,
            action: RskRescueMode.Refund,
            dex: {
                hops: [{ type: SwapType.Dex, from: "USDT0", to: "TBTC" }],
                position: SwapPosition.Pre,
                quoteAmount: 1000,
            },
        };

        expect(getEvmDisplayAssets(refund)).toEqual(["TBTC"]);
    });

    test("does not infer source metadata for unmatched routed pre-bridge refund rows", () => {
        const preRoutedSwap: RestoredEvmSwap = {
            ...restoredSwap,
            id: "pre-routed-swap",
            from: "TBTC",
            to: "L-BTC",
            preimageHash:
                "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            claimDetails: {
                tree: {
                    claimLeaf: { version: 192, output: "51" },
                    refundLeaf: { version: 192, output: "51" },
                },
                amount: 13341,
                keyIndex: 0,
                lockupAddress: "lockup",
                serverPublicKey: "server",
                timeoutBlockHeight: 100,
                blindingKey: "blind",
                preimageHash:
                    "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            },
            evmClaimDetails: undefined,
            dex: {
                hops: [{ type: SwapType.Dex, from: "USDT0", to: "TBTC" }],
                position: SwapPosition.Pre,
                quoteAmount: 13334,
            },
            bridge: {
                sourceAsset: "USDT0-SOL",
                destinationAsset: "USDT0",
                kind: BridgeKind.Oft,
                position: SwapPosition.Pre,
            },
        };
        const [enriched] = enrichEvmRescueResults(
            [
                {
                    ...baseEvent,
                    action: RskRescueMode.Refund,
                    asset: "TBTC",
                    amount: 42n,
                    transactionHash:
                        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                    preimageHash: `0x${"00".repeat(32)}`,
                },
            ],
            [preRoutedSwap],
        );

        expect(enriched.restoredSwap).toBeUndefined();
        expect(enriched.bridge).toBeUndefined();
        expect(getEvmDisplayAssets(enriched)).toEqual(["TBTC"]);
    });

    test("uses restored swap endpoints for pre-bridge refund rows", () => {
        expect(
            getEvmDisplayAssets({
                ...baseEvent,
                action: RskRescueMode.Refund,
                asset: "TBTC",
                restoredSwap: {
                    ...restoredSwap,
                    from: "TBTC",
                    to: "L-BTC",
                    bridge: {
                        sourceAsset: "USDT0-SOL",
                        destinationAsset: "USDT0",
                        kind: BridgeKind.Oft,
                        position: SwapPosition.Pre,
                    },
                    dex: {
                        hops: [
                            {
                                type: SwapType.Dex,
                                from: "USDT0",
                                to: "TBTC",
                            },
                        ],
                        position: SwapPosition.Pre,
                        quoteAmount: 13334,
                    },
                },
            }),
        ).toEqual(["USDT0-SOL", "L-BTC"]);
    });

    test("displays pre-bridge refund amounts in the original source asset", () => {
        const refund = {
            ...baseEvent,
            action: RskRescueMode.Refund,
            asset: "TBTC",
            amount: 1_102_000_000_000n,
            tokenAddress: "0x0000000000000000000000000000000000000004",
            restoredSwap: {
                ...restoredSwap,
                from: "TBTC",
                to: "L-BTC",
                bridge: {
                    sourceAsset: "USDT0-SOL",
                    destinationAsset: "USDT0",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Pre,
                },
                dex: {
                    hops: [
                        {
                            type: SwapType.Dex,
                            from: "USDT0",
                            to: "TBTC",
                            dexDetails: {
                                chain: "ARB",
                                tokenIn:
                                    "0x0000000000000000000000000000000000000005",
                                tokenOut:
                                    "0x0000000000000000000000000000000000000004",
                            },
                        },
                    ],
                    position: SwapPosition.Pre,
                    quoteAmount: 1_100_000,
                },
            },
        } as EvmRescueResult;

        expect(getEvmRefundDisplayAmount(refund, "TBTC")).toMatchObject({
            asset: "USDT0-SOL",
        });
        expect(
            getEvmRefundDisplayAmount(refund, "TBTC").amount.toString(),
        ).toBe("1100000");
        expect(getEvmRefundDisplayQuoteParams(refund, "TBTC")).toEqual({
            amount: 1_102_000_000_000n,
            asset: "USDT0-SOL",
            chain: "ARB",
            tokenIn: "0x0000000000000000000000000000000000000004",
            tokenOut: "0x0000000000000000000000000000000000000005",
        });
    });

    test("does not attach QzNPe7rckJCp metadata to a zero-preimage refund row by amount", async () => {
        const mnemonic =
            "awake father sword slab matrix myth cargo lock river thumb inspire speed";
        const restored = await mapRestoredEvmSwaps(
            [
                {
                    id: "QzNPe7rckJCp",
                    type: SwapType.Chain,
                    status: "transaction.server.confirmed",
                    createdAt: 1782787562,
                    from: "TBTC",
                    to: "L-BTC",
                    preimageHash:
                        "c75a1b92ece410e13823372edceb1fc148c37d36586c2ccd8b2c78dac1556a8e",
                    claimDetails: {
                        tree: {
                            claimLeaf: { version: 196, output: "51" },
                            refundLeaf: { version: 196, output: "51" },
                        },
                        amount: 13341,
                        keyIndex: 71,
                        transaction: {
                            id: "6ba69b919aaf28f5ec746f97cde06da136c77390082de0b52674954b58a51aa1",
                            vout: 1,
                        },
                        lockupAddress: "lockup",
                        serverPublicKey:
                            "03bb779740ad43c9337bf89a23062a8564b2cf5a75fd7e317a352965ee1b4a51b2",
                        timeoutBlockHeight: 3953207,
                        blindingKey:
                            "c43345f5cbf63cd5be4044c0eb7b0991cc2465599fcf2e8d6127ec3847943dc4",
                        preimageHash:
                            "c75a1b92ece410e13823372edceb1fc148c37d36586c2ccd8b2c78dac1556a8e",
                    },
                    metadata: await encryptSwapMetadata(mnemonic, {
                        dex: {
                            hops: [
                                {
                                    type: SwapType.Dex,
                                    from: "USDT0",
                                    to: "TBTC",
                                },
                            ],
                            position: SwapPosition.Pre,
                            quoteAmount: 13334,
                        },
                        bridge: {
                            sourceAsset: "USDT0-SOL",
                            destinationAsset: "USDT0",
                            kind: BridgeKind.Oft,
                            position: SwapPosition.Pre,
                        },
                    }),
                },
            ],
            mnemonic,
        );

        const [enriched] = enrichEvmRescueResults(
            [
                {
                    ...baseEvent,
                    action: RskRescueMode.Refund,
                    asset: "TBTC",
                    transactionHash:
                        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                    preimageHash: `0x${"00".repeat(32)}`,
                    amount: 99_039_478_307_028n,
                },
            ],
            restored,
        );

        expect(restored).toHaveLength(0);
        expect(enriched.restoredSwap).toBeUndefined();
        expect(enriched.bridge).toBeUndefined();
        expect(getEvmDisplayAssets(enriched)).toEqual(["TBTC"]);
    });

    test("hides the QzNPe7rckJCp generic restore row when the EVM refund row exists", () => {
        const restoreRow = {
            id: "QzNPe7rckJCp",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1782787562,
            from: "TBTC",
            to: "L-BTC",
            preimageHash:
                "c75a1b92ece410e13823372edceb1fc148c37d36586c2ccd8b2c78dac1556a8e",
        };
        const evmPreimageHashes = new Set([
            "c75a1b92ece410e13823372edceb1fc148c37d36586c2ccd8b2c78dac1556a8e",
        ]);

        expect(isEvmRestoreCandidate(restoreRow)).toBe(true);
        expect(shouldShowEvmRestoreResult(restoreRow, evmPreimageHashes)).toBe(
            false,
        );
    });

    test("shows unmatched EVM restore rows while the chain scan is still running", () => {
        const restoreRow = {
            id: "restore-only",
            type: SwapType.Chain,
            status: "transaction.server.confirmed",
            createdAt: 1782787562,
            from: "TBTC",
            to: "L-BTC",
            preimageHash:
                "c75a1b92ece410e13823372edceb1fc148c37d36586c2ccd8b2c78dac1556a8e",
        };

        expect(isEvmRestoreCandidate(restoreRow)).toBe(true);
        expect(shouldShowEvmRestoreResult(restoreRow, new Set())).toBe(true);
    });

    test("falls back to the routed EVM asset pair for unmatched claim rows", () => {
        expect(
            getEvmDisplayAssets({
                ...baseEvent,
                bridge: {
                    sourceAsset: "USDT0",
                    destinationAsset: "USDT0-SOL",
                    kind: BridgeKind.Oft,
                    position: SwapPosition.Post,
                },
                dex: {
                    hops: [{ type: SwapType.Dex, from: "TBTC", to: "USDT0" }],
                    position: SwapPosition.Post,
                    quoteAmount: 1000,
                },
            }),
        ).toEqual(["TBTC", "USDT0-SOL"]);
    });

    test("uses restored swap endpoints for post-bridge claim rows", () => {
        expect(
            getEvmDisplayAssets({
                ...baseEvent,
                restoredSwap,
            }),
        ).toEqual(["L-BTC", "USDT0-SOL"]);
    });

    test("maps restored post-dex claims from restore transaction metadata only", () => {
        const transactionHash =
            "0x1111111111111111111111111111111111111111111111111111111111111111";
        const result = mapRestoredEvmClaimResult(
            {
                ...restoredSwap,
                lockupTx: undefined,
                commitmentLockupTxHash: undefined,
                bridge: undefined,
                evmClaimDetails: {
                    ...restoredSwap.evmClaimDetails!,
                    amount: 70_000,
                    transaction: { id: transactionHash },
                },
            },
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        );

        if (result === undefined) {
            throw new Error("missing restored EVM claim result");
        }

        expect(result.action).toBe(RskRescueMode.Claim);
        expect(result.asset).toBe("TBTC");
        expect(result.transactionHash).toBe(transactionHash);
        expect(result.bridge).toBeUndefined();
        expect(result.dex?.position).toBe(SwapPosition.Post);
        expect(getEvmDisplayAssets(result)).toEqual(["L-BTC", "USDT0"]);
    });

    test("maps restored EVM claim amount to token units", () => {
        const result = mapRestoredEvmClaimResult(
            {
                ...restoredSwap,
                evmClaimDetails: {
                    ...restoredSwap.evmClaimDetails!,
                    amount: 70_000,
                },
            },
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        );

        expect(result?.asset).toBe("TBTC");
        expect(result?.amount).toBe(700_000_000_000_000n);
    });

    test("merges scan and restore-derived claims despite hash format differences", () => {
        // Scan results carry 0x-prefixed identifiers while restore-derived
        // results are unprefixed; both must collapse into one entry.
        const restoreDerived = mapRestoredEvmClaimResult(
            {
                ...restoredSwap,
                lockupTx: undefined,
                commitmentLockupTxHash: undefined,
            },
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        );

        if (restoreDerived === undefined) {
            throw new Error("missing restored EVM claim result");
        }

        for (const [current, next] of [
            [[baseEvent], [restoreDerived]],
            [[restoreDerived], [baseEvent]],
        ]) {
            const merged = mergeEvmRescueResults(current, next);
            expect(merged).toHaveLength(1);
            expect(merged[0].preimage).toBeDefined();
            expect(merged[0].restoredSwap?.id).toBe("swap-id");
        }
    });

    test("enriches scanner claims with the restored claim transaction hash", () => {
        const [enriched] = enrichEvmRescueResults(
            [baseEvent],
            [
                {
                    ...restoredSwap,
                    lockupTx: undefined,
                    commitmentLockupTxHash: undefined,
                    evmClaimDetails: {
                        ...restoredSwap.evmClaimDetails!,
                        transaction: {
                            id: baseEvent.transactionHash
                                .toUpperCase()
                                .replace(/^0X/, ""),
                        },
                    },
                },
            ],
        );

        expect(enriched.restoredSwap?.id).toBe("swap-id");
        expect(enriched.dex?.hops[0].to).toBe("USDT0");
    });

    test("normalizes identifiers in restored claim results", () => {
        const result = mapRestoredEvmClaimResult(
            {
                ...restoredSwap,
                preimageHash: baseEvent.preimageHash.toUpperCase(),
                evmClaimDetails: {
                    ...restoredSwap.evmClaimDetails!,
                    transaction: {
                        id: baseEvent.transactionHash.replace(/^0x/, ""),
                    },
                },
            },
            "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        );

        expect(result?.transactionHash).toBe(baseEvent.transactionHash);
        expect(result?.preimageHash).toBe(
            baseEvent.preimageHash.replace(/^0x/, ""),
        );
        expect(result?.preimage).toBe("c".repeat(64));
    });

    test("does not map restored claims with missing or unknown details", () => {
        const preimage =
            "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

        expect(
            mapRestoredEvmClaimResult(
                { ...restoredSwap, evmClaimDetails: undefined },
                preimage,
            ),
        ).toBeUndefined();
        expect(
            mapRestoredEvmClaimResult(
                {
                    ...restoredSwap,
                    evmClaimDetails: {
                        ...restoredSwap.evmClaimDetails!,
                        transaction: undefined,
                    },
                },
                preimage,
            ),
        ).toBeUndefined();
        expect(
            mapRestoredEvmClaimResult(
                { ...restoredSwap, preimageHash: "0x" },
                preimage,
            ),
        ).toBeUndefined();
        expect(
            mapRestoredEvmClaimResult(
                {
                    ...restoredSwap,
                    dex: {
                        ...restoredSwap.dex!,
                        hops: [
                            { type: SwapType.Dex, from: "DOGE", to: "USDT0" },
                        ],
                    },
                },
                preimage,
            ),
        ).toBeUndefined();
    });

    test("keeps swaps with only a claim transaction when filtering hydrated EVM swaps", () => {
        const claimOnly = {
            ...restoredSwap,
            lockupTx: undefined,
            commitmentLockupTxHash: undefined,
        };

        expect(filterHydratedEvmSwaps([claimOnly])).toEqual([claimOnly]);
        expect(
            filterHydratedEvmSwaps([
                {
                    ...claimOnly,
                    evmClaimDetails: {
                        ...restoredSwap.evmClaimDetails!,
                        transaction: undefined,
                    },
                },
            ]),
        ).toEqual([]);
    });

    test("does not match restored metadata on empty identifiers", () => {
        const [enriched] = enrichEvmRescueResults(
            [
                {
                    ...baseEvent,
                    transactionHash: "0x",
                    preimageHash: "0x",
                    claimAddress: "0x",
                },
            ],
            [
                {
                    ...restoredSwap,
                    preimageHash: "",
                    evmClaimDetails: {
                        ...restoredSwap.evmClaimDetails!,
                        claimAddress: "0x",
                        transaction: { id: "" },
                    },
                },
            ],
        );

        expect(enriched.restoredSwap).toBeUndefined();
    });
});
