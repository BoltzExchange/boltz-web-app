import { config } from "../../src/config";
import { NetworkTransport } from "../../src/configs/base";
import * as assets from "../../src/consts/Assets";
import { ExplorerKind, blockExplorerLink } from "../../src/utils/explorerLink";

describe("explorerLink", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("blockExplorerLink", () => {
        test("links to asset addresses by default", () => {
            const address = "bcrt1qh47qjmkkdxmg8cjxhe7gnnuluwddcw692cfjsv";
            expect(blockExplorerLink("BTC", false, address)).toBe(
                `${config.assets!["BTC"].blockExplorerUrl!.normal}/address/${address}`,
            );
        });

        test("links to asset transactions by default", () => {
            const txId =
                "813c90372c9b774396c66099cf8015f9510a8ba5686cbb78d8e848959fe7bb5d";
            expect(blockExplorerLink("BTC", true, txId)).toBe(
                `${config.assets!["BTC"].blockExplorerUrl!.normal}/tx/${txId}`,
            );
        });

        test("builds CCTP links via the messages endpoint", () => {
            const txId =
                "0x3ca4451e3008d523eec1c64e617663894e47cabd335654bd9f65724772682de8";
            expect(
                blockExplorerLink("USDC-BASE", true, txId, ExplorerKind.Cctp),
            ).toBe(
                `${config.cctpExplorerUrl}/messages?transactionHash=${txId}`,
            );
        });

        test("builds LayerZero tx links", () => {
            const txId =
                "813c90372c9b774396c66099cf8015f9510a8ba5686cbb78d8e848959fe7bb5d";
            expect(
                blockExplorerLink("BTC", true, txId, ExplorerKind.LayerZero),
            ).toBe(`${config.layerZeroExplorerUrl}/tx/${txId}`);
        });

        test("prefixes Tron LayerZero tx hashes with 0x", () => {
            vi.spyOn(assets, "getNetworkTransport").mockReturnValue(
                NetworkTransport.Tron,
            );
            const txId =
                "2ae5f8e33daf1d608f7aad172b52fb00dbf98a43735c2ed07e203049bcc19815";
            expect(
                blockExplorerLink(
                    "USDT0-TRON",
                    true,
                    txId,
                    ExplorerKind.LayerZero,
                ),
            ).toBe(`${config.layerZeroExplorerUrl}/tx/0x${txId}`);
        });

        test("does not use the CCTP messages endpoint for addresses", () => {
            const address = "0x0000000000000000000000000000000000000000";
            expect(
                blockExplorerLink(
                    "USDC-BASE",
                    false,
                    address,
                    ExplorerKind.Cctp,
                ),
            ).toBe(`${config.cctpExplorerUrl}/address/${address}`);
        });

        test("returns undefined when no explorer base URL is configured", () => {
            expect(
                blockExplorerLink("UNKNOWN-ASSET", true, "deadbeef"),
            ).toBeUndefined();
        });

        test("returns undefined for CCTP when cctpExplorerUrl is missing", () => {
            const original = config.cctpExplorerUrl;
            try {
                (
                    config as { cctpExplorerUrl: string | undefined }
                ).cctpExplorerUrl = undefined;
                expect(
                    blockExplorerLink(
                        "USDC-BASE",
                        true,
                        "0xdead",
                        ExplorerKind.Cctp,
                    ),
                ).toBeUndefined();
            } finally {
                (
                    config as { cctpExplorerUrl: string | undefined }
                ).cctpExplorerUrl = original;
            }
        });
    });
});
