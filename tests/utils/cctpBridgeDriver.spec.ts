import { TransactionReceiptNotFoundError } from "viem";

import { config as runtimeConfig } from "../../src/config";
import {
    BridgeKind,
    CctpReceiveMode,
    CctpTransferMode,
} from "../../src/configs/base";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { CctpBridgeDriver } from "../../src/utils/bridge/CctpBridgeDriver";
import { clearCache } from "../../src/utils/cache";
import type { CctpDirectSendTarget } from "../../src/utils/cctp/directSend";
import {
    cctpMessageSentTopic,
    cctpMintAndWithdrawTopic,
    encodeCctpGuid,
} from "../../src/utils/cctp/events";
import {
    addressToBytes32,
    cctpEmptyHookData,
    cctpFastFinalityThreshold,
    cctpForwardHookData,
    cctpStandardFinalityThreshold,
    cctpZeroBytes32,
} from "../../src/utils/cctp/evm";
import type { CctpSendParam } from "../../src/utils/cctp/types";
import * as solanaChain from "../../src/utils/chains/solana";
import { ExplorerKind } from "../../src/utils/explorerLink";

describe("CctpBridgeDriver", () => {
    const driver = new CctpBridgeDriver();
    const originalAssets = structuredClone(runtimeConfig.assets ?? {});
    const originalFeeApiUrl = runtimeConfig.cctpApiUrl;

    const route = {
        sourceAsset: "USDC",
        destinationAsset: "USDC-BASE",
    };
    const canonicalDestinationRoute = {
        sourceAsset: "USDC-BASE",
        destinationAsset: "USDC",
    };
    const solanaDestinationRoute = {
        sourceAsset: "USDC",
        destinationAsset: "USDC-SOL",
    };
    const solanaSourceRoute = {
        sourceAsset: "USDC-SOL",
        destinationAsset: "USDC",
    };
    const solanaRecipient = "EwwMqF8sFZRBGLchFfq61g5U7mPB14EnXxLQDWb5VAe5";
    const solanaRecipientAtaAddress =
        "GCdpTuRBNAj27vo1i6oeummWWc6EwbMS7LLHa2ths6RN";
    const solanaRecipientAta =
        "0xe1da52cc25e50ea64ae64ce209264e165a2e553b9d29256a82a92829f69ec729";
    const solanaRecipientSetupHookData =
        "0x636374702d666f7277617264000000000000000000000000000000000000002101cf3ac201d92eadcae0cd69b431f4c0e6d96c06bdb2fa28271b00409b5f1622ca";
    const requireUsdcCctpBridge = () => {
        const bridge = mainnetConfig.assets!.USDC.bridge;
        if (bridge?.kind !== BridgeKind.Cctp) {
            throw new Error("USDC is not configured as CCTP");
        }
        return bridge;
    };

    beforeAll(() => {
        runtimeConfig.assets = {
            ...runtimeConfig.assets,
            USDC: structuredClone(mainnetConfig.assets!.USDC),
            "USDC-BASE": structuredClone(mainnetConfig.assets!["USDC-BASE"]),
            "USDC-SOL": structuredClone(mainnetConfig.assets!["USDC-SOL"]),
        };
    });

    beforeEach(() => {
        clearCache();
        runtimeConfig.cctpApiUrl = "https://iris-api.circle.com";
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    {
                        finalityThreshold: 1000,
                        minimumFee: 1.3,
                        forwardFee: { low: 0, med: 0, high: 0 },
                    },
                    {
                        finalityThreshold: 2000,
                        minimumFee: 0,
                        forwardFee: { low: 0, med: 0, high: 0 },
                    },
                ]),
        } as Response);
    });

    afterEach(() => {
        clearCache();
        vi.restoreAllMocks();
    });

    afterAll(() => {
        runtimeConfig.assets = originalAssets;
        runtimeConfig.cctpApiUrl = originalFeeApiUrl;
    });

    test("should use the CCTP bridge explorer", () => {
        expect(driver.getExplorerKind()).toBe(ExplorerKind.Cctp);
    });

    test("should build quote options from the asset transfer mode", async () => {
        await expect(
            driver.buildQuoteOptions("USDC-BASE", "0xdestination", false),
        ).resolves.toEqual({
            recipient: "0xdestination",
            cctpTransferMode: CctpTransferMode.Fast,
            cctpReceiveMode: CctpReceiveMode.Forwarded,
        });
    });

    test("should default canonical destination quote options to manual receive", async () => {
        await expect(
            driver.buildQuoteOptions("USDC", "0xdestination", false),
        ).resolves.toEqual({
            recipient: "0xdestination",
            cctpTransferMode: CctpTransferMode.Fast,
            cctpReceiveMode: CctpReceiveMode.Manual,
        });
    });

    test("should request recipient setup in Solana destination quote options when needed", async () => {
        vi.spyOn(
            solanaChain,
            "shouldCreateSolanaTokenAccount",
        ).mockResolvedValue(true);

        await expect(
            driver.buildQuoteOptions("USDC-SOL", solanaRecipient, false),
        ).resolves.toEqual({
            recipient: solanaRecipient,
            cctpTransferMode: CctpTransferMode.Fast,
            cctpReceiveMode: CctpReceiveMode.Forwarded,
            cctpIncludeRecipientSetup: true,
        });
    });

    test("should quote fast-transfer receive amounts", async () => {
        await expect(
            driver.quoteReceiveAmount(route, 1_000_000n),
        ).resolves.toEqual({
            amountIn: 1_000_000n,
            amountOut: 999_870n,
        });
        expect(driver.getMessagingFeeToken(route)).toBeUndefined();
        expect(driver.getTransferFeeAsset(route)).toBe("USDC");
    });

    test("should default canonical destination quotes to manual receives", async () => {
        const fetchSpy = vi.mocked(globalThis.fetch);

        await expect(
            driver.quoteReceiveAmount(canonicalDestinationRoute, 1_000_000n),
        ).resolves.toEqual({
            amountIn: 1_000_000n,
            amountOut: 999_870n,
        });
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/burn/USDC/fees/6/3",
            expect.any(Object),
        );
    });

    test("should support standard-transfer quote overrides", async () => {
        await expect(
            driver.quoteReceiveAmount(route, 10_000n, {
                cctpTransferMode: CctpTransferMode.Standard,
            }),
        ).resolves.toEqual({
            amountIn: 10_000n,
            amountOut: 10_000n,
        });
    });

    test("should invert receive quotes with ceiling division", async () => {
        await expect(
            driver.quoteAmountInForAmountOut(route, 1_000_000n),
        ).resolves.toBe(1_000_131n);
    });

    test("quoteSend packs a fast-transfer CctpSendParam with permissionless caller", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const quote = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
        );

        expect(quote.msgFee).toEqual([0n, 0n]);
        expect(quote.minAmount).toBe(999_870n);
        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam).toEqual({
            amount: 1_000_000n,
            destinationDomain: 6,
            mintRecipient: addressToBytes32(recipient),
            destinationCaller: cctpZeroBytes32,
            maxFee: 131n,
            minFinalityThreshold: cctpFastFinalityThreshold,
            hookData: cctpForwardHookData,
        });
    });

    test("quoteSend defaults canonical destination burns to empty hook data", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(
            canonicalDestinationRoute,
        );
        const quote = await driver.quoteSend(
            contract,
            canonicalDestinationRoute,
            recipient,
            1_000_000n,
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam.destinationDomain).toBe(3);
        expect(sendParam.hookData).toBe(cctpEmptyHookData);
        expect(quote.minAmount).toBe(999_870n);
    });

    test("quoteSend supports Solana source burns to canonical USDC", async () => {
        vi.spyOn(
            solanaChain,
            "getSolanaRentExemptMinimumBalance",
        ).mockResolvedValue(2_039_280n);
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(solanaSourceRoute);
        const quote = await driver.quoteSend(
            contract,
            solanaSourceRoute,
            recipient,
            1_000_000n,
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam).toEqual({
            amount: 1_000_000n,
            destinationDomain: 3,
            mintRecipient: addressToBytes32(recipient),
            destinationCaller: cctpZeroBytes32,
            maxFee: 131n,
            minFinalityThreshold: cctpFastFinalityThreshold,
            hookData: cctpEmptyHookData,
        });
        expect(quote.msgFee).toEqual([2_039_280n, 0n]);
        expect(quote.minAmount).toBe(999_870n);
    });

    test("quoteSend encodes Solana destination recipients as USDC ATAs", async () => {
        vi.spyOn(
            solanaChain,
            "getSolanaAssociatedTokenAddress",
        ).mockResolvedValue(solanaRecipientAtaAddress);
        const contract = await driver.getQuotedContract(solanaDestinationRoute);
        const quote = await driver.quoteSend(
            contract,
            solanaDestinationRoute,
            solanaRecipient,
            1_000_000n,
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam.destinationDomain).toBe(5);
        expect(sendParam.mintRecipient).toBe(solanaRecipientAta);
        expect(sendParam.hookData).toBe(cctpForwardHookData);
    });

    test("quoteSend requests Solana ATA setup in fees and hook data", async () => {
        const fetchSpy = vi.mocked(globalThis.fetch);
        vi.spyOn(
            solanaChain,
            "getSolanaAssociatedTokenAddress",
        ).mockResolvedValue(solanaRecipientAtaAddress);
        const contract = await driver.getQuotedContract(solanaDestinationRoute);
        const quote = await driver.quoteSend(
            contract,
            solanaDestinationRoute,
            solanaRecipient,
            1_000_000n,
            { cctpIncludeRecipientSetup: true },
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam.mintRecipient).toBe(solanaRecipientAta);
        expect(sendParam.hookData).toBe(solanaRecipientSetupHookData);
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/burn/USDC/fees/3/5?forward=true&includeRecipientSetup=true",
            expect.any(Object),
        );
    });

    test("quoteSend honors a standard transfer override", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const quote = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
            { cctpTransferMode: CctpTransferMode.Standard },
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam.minFinalityThreshold).toBe(
            cctpStandardFinalityThreshold,
        );
        // Standard fee in the mock is 0 bps.
        expect(sendParam.maxFee).toBe(0n);
        expect(quote.minAmount).toBe(1_000_000n);
    });

    test("quoteSend folds the forwarding-service fee into maxFee", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    {
                        finalityThreshold: 1000,
                        minimumFee: 1.3,
                        forwardFee: {
                            low: 100_000,
                            med: 207_543,
                            high: 300_000,
                        },
                    },
                    {
                        finalityThreshold: 2000,
                        minimumFee: 0,
                        forwardFee: {
                            low: 50_000,
                            med: 105_000,
                            high: 150_000,
                        },
                    },
                ]),
        } as Response);

        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const quote = await driver.quoteSend(
            contract,
            route,
            recipient,
            100_000_000n,
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam.maxFee).toBe(220_588n);
        expect(quote.minAmount).toBe(99_779_457n);
    });

    test("manual CCTP quotes omit forwarding fees and hook data", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    {
                        finalityThreshold: 1000,
                        minimumFee: 1.3,
                    },
                    {
                        finalityThreshold: 2000,
                        minimumFee: 0,
                    },
                ]),
        } as Response);

        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const options = { cctpReceiveMode: CctpReceiveMode.Manual };
        await expect(
            driver.quoteAmountInForAmountOut(route, 1_000_000n, options),
        ).resolves.toBe(1_000_131n);
        const quote = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
            options,
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam.maxFee).toBe(131n);
        expect(sendParam.hookData).toBe(cctpEmptyHookData);
        expect(quote.minAmount).toBe(999_870n);
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/burn/USDC/fees/3/6",
            expect.any(Object),
        );
    });

    test("quoteSend falls back to options.recipient when direct recipient is missing", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const quote = await driver.quoteSend(
            contract,
            route,
            undefined,
            1_000_000n,
            { recipient },
        );

        const sendParam = quote.sendParam as CctpSendParam;
        expect(sendParam.mintRecipient).toBe(addressToBytes32(recipient));
    });

    test("quoteSend throws without a recipient", async () => {
        const contract = await driver.getQuotedContract(route);
        await expect(
            driver.quoteSend(contract, route, undefined, 1_000_000n),
        ).rejects.toThrow(/recipient/);
    });

    test("buildApprovalCall returns undefined (Router forceApproves)", async () => {
        await expect(
            driver.buildApprovalCall(route, "0xrouter", 1_000_000n, {
                // minimal signer stub; method must not touch it
                signTypedData: vi.fn(),
            } as never),
        ).resolves.toBeUndefined();
    });

    test("getContract resolves the source-chain TokenMessenger address", async () => {
        await expect(driver.getContract(route)).resolves.toMatchObject({
            name: "CCTP",
            address: requireUsdcCctpBridge().cctp.tokenMessenger,
        });
    });

    test("encodeRouterExecuteData encodes executeCctp with the CctpData", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const bridgeContract = await driver.getContract(route);
        const { sendParam, minAmount } = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
        );

        const fakeRouter = {
            address: "0xrouter",
        } as never;

        const encoded = driver.encodeRouterExecuteData({
            router: fakeRouter,
            route,
            bridgeContract,
            routerCalls: [],
            sendParam,
            minAmountLd: minAmount,
            lzTokenFee: 0n,
            refundAddress: "0x0000000000000000000000000000000000000000",
        });

        // toCctpData projects the 6-field on-chain struct, dropping `amount`.
        expect(encoded).toMatch(/^0x[0-9a-f]+$/);
    });

    test("populateRouterClaimBridgeTransaction signs ClaimCctp and populates claimERC20ExecuteCctp", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const bridgeContract = await driver.getContract(route);
        const { sendParam, minAmount } = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
        );

        const signTypedData = vi
            .fn()
            .mockResolvedValue(`0x${"b".repeat(64)}${"c".repeat(64)}1b`);
        const fakeRouter = {
            address: "0x0000000000000000000000000000000000000123",
        } as never;

        const outputTokenAddress = "0x0000000000000000000000000000000000009999";
        const claimTokenAddress = "0x0000000000000000000000000000000000008888";
        const refundAddress = "0x0000000000000000000000000000000000007777";
        const preimage = "a".repeat(64);
        const claimSignature = {
            v: 27,
            r: "0x" + "b".repeat(64),
            s: "0x" + "c".repeat(64),
        } as never;

        const tx = await driver.populateRouterClaimBridgeTransaction({
            router: fakeRouter,
            signer: { signTypedData } as never,
            chainId: 42_161n,
            preimage,
            claimAmount: 1_000_000n,
            claimTokenAddress,
            refundAddress,
            timeoutBlockHeight: 123_456,
            claimSignature,
            route,
            bridgeContract,
            outputTokenAddress,
            routerCalls: [],
            sendParam,
            minAmountLd: minAmount,
            lzTokenFee: 0n,
        });

        expect(tx.to).toBe("0x0000000000000000000000000000000000000123");
        expect(tx.data).toMatch(/^0x[0-9a-f]+$/);
        expect(signTypedData).toHaveBeenCalledTimes(1);
        const [typedData] = signTypedData.mock.calls[0];
        expect(typedData.domain).toEqual({
            name: "Router",
            version: "2",
            verifyingContract: "0x0000000000000000000000000000000000000123",
            chainId: 42_161n,
        });
        expect(typedData.types).toEqual({
            ClaimCctp: [
                { name: "preimage", type: "bytes32" },
                { name: "token", type: "address" },
                { name: "tokenMessenger", type: "address" },
                { name: "cctpData", type: "bytes32" },
                { name: "minAmount", type: "uint256" },
            ],
        });
        expect(typedData.message).toMatchObject({
            preimage: `0x${preimage}`,
            token: outputTokenAddress,
            tokenMessenger: bridgeContract.address,
            minAmount,
        });
    });

    test("getDirectSendTarget returns the source-chain TokenMessenger + burn token", async () => {
        const target = await driver.getDirectSendTarget(route);
        expect(target).toEqual({
            executionContract: {
                address: requireUsdcCctpBridge().cctp.tokenMessenger,
            },
            burnToken: mainnetConfig.assets!.USDC.token!.address,
        });
    });

    test("requiresDirectUserApproval always returns true (USDC is transferFrom-pulled)", async () => {
        const target = await driver.getDirectSendTarget(route);
        await expect(
            driver.requiresDirectUserApproval(target, {} as never),
        ).resolves.toBe(true);
    });

    test("direct-send required balances: amount in token, 0 native", async () => {
        const target = await driver.getDirectSendTarget(route);
        expect(
            driver.getDirectRequiredTokenAmount(target, 1_000_000n, [0n, 0n]),
        ).toBe(1_000_000n);
        expect(driver.getDirectRequiredNativeBalance(target, [0n, 0n])).toBe(
            0n,
        );
    });

    test("sendDirect forwards non-empty hooks to depositForBurnWithHook", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const quote = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
        );
        const target = (await driver.getDirectSendTarget(
            route,
        )) as CctpDirectSendTarget;

        const writeContract = vi.fn().mockResolvedValue("0xsent");
        const runner = {
            address: "0x1234567890123456789012345678901234567890",
            provider: {},
            writeContract,
        };

        const tx = await driver.sendDirect({
            target,
            runner: runner as never,
            sendParam: quote.sendParam,
            msgFee: [0n, 0n],
            refundAddress: "0x0000000000000000000000000000000000000000",
        });

        expect(tx).toEqual({ hash: "0xsent" });
        expect(writeContract).toHaveBeenCalledWith(
            expect.objectContaining({
                functionName: "depositForBurnWithHook",
            }),
        );
    });

    test("sendDirect uses depositForBurn when hook data is empty", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const quote = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
            { cctpReceiveMode: CctpReceiveMode.Manual },
        );
        const target = (await driver.getDirectSendTarget(
            route,
        )) as CctpDirectSendTarget;

        const writeContract = vi.fn().mockResolvedValue("0xsent");
        const runner = {
            address: "0x1234567890123456789012345678901234567890",
            provider: {},
            writeContract,
        };

        const tx = await driver.sendDirect({
            target,
            runner: runner as never,
            sendParam: quote.sendParam,
            msgFee: [0n, 0n],
            refundAddress: "0x0000000000000000000000000000000000000000",
        });

        expect(tx).toEqual({ hash: "0xsent" });
        expect(writeContract).toHaveBeenCalledWith(
            expect.objectContaining({
                functionName: "depositForBurn",
            }),
        );
    });

    test("sendDirect rejects malformed hook data", async () => {
        const recipient = "0x1234567890123456789012345678901234567890";
        const contract = await driver.getQuotedContract(route);
        const quote = await driver.quoteSend(
            contract,
            route,
            recipient,
            1_000_000n,
            { cctpReceiveMode: CctpReceiveMode.Manual },
        );
        const target = (await driver.getDirectSendTarget(
            route,
        )) as CctpDirectSendTarget;

        const runner = {
            address: "0x1234567890123456789012345678901234567890",
            provider: {},
            writeContract: vi.fn(),
        };

        await expect(
            driver.sendDirect({
                target,
                runner: runner as never,
                sendParam: {
                    ...(quote.sendParam as CctpSendParam),
                    hookData: "not-hex" as `0x${string}`,
                },
                msgFee: [0n, 0n],
                refundAddress: "0x0000000000000000000000000000000000000000",
            }),
        ).rejects.toThrow("invalid CCTP hook data");
    });

    // -- getSentEvent / getReceivedEventByGuid -----------------------------

    // Mirrors the helper in cctpEvents.spec.ts; kept local so the driver
    // test file is self-contained.
    const encodeBytesData = (hex: string): string => {
        const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
        const lengthBytes = stripped.length / 2;
        const lengthHex = lengthBytes.toString(16).padStart(64, "0");
        const paddingBytes = (32 - (lengthBytes % 32)) % 32;
        return `0x${"20".padStart(64, "0")}${lengthHex}${stripped}${"00".repeat(paddingBytes)}`;
    };
    const u32 = (n: number) => n.toString(16).padStart(8, "0");
    const u256 = (n: bigint) => n.toString(16).padStart(64, "0");
    const buildMessage = (sourceDomain: number, destDomain: number) => {
        const pad = "00".repeat(32);
        const sender = `000000000000000000000000${"22".repeat(20)}`;
        const recipient = `000000000000000000000000${"11".repeat(20)}`;
        const header =
            u32(2) +
            u32(sourceDomain) +
            u32(destDomain) +
            pad +
            sender +
            recipient +
            pad +
            u32(1000) +
            u32(1000);
        const body =
            u32(1) + pad + recipient + u256(1_000_000n) + pad + pad + pad + pad;
        return `0x${header}${body}`;
    };

    test("getSentEvent parses MessageSent and packs a source-domain-prefixed guid", () => {
        const message = buildMessage(3, 6);
        const sourceTxHash = "0xburntx";
        const event = driver.getSentEvent(
            {} as never,
            {
                transactionHash: sourceTxHash,
                logs: [
                    {
                        topics: [cctpMessageSentTopic],
                        data: encodeBytesData(message),
                        logIndex: 5,
                    },
                ],
            } as never,
            "0xmessenger",
        );

        // Guid pairs source domain with the source-chain tx hash (Circle's
        // Iris API indexes messages by that).
        expect(event.guid).toBe(`3:${sourceTxHash}`);
        expect(event.dstEid).toBe(6);
        expect(event.amountSentLD).toBe(1_000_000n);
        expect(event.amountReceivedLD).toBe(1_000_000n);
        expect(event.logIndex).toBe(5);
    });

    test("deriveSolanaSentGuid packs Solana CCTP guid from source tx hash", () => {
        expect(
            driver.deriveSolanaSentGuid({
                sourceAsset: "USDC-SOL",
                txHash: "solana-signature",
                logMessages: [],
            }),
        ).toBe(encodeCctpGuid(5, "solana-signature"));
    });

    test("getSentEvent throws when no MessageSent log is present", () => {
        expect(() =>
            driver.getSentEvent(
                {} as never,
                {
                    hash: "0xburntx",
                    logs: [{ topics: ["0xdeadbeef"], data: "0x" }],
                } as never,
                "0xmessenger",
            ),
        ).toThrow(/MessageSent/);
    });

    test("getReceivedEventByGuid polls Circle then reads mint from dest receipt", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [{ forwardTxHash: "0xforward" }],
                }),
        } as Response);

        const mintRecipient = "0x000000000000000000000000" + "aa".repeat(20);
        const mintToken = "0x000000000000000000000000" + "bb".repeat(20);
        const getTransactionReceipt = vi.fn().mockResolvedValue({
            blockNumber: 1_234,
            logs: [
                {
                    topics: [
                        cctpMintAndWithdrawTopic,
                        mintRecipient,
                        mintToken,
                    ],
                    data: `0x${u256(999_870n)}`,
                    logIndex: 4,
                },
            ],
        });

        const guid = encodeCctpGuid(3, "0xburntx");
        const result = await driver.getReceivedEventByGuid(
            {} as never,
            { getLogs: vi.fn(), getTransactionReceipt } as never,
            "0xmessenger",
            guid,
        );

        expect(result).toEqual({
            guid,
            srcEid: 3,
            toAddress: mintRecipient,
            amountReceivedLD: 999_870n,
            blockNumber: 1_234,
            logIndex: 4,
        });
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/messages/3?transactionHash=0xburntx",
            expect.any(Object),
        );
        expect(getTransactionReceipt).toHaveBeenCalledWith({
            hash: "0xforward",
        });
    });

    test("getReceivedEventByGuid returns undefined while Circle has no forward tx", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ messages: [{ status: "pending" }] }),
        } as Response);

        const getTransactionReceipt = vi.fn();
        const result = await driver.getReceivedEventByGuid(
            {} as never,
            { getLogs: vi.fn(), getTransactionReceipt } as never,
            "0xmessenger",
            encodeCctpGuid(3, "0xburntx"),
        );
        expect(result).toBeUndefined();
        expect(getTransactionReceipt).not.toHaveBeenCalled();
    });

    test("getReceivedEventByGuid returns undefined when dest receipt isn't indexed yet", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [{ forwardTxHash: "0xforward" }],
                }),
        } as Response);
        const getTransactionReceipt = vi
            .fn()
            .mockRejectedValue(
                new TransactionReceiptNotFoundError({ hash: "0xforward" }),
            );

        const result = await driver.getReceivedEventByGuid(
            {} as never,
            { getLogs: vi.fn(), getTransactionReceipt } as never,
            "0xmessenger",
            encodeCctpGuid(3, "0xburntx"),
        );
        expect(result).toBeUndefined();
    });

    test("getReceivedEventByGuid rejects malformed guids", async () => {
        await expect(
            driver.getReceivedEventByGuid(
                {} as never,
                {
                    getLogs: vi.fn(),
                    getTransactionReceipt: vi.fn(),
                } as never,
                "0xmessenger",
                "not-a-guid",
            ),
        ).rejects.toThrow(/invalid CCTP guid/);
    });
});
