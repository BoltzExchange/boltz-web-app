import { decodeFunctionData, getAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyPreimageHash } from "../../src/evm/commitment.ts";
import { erc20SwapAbi } from "../../src/generated/evm-abis.ts";

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const OTHER_TOKEN = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
const CONTRACT = "0x0000000000000000000000000000000000000001";
const CLAIM = "0x0000000000000000000000000000000000000002";
const SIGNER_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OTHER_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const { getLockupEvent, ensureUnlimitedApproval, sendSponsored } = vi.hoisted(
    () => ({
        getLockupEvent: vi.fn(),
        ensureUnlimitedApproval: vi.fn(async () => {}),
        sendSponsored: vi.fn(
            async (_signer: unknown, _tx: unknown) => "0xlock",
        ),
    }),
);

vi.mock("../../src/client.ts", () => ({
    getCommitmentLockupDetails: vi.fn(async () => ({
        contract: CONTRACT,
        claimAddress: CLAIM,
        timelock: 100,
    })),
}));

vi.mock("../../src/config.ts", () => ({
    getTokenAddress: vi.fn(() => USDC),
}));

vi.mock("../../src/evm/transaction.ts", () => ({ getLockupEvent }));

vi.mock("../../src/deposit/sponsored.ts", () => ({
    ensureUnlimitedApproval,
    sendSponsored,
}));

const { sponsoredCommitmentLock } = await import("../../src/deposit/lockup.ts");

const signer = {
    address: SIGNER_ADDR,
    provider: { waitForTransactionReceipt: vi.fn(async () => ({})) },
} as never;

const okEvent = (over?: Record<string, unknown>) => ({
    amount: 990_000n,
    tokenAddress: USDC,
    refundAddress: SIGNER_ADDR,
    logIndex: 7,
    ...over,
});

describe("sponsoredCommitmentLock", () => {
    afterEach(() => vi.clearAllMocks());

    it("encodes the 6-arg ERC20Swap.lock and returns the parsed event fields", async () => {
        getLockupEvent.mockReturnValue(okEvent());

        const result = await sponsoredCommitmentLock({
            amount: 990_000n,
            signer,
        });

        const captured = sendSponsored.mock.calls[0]?.[1] as {
            to: string;
            data: `0x${string}`;
        };
        expect(captured.to).toBe(getAddress(CONTRACT));

        const decoded = decodeFunctionData({
            abi: erc20SwapAbi,
            data: captured.data,
        });
        expect(decoded.functionName).toBe("lock");
        expect(decoded.args).toEqual([
            emptyPreimageHash,
            990_000n,
            getAddress(USDC),
            getAddress(CLAIM),
            getAddress(SIGNER_ADDR),
            100n,
        ]);

        expect(result.commitmentTxHash).toBe("0xlock");
        expect(result.commitmentLogIndex).toBe(7);
        expect(result.timelock).toBe(100);
        expect(result.contract).toBe(getAddress(CONTRACT));
        expect(result.claimAddress).toBe(CLAIM);
    });

    it("approves before sending, with the token/spender/amount args", async () => {
        getLockupEvent.mockReturnValue(okEvent());
        const order: string[] = [];
        ensureUnlimitedApproval.mockImplementationOnce(async () => {
            order.push("approve");
        });
        sendSponsored.mockImplementationOnce(async () => {
            order.push("send");
            return "0xlock";
        });

        await sponsoredCommitmentLock({ amount: 990_000n, signer });

        expect(order).toEqual(["approve", "send"]);
        expect(ensureUnlimitedApproval).toHaveBeenCalledWith(
            signer,
            getAddress(USDC),
            getAddress(CONTRACT),
            990_000n,
        );
    });

    it("rejects when the locked amount does not match the event amount", async () => {
        getLockupEvent.mockReturnValue(okEvent({ amount: 12_345n }));

        await expect(
            sponsoredCommitmentLock({ amount: 990_000n, signer }),
        ).rejects.toThrow(/commitment lockup amount mismatch/);
        await expect(
            sponsoredCommitmentLock({ amount: 990_000n, signer }),
        ).rejects.toThrow(/locked 990000.*event 12345/);
    });

    it("rejects when the event token address is undefined", async () => {
        getLockupEvent.mockReturnValue(okEvent({ tokenAddress: undefined }));

        await expect(
            sponsoredCommitmentLock({ amount: 990_000n, signer }),
        ).rejects.toThrow(/token address mismatch/);
    });

    it("rejects when the event token address is a different token", async () => {
        getLockupEvent.mockReturnValue(okEvent({ tokenAddress: OTHER_TOKEN }));

        await expect(
            sponsoredCommitmentLock({ amount: 990_000n, signer }),
        ).rejects.toThrow(/token address mismatch/);
    });

    it("rejects when the event refund address is not the signer", async () => {
        getLockupEvent.mockReturnValue(okEvent({ refundAddress: OTHER_ADDR }));

        await expect(
            sponsoredCommitmentLock({ amount: 990_000n, signer }),
        ).rejects.toThrow(/refund address mismatch/);
    });
});
