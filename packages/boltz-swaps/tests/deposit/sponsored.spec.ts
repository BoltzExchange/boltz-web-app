import { decodeFunctionData, getAddress, maxUint256 } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as sender from "../../src/evm/sender.ts";
import { erc20Abi } from "../../src/generated/evm-abis.ts";
import { GasAbstractionType } from "../../src/types.ts";

vi.mock("../../src/evm/sender.ts", () => ({
    sendPopulatedTransaction: vi.fn(async () => "0xhash"),
}));

const { ensureUnlimitedApproval, sendSponsored } =
    await import("../../src/deposit/sponsored.ts");

const sendPopulatedTransaction = vi.mocked(sender.sendPopulatedTransaction);

const token = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const spender = "0x0000000000000000000000000000000000000abc";

const makeSigner = (allowance: bigint) => ({
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    provider: { readContract: vi.fn(async () => allowance) },
});

describe("ensureUnlimitedApproval", () => {
    afterEach(() => vi.clearAllMocks());

    it("skips the approve when the allowance already covers `needed`", async () => {
        const signer = makeSigner(1000n);
        await ensureUnlimitedApproval(signer as never, token, spender, 500n);

        expect(signer.provider.readContract).toHaveBeenCalledTimes(1);
        expect(signer.provider.readContract).toHaveBeenCalledWith({
            address: getAddress(token),
            abi: erc20Abi,
            functionName: "allowance",
            args: [getAddress(signer.address), getAddress(spender)],
        });
        expect(sendPopulatedTransaction).not.toHaveBeenCalled();
    });

    it("sends one sponsored approve(spender, maxUint256) to the token when allowance is short", async () => {
        const signer = makeSigner(0n);
        await ensureUnlimitedApproval(signer as never, token, spender, 500n);

        expect(sendPopulatedTransaction).toHaveBeenCalledTimes(1);
        const call = sendPopulatedTransaction.mock.calls[0]!;
        expect(call[0]).toBe(GasAbstractionType.Signer);
        expect(call[1]).toBe(signer);
        const tx = call[2] as unknown as { to: string; data: `0x${string}` };
        expect(tx.to).toBe(getAddress(token));

        const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
        expect(decoded.functionName).toBe("approve");
        expect(decoded.args?.[0]).toBe(getAddress(spender));
        expect(decoded.args?.[1]).toBe(maxUint256);
    });
});

describe("sendSponsored", () => {
    afterEach(() => vi.clearAllMocks());

    it("delegates to sendPopulatedTransaction with GasAbstractionType.Signer, unchanged", async () => {
        const tx = { to: "0xabc", data: "0x1234" } as never;
        const signer = {} as never;
        await expect(sendSponsored(signer, tx)).resolves.toBe("0xhash");
        expect(sendPopulatedTransaction).toHaveBeenCalledWith(
            GasAbstractionType.Signer,
            signer,
            tx,
        );
    });
});
