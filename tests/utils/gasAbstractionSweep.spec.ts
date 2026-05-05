import type { TransactionRequest, Wallet } from "ethers";
import { describe, expect, test, vi } from "vitest";

import { config } from "../../src/config";
import { type AssetType, TBTC, USDC, USDT0 } from "../../src/consts/Assets";
import { erc20TransferInterface } from "../../src/utils/evmTransaction";
import type { sendPopulatedTransaction } from "../../src/utils/evmTransaction";
import {
    getGasAbstractionSweepDisplayAmount,
    getSweepableGasAbstractionBalances,
    sweepGasAbstractionToken,
} from "../../src/utils/gasAbstractionSweep";
import { GasAbstractionType } from "../../src/utils/swapCreator";

describe("gas abstraction sweep", () => {
    test.each([
        {
            asset: TBTC,
            amount: 1_000_000_000_000_000_000n,
            expected: 100_000_000n,
        },
        {
            asset: USDT0,
            amount: 1_000_000n,
            expected: 1_000_000n,
        },
        {
            asset: USDC,
            amount: 1_000_000n,
            expected: 1_000_000n,
        },
    ] satisfies {
        asset: AssetType;
        amount: bigint;
        expected: bigint;
    }[])(
        "normalizes $asset sweep balances for display",
        ({ asset, amount, expected }) => {
            expect(
                getGasAbstractionSweepDisplayAmount({
                    asset,
                    amount,
                }),
            ).toBe(expected);
        },
    );

    test("returns only non-zero token balances", async () => {
        const signerByAsset = new Map<string, Wallet>();
        const getGasAbstractionSigner = vi.fn((asset: string) => {
            const signer = {
                address: `0x${asset.padEnd(40, "0")}`,
            } as unknown as Wallet;
            signerByAsset.set(asset, signer);
            return signer;
        });
        const createToken = vi.fn((asset: string) => ({
            balanceOf: vi.fn(() =>
                Promise.resolve(asset === USDT0 ? 123n : 0n),
            ),
        }));

        const balances = await getSweepableGasAbstractionBalances({
            assets: [USDT0, USDC],
            destination: "0xdestination",
            rescueFile: { mnemonic: "test test test" },
            getGasAbstractionSigner,
            createToken,
        });

        expect(balances).toEqual([
            {
                asset: USDT0,
                amount: 123n,
                destination: "0xdestination",
                signer: signerByAsset.get(USDT0),
            },
        ]);
        expect(getGasAbstractionSigner).toHaveBeenCalledWith(USDT0, {
            mnemonic: "test test test",
        });
        expect(createToken).toHaveBeenCalledWith(
            USDT0,
            signerByAsset.get(USDT0),
        );
    });

    test("sends an ERC20 transfer from the gas abstraction signer", async () => {
        const waitForTransaction = vi.fn();
        const signer = {
            address: "0xsigner",
            provider: {
                waitForTransaction,
            },
        } as unknown as Wallet;
        const sendTransaction = vi.fn<typeof sendPopulatedTransaction>(() =>
            Promise.resolve("0xtx"),
        );

        const txHash = await sweepGasAbstractionToken(
            {
                asset: USDT0,
                amount: 456n,
                destination: "0x000000000000000000000000000000000000dEaD",
                signer,
            },
            sendTransaction,
        );

        const transaction = sendTransaction.mock
            .calls[0][2] as TransactionRequest;
        const expectedData = erc20TransferInterface.encodeFunctionData(
            "transfer",
            ["0x000000000000000000000000000000000000dEaD", 456n],
        );

        expect(txHash).toBe("0xtx");
        expect(sendTransaction).toHaveBeenCalledWith(
            GasAbstractionType.Signer,
            signer,
            expect.objectContaining({
                to: config.assets!.USDT0.token!.address,
            }),
            expect.objectContaining({
                alchemy: expect.objectContaining({
                    onPreparedCallId: undefined,
                }),
            }),
        );
        expect(transaction.data).toBe(expectedData);
        expect(waitForTransaction).toHaveBeenCalledWith("0xtx", 1);
    });

    test("exposes recovery info before confirmation finishes", async () => {
        let resolveWait!: () => void;
        const waitForTransaction = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveWait = resolve;
                }),
        );
        const signer = {
            address: "0xsigner",
            provider: {
                waitForTransaction,
            },
        } as unknown as Wallet;
        const sendTransaction = vi.fn<typeof sendPopulatedTransaction>(
            async (_gasAbstraction, _signer, _transaction, options) => {
                await options?.alchemy?.onPreparedCallId?.("0xprepared");
                return "0xtx";
            },
        );
        const onPreparedCallId = vi.fn();
        const onTransactionHash = vi.fn();

        const txHash = sweepGasAbstractionToken(
            {
                asset: USDT0,
                amount: 456n,
                destination: "0x000000000000000000000000000000000000dEaD",
                signer,
            },
            sendTransaction,
            {
                onPreparedCallId,
                onTransactionHash,
            },
        );

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(onPreparedCallId).toHaveBeenCalledWith("0xprepared");
        expect(onTransactionHash).toHaveBeenCalledWith("0xtx");

        resolveWait();
        await expect(txHash).resolves.toBe("0xtx");
    });

    test("throws when the transaction cannot be confirmed", async () => {
        const signer = {
            address: "0xsigner",
        } as unknown as Wallet;
        const sendTransaction = vi.fn<typeof sendPopulatedTransaction>(() =>
            Promise.resolve("0xtx"),
        );

        await expect(
            sweepGasAbstractionToken(
                {
                    asset: USDT0,
                    amount: 456n,
                    destination: "0x000000000000000000000000000000000000dEaD",
                    signer,
                },
                sendTransaction,
            ),
        ).rejects.toThrow("Missing provider: cannot confirm transaction");
    });
});
