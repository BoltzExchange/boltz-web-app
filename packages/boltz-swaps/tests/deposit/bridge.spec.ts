import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingBridgeSendKind } from "../../src/bridge/types.ts";
import { BridgeKind, CctpReceiveMode } from "../../src/types.ts";

const h = vi.hoisted(() => {
    const driver = {
        getPreRoute: vi.fn(),
        getQuotedContract: vi.fn(),
        buildQuoteOptions: vi.fn(),
        quoteSend: vi.fn(),
        getDirectSendTarget: vi.fn(),
        getSentEvent: vi.fn(),
        getReceivedEventByGuid: vi.fn(),
    };
    return {
        driver,
        requireDriverForAsset: vi.fn(() => driver),
        recoverPendingEvmCctpSend: vi.fn(),
        createAssetProvider: vi.fn(),
        getCctpAttestation: vi.fn(),
        populateCctpDirectSendTransaction: vi.fn(),
        parseCctpBurnMessage: vi.fn(),
        parseCctpMessageSent: vi.fn(),
        isCctpNonceUsed: vi.fn(),
        encodeCctpReceiveMessage: vi.fn(),
        getAssetBridge: vi.fn(),
        ensureUnlimitedApproval: vi.fn(),
        sendSponsored: vi.fn(),
    };
});

vi.mock("../../src/bridge/index.ts", () => ({
    bridgeRegistry: { requireDriverForAsset: h.requireDriverForAsset },
}));

vi.mock("../../src/bridge/pendingSend.ts", () => ({
    recoverPendingEvmCctpSend: h.recoverPendingEvmCctpSend,
}));

vi.mock("../../src/cctp/attestation.ts", () => ({
    getCctpAttestation: h.getCctpAttestation,
}));

vi.mock("../../src/cctp/directSend.ts", () => ({
    populateCctpDirectSendTransaction: h.populateCctpDirectSendTransaction,
}));

// Keep addressToBytes32 real (recipient cross-check); mock the rest.
vi.mock("../../src/cctp/evm.ts", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../src/cctp/evm.ts")>()),
    isCctpNonceUsed: h.isCctpNonceUsed,
    encodeCctpReceiveMessage: h.encodeCctpReceiveMessage,
}));

// Keep decodeCctpGuid real; mock the burn/message parsers.
vi.mock("../../src/cctp/events.ts", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../src/cctp/events.ts")>()),
    parseCctpBurnMessage: h.parseCctpBurnMessage,
    parseCctpMessageSent: h.parseCctpMessageSent,
}));

vi.mock("../../src/config.ts", () => ({
    getAssetBridge: h.getAssetBridge,
}));

vi.mock("../../src/evm/provider.ts", () => ({
    createAssetProvider: h.createAssetProvider,
}));

vi.mock("../../src/deposit/sponsored.ts", () => ({
    ensureUnlimitedApproval: h.ensureUnlimitedApproval,
    sendSponsored: h.sendSponsored,
}));

const { sponsoredCctpBurn, awaitCctpMint, manualMint, recoverBurn } =
    await import("../../src/deposit/bridge.ts");
const { addressToBytes32 } = await import("../../src/cctp/evm.ts");

const RECIP = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const SIGNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const TM = "0x1111111111111111111111111111111111111111";
const BT = "0x2222222222222222222222222222222222222222";
const MT = "0x3333333333333333333333333333333333333333";

const burnSigner = () => ({
    address: SIGNER,
    provider: {
        getTransactionCount: vi.fn(async () => 5),
        getBlockNumber: vi.fn(async () => 77n),
        waitForTransactionReceipt: vi.fn(async () => ({})),
    },
});

const mintSigner = () => ({
    address: SIGNER,
    provider: {
        getBlockNumber: vi.fn(async () => 42n),
        waitForTransactionReceipt: vi.fn(async () => ({})),
    },
});

beforeEach(() => {
    h.requireDriverForAsset.mockReturnValue(h.driver);
    h.driver.getPreRoute.mockReturnValue({ destinationAsset: "ARB-USDC" });
    h.driver.getQuotedContract.mockResolvedValue({});
    h.driver.buildQuoteOptions.mockResolvedValue({ recipient: "r" });
    h.driver.quoteSend.mockResolvedValue({ sendParam: { foo: 1 } });
    h.driver.getDirectSendTarget.mockResolvedValue({
        executionContract: { address: TM },
        burnToken: BT,
    });
    h.driver.getSentEvent.mockReturnValue({ guid: "g" });
    h.driver.getReceivedEventByGuid.mockResolvedValue(undefined);

    h.createAssetProvider.mockReturnValue({});
    h.populateCctpDirectSendTransaction.mockReturnValue({ data: "0xBURN" });
    h.parseCctpMessageSent.mockReturnValue({ nonce: "0x00", message: "0xM" });
    h.parseCctpBurnMessage.mockReturnValue({
        nonce: "0xnonce",
        amountReceived: 990000n,
    });
    h.getAssetBridge.mockReturnValue({
        kind: BridgeKind.Cctp,
        cctp: { messageTransmitter: MT },
    });
    h.ensureUnlimitedApproval.mockResolvedValue(undefined);
    h.sendSponsored.mockResolvedValue("0xsend");
    h.getCctpAttestation.mockResolvedValue({
        message: "0xMSG",
        attestation: "0xATT",
    });
    h.isCctpNonceUsed.mockResolvedValue(false);
    h.encodeCctpReceiveMessage.mockReturnValue("0xRECV");
    h.recoverPendingEvmCctpSend.mockResolvedValue("RESULT");
});

