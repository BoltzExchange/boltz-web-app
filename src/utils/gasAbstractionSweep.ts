import log from "loglevel";
import { type Address, type Hex, encodeFunctionData, getAddress } from "viem";

import {
    type AssetType,
    TBTC,
    USDC,
    USDT0,
    getTokenAddress,
} from "../consts/Assets";
import type { Signer } from "../context/Web3";
import { type TokenContract, createTokenContract } from "../context/contracts";
import { erc20Abi } from "../generated/evm-abis";
import { getDecimals } from "./denomination";
import { sendPopulatedTransaction } from "./evmTransaction";
import type { RescueFile } from "./rescueFile";
import { assetAmountToSats } from "./rootstock";
import { GasAbstractionType } from "./swapCreator";

export const gasAbstractionSweepAssets = [TBTC, USDT0, USDC] as const;

export type GasAbstractionSweep = {
    asset: AssetType;
    amount: bigint;
    destination: Address;
    signer: Signer;
};

export const getGasAbstractionSweepDisplayAmount = ({
    asset,
    amount,
}: Pick<GasAbstractionSweep, "asset" | "amount">): bigint =>
    getDecimals(asset).isErc20 ? amount : assetAmountToSats(amount, asset);

export const getSweepableGasAbstractionBalances = async ({
    assets = gasAbstractionSweepAssets,
    destination,
    rescueFile,
    getGasAbstractionSigner,
    createToken = createTokenContract,
}: {
    assets?: readonly AssetType[];
    destination: Address;
    rescueFile: RescueFile;
    getGasAbstractionSigner: (asset: string, rescueFile?: RescueFile) => Signer;
    createToken?: (asset: string, signer: Signer) => TokenContract;
}): Promise<GasAbstractionSweep[]> => {
    const balances = await Promise.all(
        assets.map(async (asset) => {
            try {
                const signer = getGasAbstractionSigner(asset, rescueFile);
                const token = createToken(asset, signer);
                const amount = await token.read.balanceOf([signer.address]);

                if (amount === 0n) {
                    return undefined;
                }

                return {
                    asset,
                    amount,
                    destination,
                    signer,
                };
            } catch (error) {
                log.warn(`failed to inspect gas abstraction balance`, {
                    asset,
                    error,
                });
                return undefined;
            }
        }),
    );

    return balances.filter(
        (balance): balance is GasAbstractionSweep => balance !== undefined,
    );
};

export const sweepGasAbstractionToken = async (
    sweep: GasAbstractionSweep,
    sendTransaction = sendPopulatedTransaction,
): Promise<string> => {
    const transactionHash = await sendTransaction(
        GasAbstractionType.Signer,
        sweep.signer,
        {
            to: getAddress(getTokenAddress(sweep.asset)),
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [sweep.destination, sweep.amount],
            }),
        },
    );

    if (!sweep.signer.provider) {
        throw new Error("Missing provider: cannot confirm transaction");
    }

    await sweep.signer.provider.waitForTransactionReceipt({
        hash: transactionHash as Hex,
        confirmations: 1,
    });
    return transactionHash;
};
