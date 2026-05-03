import type { Wallet } from "ethers";
import log from "loglevel";

import {
    type AssetType,
    TBTC,
    USDC,
    USDT0,
    getTokenAddress,
} from "../consts/Assets";
import { createTokenContract } from "../context/Web3";
import { getDecimals } from "./denomination";
import {
    erc20TransferInterface,
    sendPopulatedTransaction,
} from "./evmTransaction";
import type { RescueFile } from "./rescueFile";
import { assetAmountToSats } from "./rootstock";
import { GasAbstractionType } from "./swapCreator";

export const gasAbstractionSweepAssets = [TBTC, USDT0, USDC] as const;

export type GasAbstractionSweep = {
    asset: AssetType;
    amount: bigint;
    destination: string;
    signer: Wallet;
};

export const getGasAbstractionSweepDisplayAmount = ({
    asset,
    amount,
}: Pick<GasAbstractionSweep, "asset" | "amount">): bigint =>
    getDecimals(asset).isErc20 ? amount : assetAmountToSats(amount, asset);

type TokenContract = {
    balanceOf: (address: string) => Promise<bigint>;
};

export const getSweepableGasAbstractionBalances = async ({
    assets = gasAbstractionSweepAssets,
    destination,
    rescueFile,
    getGasAbstractionSigner,
    createToken = createTokenContract,
}: {
    assets?: readonly AssetType[];
    destination: string;
    rescueFile: RescueFile;
    getGasAbstractionSigner: (asset: string, rescueFile?: RescueFile) => Wallet;
    createToken?: (asset: string, signer: Wallet) => TokenContract;
}): Promise<GasAbstractionSweep[]> => {
    const balances = await Promise.all(
        assets.map(async (asset) => {
            try {
                const signer = getGasAbstractionSigner(asset, rescueFile);
                const token = createToken(asset, signer);
                const amount = await token.balanceOf(signer.address);

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
            to: getTokenAddress(sweep.asset),
            data: erc20TransferInterface.encodeFunctionData("transfer", [
                sweep.destination,
                sweep.amount,
            ]),
        },
    );

    if (!sweep.signer.provider) {
        throw new Error("Missing provider: cannot confirm transaction");
    }

    await sweep.signer.provider.waitForTransaction(transactionHash, 1);
    return transactionHash;
};
