import type { Signature } from "viem";

import type {
    Erc20SwapContract,
    RouterContract,
} from "../../src/evm/contracts.ts";
import {
    dexCalldataToRouterCalls,
    encodeRouterClaimExecuteTx,
    signErc20ClaimToRouter,
    signRouterClaim,
} from "../../src/evm/routerClaim.ts";

describe("signErc20ClaimToRouter", () => {
    test("should read the ERC20Swap domain from the active claim signer connection", async () => {
        const signer = {
            signTypedData: vi
                .fn()
                .mockResolvedValue(`0x${"b".repeat(64)}${"c".repeat(64)}1b`),
        };
        const erc20Swap = {
            address: "0x1000000000000000000000000000000000000000",
            read: {
                version: vi.fn().mockResolvedValue(7),
            },
        };

        await expect(
            signErc20ClaimToRouter(
                signer as never,
                erc20Swap as unknown as Erc20SwapContract,
                31n,
                "11".repeat(32),
                123n,
                "0x2000000000000000000000000000000000000000",
                "0x3000000000000000000000000000000000000000",
                144,
                "0x4000000000000000000000000000000000000000",
            ),
        ).resolves.toMatchObject({
            r: `0x${"b".repeat(64)}`,
            s: `0x${"c".repeat(64)}`,
        });

        expect(erc20Swap.read.version).toHaveBeenCalledTimes(1);
        expect(signer.signTypedData).toHaveBeenCalledWith(
            expect.objectContaining({
                domain: expect.objectContaining({
                    chainId: 31n,
                    version: "7",
                    verifyingContract:
                        "0x1000000000000000000000000000000000000000",
                }),
                primaryType: "Claim",
                types: expect.any(Object),
                message: expect.objectContaining({
                    preimage: `0x${"11".repeat(32)}`,
                    amount: 123n,
                    tokenAddress: "0x2000000000000000000000000000000000000000",
                    refundAddress: "0x3000000000000000000000000000000000000000",
                    destination: "0x4000000000000000000000000000000000000000",
                }),
            }),
        );
    });
});

describe("signRouterClaim", () => {
    test("should sign the Router Claim domain (v2)", async () => {
        const signer = {
            account: { type: "local" },
            signTypedData: vi
                .fn()
                .mockResolvedValue(`0x${"a".repeat(64)}${"d".repeat(64)}1c`),
        };

        await expect(
            signRouterClaim(
                signer as never,
                "0x5000000000000000000000000000000000000000",
                42161n,
                "22".repeat(32),
                "0x6000000000000000000000000000000000000000",
                990n,
                "0x7000000000000000000000000000000000000000",
            ),
        ).resolves.toMatchObject({
            r: `0x${"a".repeat(64)}`,
            s: `0x${"d".repeat(64)}`,
        });

        expect(signer.signTypedData).toHaveBeenCalledWith(
            expect.objectContaining({
                domain: expect.objectContaining({
                    name: "Router",
                    version: "2",
                    chainId: 42161n,
                    verifyingContract:
                        "0x5000000000000000000000000000000000000000",
                }),
                primaryType: "Claim",
                message: expect.objectContaining({
                    preimage: `0x${"22".repeat(32)}`,
                    token: "0x6000000000000000000000000000000000000000",
                    minAmountOut: 990n,
                    destination: "0x7000000000000000000000000000000000000000",
                }),
            }),
        );
    });
});

describe("dexCalldataToRouterCalls", () => {
    test("should flatten encoded DEX calls and 0x-prefix calldata", () => {
        expect(
            dexCalldataToRouterCalls([
                {
                    calls: [
                        {
                            to: "0x1000000000000000000000000000000000000000",
                            value: "0",
                            data: "abcd",
                        },
                        {
                            to: "0x2000000000000000000000000000000000000000",
                            value: 5n,
                            data: "0xbeef",
                        },
                    ],
                },
            ]),
        ).toEqual([
            {
                target: "0x1000000000000000000000000000000000000000",
                value: "0",
                callData: "0xabcd",
            },
            {
                target: "0x2000000000000000000000000000000000000000",
                value: 5n,
                callData: "0xbeef",
            },
        ]);
    });
});

describe("encodeRouterClaimExecuteTx", () => {
    test("should encode a claimERC20Execute transaction to the router", () => {
        const sig = {
            r: `0x${"1".repeat(64)}`,
            s: `0x${"2".repeat(64)}`,
            yParity: 0,
        } as Signature;
        const router = {
            address: "0x9000000000000000000000000000000000000000",
        } as unknown as RouterContract;

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
                    target: "0x3000000000000000000000000000000000000000",
                    value: "0",
                    callData: "0xabcd",
                },
            ],
            finalToken: "0x4000000000000000000000000000000000000000",
            minAmountOut: 990n,
            destination: "0x5000000000000000000000000000000000000000",
            routerSignature: sig,
        });

        expect(tx.to).toEqual("0x9000000000000000000000000000000000000000");
        expect(tx.data).toMatch(/^0x/);
    });
});
