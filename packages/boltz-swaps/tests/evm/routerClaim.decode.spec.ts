import { type Signature, decodeFunctionData, getAddress } from "viem";

import type { RouterContract } from "../../src/evm/contracts.ts";
import { encodeRouterClaimExecuteTx } from "../../src/evm/routerClaim.ts";
import { routerAbi } from "../../src/generated/evm-abis.ts";

describe("encodeRouterClaimExecuteTx (decode)", () => {
    const router = {
        address: "0x9000000000000000000000000000000000000000",
    } as unknown as RouterContract;

    test("should encode the full claimERC20Execute tuple and decode back to the exact arguments", () => {
        const claimSignature = {
            r: `0x${"1".repeat(64)}`,
            s: `0x${"2".repeat(64)}`,
            yParity: 1,
        } as Signature;
        const routerSignature = {
            r: `0x${"3".repeat(64)}`,
            s: `0x${"4".repeat(64)}`,
            v: 27n,
        } as Signature;

        const tx = encodeRouterClaimExecuteTx({
            router,
            preimage: "33".repeat(32),
            amount: 1000n,
            tokenAddress: "0x1000000000000000000000000000000000000000",
            refundAddress: "0x2000000000000000000000000000000000000000",
            timeoutBlockHeight: 144,
            claimSignature,
            routerCalls: [
                {
                    target: "0x3000000000000000000000000000000000000000",
                    value: "0",
                    callData: "0xabcd",
                },
            ],
            finalToken: "0x4000000000000000000000000000000000000000",
            minAmountOut: 990n,
            destination: "0x5000000000000000000000000000000000000000",
            routerSignature,
        });

        expect(tx.to).toEqual("0x9000000000000000000000000000000000000000");
        expect(tx.data).toMatch(/^0x/);

        const decoded = decodeFunctionData({
            abi: routerAbi,
            data: tx.data!,
        });

        expect(decoded.functionName).toEqual("claimERC20Execute");

        const args = decoded.args as readonly unknown[];

        expect(args[0]).toEqual({
            preimage: `0x${"33".repeat(32)}`,
            amount: 1000n,
            tokenAddress: "0x1000000000000000000000000000000000000000",
            refundAddress: "0x2000000000000000000000000000000000000000",
            timelock: 144n,
            v: 28,
            r: `0x${"1".repeat(64)}`,
            s: `0x${"2".repeat(64)}`,
        });

        expect(args[1]).toEqual([
            {
                target: getAddress(
                    "0x3000000000000000000000000000000000000000",
                ),
                value: 0n,
                callData: "0xabcd",
            },
        ]);

        expect(args[2]).toEqual(
            getAddress("0x4000000000000000000000000000000000000000"),
        );

        expect(args[3]).toEqual(990n);

        expect(args[4]).toEqual(
            getAddress("0x5000000000000000000000000000000000000000"),
        );

        expect(args[5]).toEqual(27);
        expect(args[6]).toEqual(`0x${"3".repeat(64)}`);
        expect(args[7]).toEqual(`0x${"4".repeat(64)}`);
    });

    test("should place differing claim (28) and router (27) v values in the correct slots", () => {
        const claimSignature = {
            r: `0x${"a".repeat(64)}`,
            s: `0x${"b".repeat(64)}`,
            yParity: 1,
        } as Signature;
        const routerSignature = {
            r: `0x${"c".repeat(64)}`,
            s: `0x${"d".repeat(64)}`,
            v: 27n,
        } as Signature;

        const tx = encodeRouterClaimExecuteTx({
            router,
            preimage: "55".repeat(32),
            amount: 7n,
            tokenAddress: "0x1000000000000000000000000000000000000000",
            refundAddress: "0x2000000000000000000000000000000000000000",
            timeoutBlockHeight: 1,
            claimSignature,
            routerCalls: [],
            finalToken: "0x4000000000000000000000000000000000000000",
            minAmountOut: 1n,
            destination: "0x5000000000000000000000000000000000000000",
            routerSignature,
        });

        const decoded = decodeFunctionData({
            abi: routerAbi,
            data: tx.data!,
        });
        const args = decoded.args as readonly unknown[];

        const claim = args[0] as { v: number };
        expect(claim.v).toEqual(28);
        expect(args[5]).toEqual(27);
        expect(claim.v).not.toEqual(args[5]);
    });

    test("should normalize router calls (lowercase target -> checksummed, value '5' -> 5n) through toRouterCalls", () => {
        const sig = {
            r: `0x${"1".repeat(64)}`,
            s: `0x${"2".repeat(64)}`,
            yParity: 0,
        } as Signature;

        const lowercaseTarget = "0xabcdef0000000000000000000000000000000001";

        const tx = encodeRouterClaimExecuteTx({
            router,
            preimage: "33".repeat(32),
            amount: 1000n,
            tokenAddress: "0x1000000000000000000000000000000000000000",
            refundAddress: "0x2000000000000000000000000000000000000000",
            timeoutBlockHeight: 144,
            claimSignature: sig,
            routerCalls: [
                {
                    target: lowercaseTarget,
                    value: "5",
                    callData: "0xbeef",
                },
            ],
            finalToken: "0x4000000000000000000000000000000000000000",
            minAmountOut: 990n,
            destination: "0x5000000000000000000000000000000000000000",
            routerSignature: sig,
        });

        const decoded = decodeFunctionData({
            abi: routerAbi,
            data: tx.data!,
        });
        const args = decoded.args as readonly unknown[];

        const checksummed = getAddress(lowercaseTarget);
        expect(checksummed).not.toEqual(lowercaseTarget);

        expect(args[1]).toEqual([
            {
                target: checksummed,
                value: 5n,
                callData: "0xbeef",
            },
        ]);
    });
});
