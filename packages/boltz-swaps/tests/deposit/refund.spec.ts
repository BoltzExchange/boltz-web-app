import { type Hex, decodeFunctionData, getAddress, parseSignature } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import { vFromSignature } from "../../src/bridge/signature.ts";
import * as sponsored from "../../src/deposit/sponsored.ts";
import * as commitment from "../../src/evm/commitment.ts";
import * as transaction from "../../src/evm/transaction.ts";
import { erc20SwapAbi } from "../../src/generated/evm-abis.ts";

const USDC = "0x0000000000000000000000000000000000000ABC";
const CONTRACT = "0x0000000000000000000000000000000000000001";
const CLAIM = "0x0000000000000000000000000000000000000002";
const REFUND = "0x0000000000000000000000000000000000000003";
const PREIMAGE_HASH = ("0x" + "11".repeat(32)) as Hex;
const SIG_HEX = ("0x" + "aa".repeat(32) + "bb".repeat(32) + "1b") as Hex;

vi.mock("../../src/client.ts", () => ({
    getCommitmentLockupDetails: vi.fn(async () => ({ contract: CONTRACT })),
}));

vi.mock("../../src/evm/transaction.ts", () => ({
    getLockupEvent: vi.fn(() => ({
        preimageHash: PREIMAGE_HASH,
        amount: 990_000n,
        tokenAddress: USDC,
        claimAddress: CLAIM,
        refundAddress: REFUND,
        timelock: 100n,
        logIndex: 5,
    })),
}));

vi.mock("../../src/evm/commitment.ts", () => ({
    getEvmRefundCooperativeSignature: vi.fn(async () => SIG_HEX),
}));

vi.mock("../../src/deposit/sponsored.ts", () => ({
    sendSponsored: vi.fn(async () => "0xrefund"),
}));

const { sponsoredCommitmentRefund } =
    await import("../../src/deposit/refund.ts");

const getLockupEvent = vi.mocked(transaction.getLockupEvent);
const getEvmRefundCooperativeSignature = vi.mocked(
    commitment.getEvmRefundCooperativeSignature,
);
const sendSponsored = vi.mocked(sponsored.sendSponsored);

const makeSigner = () =>
    ({
        provider: { waitForTransactionReceipt: vi.fn(async () => ({})) },
    }) as never;

describe("sponsoredCommitmentRefund", () => {
    afterEach(() => vi.clearAllMocks());

    it("encodes refundCooperative with the 9 re-parsed lockup args", async () => {
        const signer = makeSigner();
        const result = await sponsoredCommitmentRefund({
            asset: "USDC",
            commitmentTxHash: "0xcommit",
            signer,
        });

        expect(result).toBe("0xrefund");

        const tx = sendSponsored.mock.calls[0]?.[1] as {
            to: string;
            data: Hex;
        };
        expect(getAddress(tx.to)).toBe(getAddress(CONTRACT));

        const { functionName, args } = decodeFunctionData({
            abi: erc20SwapAbi,
            data: tx.data,
        });
        expect(functionName).toBe("refundCooperative");

        const sig = parseSignature(SIG_HEX);
        expect(args).toEqual([
            PREIMAGE_HASH,
            990_000n,
            getAddress(USDC),
            getAddress(CLAIM),
            getAddress(REFUND),
            100n,
            vFromSignature(sig),
            sig.r,
            sig.s,
        ]);
    });

    it("requests the cooperative signature for the parsed logIndex", async () => {
        const signer = makeSigner();
        await sponsoredCommitmentRefund({
            asset: "USDC",
            commitmentTxHash: "0xcommit",
            signer,
        });

        expect(getEvmRefundCooperativeSignature).toHaveBeenCalledTimes(1);
        expect(getEvmRefundCooperativeSignature).toHaveBeenCalledWith(
            expect.objectContaining({
                isCommitmentLockup: true,
                asset: "USDC",
                commitmentTxHash: "0xcommit",
                logIndex: 5,
                signer,
            }),
        );
    });

    it("fails fast before signing when the lockup has no tokenAddress", async () => {
        getLockupEvent.mockReturnValueOnce({
            preimageHash: PREIMAGE_HASH,
            amount: 990_000n,
            tokenAddress: undefined,
            claimAddress: CLAIM,
            refundAddress: REFUND,
            timelock: 100n,
            logIndex: 5,
        } as never);

        await expect(
            sponsoredCommitmentRefund({
                asset: "USDC",
                commitmentTxHash: "0xcommit",
                signer: makeSigner(),
            }),
        ).rejects.toThrow(/missing tokenAddress/);

        expect(getEvmRefundCooperativeSignature).not.toHaveBeenCalled();
        expect(sendSponsored).not.toHaveBeenCalled();
    });
});
