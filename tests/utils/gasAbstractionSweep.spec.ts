import { getGasAbstractionSweepDisplayAmount } from "boltz-swaps/evm";
import type { PopulatedEvmTransaction } from "boltz-swaps/evm/transaction";
import { encodeFunctionData, erc20Abi, getAddress } from "viem";
import { describe, expect, test, vi } from "vitest";

import { config } from "../../src/config";
import {
    type AssetType,
    TBTC,
    USDC,
    USDT0,
    WBTC,
} from "../../src/consts/Assets";
import type { Signer } from "../../src/context/Web3";
import type { sendPopulatedTransaction } from "../../src/utils/evmTransaction";
import {
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
            asset: WBTC,
            amount: 100_000_000n,
            expected: 100_000_000n,
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
        const signerByAsset = new Map<string, Signer>();
        const getGasAbstractionSigner = vi.fn((asset: string) => {
            const signer = {
                address: `0x${asset.padEnd(40, "0")}`,
            } as unknown as Signer;
            signerByAsset.set(asset, signer);
            return signer;
        });
        const createToken = vi.fn(
            (asset: string) =>
                ({
                    read: {
                        balanceOf: vi.fn(() =>
                            Promise.resolve(asset === USDT0 ? 123n : 0n),
                        ),
                    },
                }) as never,
        );

        const balances = await getSweepableGasAbstractionBalances({
            assets: [USDT0, USDC],
            rescueFile: { mnemonic: "test test test" },
            getGasAbstractionSigner,
            createToken,
        });

        expect(balances).toEqual([
            {
                asset: USDT0,
                amount: 123n,
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
        const waitForTransactionReceipt = vi.fn();
        const signer = {
            address: "0xsigner",
            provider: {
                waitForTransactionReceipt,
            },
        } as unknown as Signer;
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
            .calls[0][2] as PopulatedEvmTransaction;
        const expectedData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [
                getAddress("0x000000000000000000000000000000000000dEaD"),
                456n,
            ],
        });

        expect(txHash).toBe("0xtx");
        expect(sendTransaction).toHaveBeenCalledWith(
            GasAbstractionType.Signer,
            signer,
            expect.objectContaining({
                to: getAddress(config.assets!.USDT0.token!.address),
            }),
        );
        expect(transaction.data).toBe(expectedData);
        expect(waitForTransactionReceipt).toHaveBeenCalledWith({
            hash: "0xtx",
            confirmations: 1,
        });
    });

    test("throws when the transaction cannot be confirmed", async () => {
        const signer = {
            address: "0xsigner",
        } as unknown as Signer;
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