afterEach(() => vi.clearAllMocks());

describe("sponsoredCctpBurn", () => {
    it("persists the recovery record before broadcasting and derives its fields", async () => {
        const order: string[] = [];
        h.ensureUnlimitedApproval.mockImplementation(async () => {
            order.push("approve");
        });
        h.sendSponsored.mockImplementation(async () => {
            order.push("send");
            return "0xburnhash";
        });
        const persistPending = vi.fn(async (_record: unknown) => {
            order.push("persist");
        });
        const signer = burnSigner();

        const result = await sponsoredCctpBurn({
            sourceAsset: "USDC-POL",
            amount: 1_000_000n,
            mintRecipient: RECIP,
            signer: signer as never,
            persistPending,
        });

        // Crash-recoverable ordering: persist strictly before the broadcast.
        expect(order).toEqual(["approve", "persist", "send"]);

        const record = persistPending.mock.calls[0]?.[0] as never as Record<
            string,
            unknown
        >;
        expect(record.kind).toBe(PendingBridgeSendKind.EvmCctp);
        expect(record.sender).toBe(getAddress(SIGNER));
        expect(record.fromNonce).toBe(5);
        expect(record.fromBlock).toBe(77);
        expect(record.tokenMessenger).toBe(getAddress(TM));
        expect(record.messageTransmitter).toBe(getAddress(MT));
        expect(record.calldata).toBe("0xBURN");

        expect(result.burnTxHash).toBe("0xburnhash");
        expect(result.guid).toBe("g");
        expect(result.cctpNonce).toBe("0x00");
        expect(result.cctpMessage).toBe("0xM");
        expect(result.pendingSend).toBe(record as never);

        expect(signer.provider.waitForTransactionReceipt).toHaveBeenCalledWith({
            hash: "0xburnhash",
        });
    });

    it("quotes in Forwarded mode and approves the burn token to the token messenger", async () => {
        const persistPending = vi.fn(async () => {});

        await sponsoredCctpBurn({
            sourceAsset: "USDC-POL",
            amount: 1_000_000n,
            mintRecipient: RECIP,
            signer: burnSigner() as never,
            persistPending,
        });

        expect(h.driver.buildQuoteOptions).toHaveBeenCalledWith(
            "ARB-USDC",
            RECIP,
            false,
        );
        const [, , recipientArg, amountArg, opts] = h.driver.quoteSend.mock
            .calls[0] as never as unknown[];
        expect(recipientArg).toBe(RECIP);
        expect(amountArg).toBe(1_000_000n);
        expect((opts as { cctpReceiveMode: unknown }).cctpReceiveMode).toBe(
            CctpReceiveMode.Forwarded,
        );
        // baseOptions are spread through, not discarded.
        expect((opts as { recipient: unknown }).recipient).toBe("r");

        expect(h.ensureUnlimitedApproval).toHaveBeenCalledWith(
            expect.anything(),
            getAddress(BT),
            getAddress(TM),
            1_000_000n,
        );
    });

    it("throws when no MessageSent log is in the burn receipt", async () => {
        h.parseCctpMessageSent.mockReturnValueOnce(undefined);
        await expect(
            sponsoredCctpBurn({
                sourceAsset: "USDC-POL",
                amount: 1n,
                mintRecipient: RECIP,
                signer: burnSigner() as never,
                persistPending: vi.fn(async () => {}),
            }),
        ).rejects.toThrow(/no MessageSent log/);
    });

    it("fails fast on a missing pre-route without approving, sending, or persisting", async () => {
        h.driver.getPreRoute.mockReturnValueOnce(undefined);
        const persistPending = vi.fn(async () => {});
        await expect(
            sponsoredCctpBurn({
                sourceAsset: "USDC-POL",
                amount: 1n,
                mintRecipient: RECIP,
                signer: burnSigner() as never,
                persistPending,
            }),
        ).rejects.toThrow(/no CCTP pre-route/);
        expect(h.ensureUnlimitedApproval).not.toHaveBeenCalled();
        expect(h.sendSponsored).not.toHaveBeenCalled();
        expect(persistPending).not.toHaveBeenCalled();
    });
});

