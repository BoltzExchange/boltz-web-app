import {
    type Address,
    type Hex,
    encodeFunctionData,
    getAddress,
    getContract,
} from "viem";

import {
    getAssetBridge,
    getBoltzSwapsConfig,
    getTokenAddress,
} from "../config.ts";
import { erc20Abi } from "../generated/evm-abis.ts";
import type { Signer } from "../interfaces/index.ts";
import { getLogger } from "../logger.ts";
import { AssetKind } from "../types.ts";
import { assetAmountToSats } from "./rootstock.ts";

// Mirror of `getDecimals(asset).isErc20` from the host's denomination helpers:
// only ERC20 assets that are routed (via `routeVia` or that participate in a
// bridge) are displayed in token units; standalone ERC20 assets like TBTC
// stay in satoshis for display.
const isRoutedErc20 = (asset: string): boolean => {
    const assetConfig = getBoltzSwapsConfig().assets?.[asset];
    if (assetConfig?.type !== AssetKind.ERC20) {
        return false;
    }
    return (
        assetConfig.token?.routeVia !== undefined ||
        getAssetBridge(asset) !== undefined
    );
};

export type GasAbstractionBalance = {
    asset: string;
    amount: bigint;
    signer: Signer;
};

export type GasAbstractionSweep = GasAbstractionBalance & {
    destination: Address;
};

export type GasAbstractionSweepSendTransaction = (
    signer: Signer,
    transaction: { to: Address; data: Hex },
) => Promise<string>;

export type GasAbstractionSweepTokenContract = {
    read: {
        balanceOf: (args: readonly [Address]) => Promise<bigint>;
    };
};

const defaultCreateToken = (
    asset: string,
    signer: Signer,
): GasAbstractionSweepTokenContract =>
    getContract({
        abi: erc20Abi,
        address: getAddress(getTokenAddress(asset)),
        client: signer.provider,
    });

export const getGasAbstractionSweepDisplayAmount = ({
    asset,
    amount,
}: Pick<GasAbstractionBalance, "asset" | "amount">): bigint =>
    isRoutedErc20(asset) ? amount : assetAmountToSats(amount, asset);

export const getSweepableGasAbstractionBalances = async ({
    assets,
    getSigner,
    createToken = defaultCreateToken,
}: {
    assets: readonly string[];
    getSigner: (asset: string) => Signer;
    createToken?: (
        asset: string,
        signer: Signer,
    ) => GasAbstractionSweepTokenContract;
}): Promise<GasAbstractionBalance[]> => {
    const balances = await Promise.all(
        assets.map(async (asset) => {
            try {
                const signer = getSigner(asset);
                const token = createToken(asset, signer);
                const amount = await token.read.balanceOf([signer.address]);

                if (amount === 0n) {
                    return undefined;
                }

                return {
                    asset,
                    amount,
                    signer,
                };
            } catch (error) {
                getLogger().warn(`failed to inspect gas abstraction balance`, {
                    asset,
                    error,
                });
                return undefined;
            }
        }),
    );

    return balances.filter(
        (balance): balance is GasAbstractionBalance => balance !== undefined,
    );
};

export const sweepGasAbstractionToken = async (
    sweep: GasAbstractionSweep,
    sendTransaction: GasAbstractionSweepSendTransaction,
): Promise<string> => {
    const transactionHash = await sendTransaction(sweep.signer, {
        to: getAddress(getTokenAddress(sweep.asset)),
        data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [sweep.destination, sweep.amount],
        }),
    });

    if (!sweep.signer.provider) {
        throw new Error("Missing provider: cannot confirm transaction");
    }

    await sweep.signer.provider.waitForTransactionReceipt({
        hash: transactionHash as Hex,
        confirmations: 1,
    });
    return transactionHash;
};
