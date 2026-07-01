import {
    BridgeKind,
    RskRescueMode,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";

import {
    getEvmDisplayAssets,
    getEvmFinalAsset,
} from "../../src/pages/external-rescue/Results";
import {
    enrichEvmRescueResults,
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

    test("enriches scanner results with backend metadata by preimage hash", () => {
        const [enriched] = enrichEvmRescueResults([baseEvent], [restoredSwap]);

        expect(enriched.restoredSwap?.id).toBe("swap-id");
        expect(enriched.dex?.hops[0].to).toBe("USDT0");
        expect(enriched.bridge?.destinationAsset).toBe("USDT0-SOL");
    });

    test("enriches scanner refund results with backend metadata by refund transaction", () => {
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

    test("enriches scanner results with backend metadata by unambiguous claim address", () => {
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

        expect(enriched.restoredSwap?.id).toBe("swap-id");
        expect(enriched.bridge?.destinationAsset).toBe("USDT0-SOL");
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
        const refund = {
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

        expect(getEvmFinalAsset(refund)).toBe("USDT0-SOL");
        expect(getEvmDisplayAssets(refund)).toEqual(["USDT0-SOL"]);
    });

    test("does not infer source asset from unmatched pre-dex refund rows", () => {
        const refund = {
            ...baseEvent,
            action: RskRescueMode.Refund,
            dex: {
                hops: [{ type: SwapType.Dex, from: "USDT0", to: "TBTC" }],
                position: SwapPosition.Pre,
                quoteAmount: 1000,
            },
        };

        expect(getEvmFinalAsset(refund)).toBe("TBTC");
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

    test("enriches zero-preimage refund rows by commitment match id", () => {
        const commitmentMatch = {
            version: 1 as const,
            id: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        };
        const preRoutedSwap: RestoredEvmSwap = {
            ...restoredSwap,
            id: "p5BsvXMbpxGX",
            from: "TBTC",
            to: "L-BTC",
            preimageHash:
                "ccbe6b214f2efc84dc30b0c21a594ad82a810a90b0b6f3c9ee9bb0d254676e6c",
            commitmentMatch,
            dex: {
                hops: [{ type: SwapType.Dex, from: "USDT0", to: "TBTC" }],
                position: SwapPosition.Pre,
                quoteAmount: 1000,
            },
            bridge: {
                sourceAsset: "USDT0-SOL",
                destinationAsset: "USDT0",
                kind: BridgeKind.Oft,
                position: SwapPosition.Pre,
                refundAddress: "source-wallet",
            },
        };
        const [enriched] = enrichEvmRescueResults(
            [
                {
                    ...baseEvent,
                    action: RskRescueMode.Refund,
                    asset: "TBTC",
                    transactionHash:
                        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                    preimageHash: `0x${"00".repeat(32)}`,
                    commitmentMatchId: commitmentMatch.id,
                },
            ],
            [preRoutedSwap],
        );

        expect(enriched.restoredSwap?.id).toBe("p5BsvXMbpxGX");
        expect(enriched.bridge?.sourceAsset).toBe("USDT0-SOL");
        expect(enriched.bridge?.refundAddress).toBe("source-wallet");
        expect(getEvmDisplayAssets(enriched)).toEqual([
            "USDT0-SOL",
            "L-BTC",
        ]);
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

    test("does not attach QzNPe7rckJCp metadata to a zero-preimage refund row by amount", async () => {
        const [restored] = await mapRestoredEvmSwaps(
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
                    metadata:
                        "5fd4130da65fc71c2333f4be3e16f5d087cb9ea58423446b332acc0027b5040769be35f0ceef0115a9ddd6d71febcc6ccb41eada8bca85642723551a43d45a527521e0a37ea983cb86813a02f19421574bae89897e8cf22293f14f1d79e160f9d169aa430c8d74712fd20ba9c4fe2820d3835804c5cd088e53a1bc2f04d78ec0e964d7e8bea8b29010b426796df57936d4de955140d0fdffd9a787a00ac5354e42db9ed5ff110c225a03d3aba0ebad070bbe9fbb93177b3d4173a01ed4901556e1fc401a388226f44f416cdc6c005735b41732162de01430d7222fa27bda3959d9b4626e0b3d8b4f089c60eedbc1b0c05327fcae0cfcbdead6ababb884a3cfb68889306ca3d85b87c2b6122e6f0cbbf965644883baf11e0bb503ee71f1932c84ebaba36d117f65538a8ad7229de8e224cc2a3c4fbcee060d68b18a44662a42fe7ae4ad5163cc784ee0d39014faca4043011bbcbb5b368b71c88736c0434e29",
                },
            ],
            "awake father sword slab matrix myth cargo lock river thumb inspire speed",
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
            [restored],
        );

        expect(restored.bridge?.sourceAsset).toBe("USDT0-SOL");
        expect(restored.dex?.hops[0]).toMatchObject({
            from: "USDT0",
            to: "TBTC",
        });
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
        expect(
            shouldShowEvmRestoreResult(
                restoreRow,
                evmPreimageHashes,
                undefined,
            ),
        ).toBe(false);
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