describe("awaitCctpMint", () => {
    it("returns undefined on timeout without querying the received event", async () => {
        const result = await awaitCctpMint({
            sourceAsset: "USDC-POL",
            guid: "7:0xabc",
            mintRecipient: RECIP,
            deadlineMs: Date.now() - 1,
        });
        expect(result).toBeUndefined();
        expect(h.driver.getReceivedEventByGuid).not.toHaveBeenCalled();
    });

    it("throws when the abort signal is set", async () => {
        await expect(
            awaitCctpMint({
                sourceAsset: "USDC-POL",
                guid: "7:0xabc",
                mintRecipient: RECIP,
                deadlineMs: Date.now() + 10_000,
                pollIntervalMs: 1,
                signal: { aborted: true } as never,
            }),
        ).rejects.toThrow(/aborted/);
    });

    it("ignores a recipient-mismatched mint and keeps polling until a match", async () => {
        h.driver.getReceivedEventByGuid
            .mockResolvedValueOnce({
                toAddress: `0x${"ff".repeat(32)}`,
                amountReceivedLD: 1n,
                blockNumber: 1,
            })
            .mockResolvedValueOnce({
                toAddress: addressToBytes32(RECIP),
                amountReceivedLD: 990000n,
                blockNumber: 9,
            });

        const result = await awaitCctpMint({
            sourceAsset: "USDC-POL",
            guid: "7:0xabc",
            mintRecipient: RECIP,
            deadlineMs: Date.now() + 10_000,
            pollIntervalMs: 1,
        });

        expect(result).toEqual({ mintedAmount: 990000n, blockNumber: 9 });
        expect(h.driver.getReceivedEventByGuid).toHaveBeenCalledTimes(2);
    });

    it("throws on a missing pre-route", async () => {
        h.driver.getPreRoute.mockReturnValueOnce(undefined);
        await expect(
            awaitCctpMint({
                sourceAsset: "USDC-POL",
                guid: "7:0xabc",
                mintRecipient: RECIP,
                deadlineMs: Date.now() + 10_000,
            }),
        ).rejects.toThrow(/no CCTP pre-route/);
    });
});

describe("manualMint", () => {
    it("skips receiveMessage when the nonce is already used (no double-mint)", async () => {
        h.isCctpNonceUsed.mockResolvedValue(true);
        const signer = mintSigner();

        const result = await manualMint({
            guid: "7:0xabc",
            signer: signer as never,
        });

        expect(h.sendSponsored).not.toHaveBeenCalled();
        expect(result).toEqual({
            mintTxHash: undefined,
            mintedAmount: 990000n,
            blockNumber: 42,
        });
    });

    it("submits receiveMessage to the message transmitter when the nonce is unused", async () => {
        h.isCctpNonceUsed.mockResolvedValue(false);
        h.sendSponsored.mockResolvedValue("0xmint");
        const signer = mintSigner();

        const result = await manualMint({
            guid: "7:0xabc",
            signer: signer as never,
        });

        expect(h.getCctpAttestation).toHaveBeenCalledWith(7, "0xabc");
        expect(h.sendSponsored).toHaveBeenCalledWith(signer, {
            to: getAddress(MT),
            data: "0xRECV",
        });
        expect(result).toEqual({
            mintTxHash: "0xmint",
            mintedAmount: 990000n,
            blockNumber: 42,
        });
    });

    it("throws on an undecodable guid", async () => {
        await expect(
            manualMint({ guid: "not-a-guid", signer: mintSigner() as never }),
        ).rejects.toThrow(/invalid CCTP guid/);
    });

    it("returns undefined without sending when the attestation is not ready", async () => {
        h.getCctpAttestation.mockResolvedValueOnce(undefined);
        const result = await manualMint({
            guid: "7:0xabc",
            signer: mintSigner() as never,
        });
        expect(result).toBeUndefined();
        expect(h.isCctpNonceUsed).not.toHaveBeenCalled();
        expect(h.sendSponsored).not.toHaveBeenCalled();
    });

    it("throws when the bridge asset is not configured for CCTP", async () => {
        h.getAssetBridge.mockReturnValue(undefined);
        await expect(
            manualMint({ guid: "7:0xabc", signer: mintSigner() as never }),
        ).rejects.toThrow(/missing CCTP config for asset/);
    });
});

describe("recoverBurn", () => {
    it("delegates to recoverPendingEvmCctpSend with the source-asset provider", async () => {
        h.createAssetProvider.mockReturnValue("PROV");
        h.recoverPendingEvmCctpSend.mockResolvedValue("RESULT");
        const pending = { kind: PendingBridgeSendKind.EvmCctp } as never;

        const result = await recoverBurn("USDC-POL", pending);

        expect(h.createAssetProvider).toHaveBeenCalledWith("USDC-POL");
        expect(h.recoverPendingEvmCctpSend).toHaveBeenCalledWith(
            pending,
            "PROV",
        );
        expect(result).toBe("RESULT");
    });
});
