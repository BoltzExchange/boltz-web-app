import { BigNumber } from "bignumber.js";
import { bridgeRegistry } from "boltz-swaps/bridge";
import { assetAmountToSats, createAssetProvider } from "boltz-swaps/evm";
import { createTokenContract } from "boltz-swaps/evm/contracts";
import { AssetKind } from "boltz-swaps/types";

import { getKindForAsset } from "../consts/Assets";
import type { ConnectedWallet, Signer } from "../context/Web3";
import { getAssetNativeBalance } from "./chains/balance";
import { getDecimals } from "./denomination";
import { getNativeEvmLockupSpendableBalance } from "./evmLockup";
import { estimateFeesPerGas } from "./provider";

const getNativeGasPrice = async (asset: string) => {
    const provider = createAssetProvider(asset);
    const { gasPrice } = await estimateFeesPerGas(provider);
    if (gasPrice === null) {
        throw new Error("missing gas price");
    }
    return gasPrice;
};

export const assetBalanceToInternalAmount = (asset: string, amount: bigint) =>
    getDecimals(asset).isErc20
        ? BigNumber(amount.toString())
        : BigNumber(assetAmountToSats(amount, asset).toString());

export const getConnectedMaximum = async ({
    fromAsset,
    connectedWallet,
    signer,
}: {
    fromAsset: string;
    connectedWallet?: ConnectedWallet;
    signer?: Signer;
}): Promise<BigNumber | undefined> => {
    const preBridgeRoute = bridgeRegistry.getPreRoute(fromAsset);
    if (preBridgeRoute !== undefined) {
        const driver = bridgeRegistry.requireDriverForRoute(preBridgeRoute);
        if (
            connectedWallet?.transport !==
                driver.getTransport(preBridgeRoute.sourceAsset) ||
            connectedWallet.address === undefined
        ) {
            return undefined;
        }

        return assetBalanceToInternalAmount(
            preBridgeRoute.sourceAsset,
            await driver.getSourceTokenBalance(
                preBridgeRoute,
                connectedWallet.address,
            ),
        );
    }

    if (signer === undefined) {
        return undefined;
    }

    switch (getKindForAsset(fromAsset)) {
        case AssetKind.EVMNative: {
            const [balance, gasPrice] = await Promise.all([
                getAssetNativeBalance(fromAsset, signer.address),
                getNativeGasPrice(fromAsset),
            ]);
            return assetBalanceToInternalAmount(
                fromAsset,
                getNativeEvmLockupSpendableBalance(balance, gasPrice),
            );
        }

        case AssetKind.ERC20: {
            const balance = await createTokenContract(
                fromAsset,
                signer,
            ).read.balanceOf([signer.address]);

            return assetBalanceToInternalAmount(fromAsset, balance);
        }

        default:
            return undefined;
    }
};
