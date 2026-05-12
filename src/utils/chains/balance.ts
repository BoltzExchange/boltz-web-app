import { createAssetProvider } from "boltz-swaps/evm";
import { getSolanaNativeBalance } from "boltz-swaps/solana";
import { getTronNativeBalance } from "boltz-swaps/tron";
import { NetworkTransport } from "boltz-swaps/types";
import { type Address } from "viem";

import { getNetworkTransport } from "../../consts/Assets";

export const getAssetNativeBalance = async (
    asset: string,
    ownerAddress: string,
): Promise<bigint> => {
    switch (getNetworkTransport(asset)) {
        case NetworkTransport.Evm:
            return await createAssetProvider(asset).getBalance({
                address: ownerAddress as Address,
            });

        case NetworkTransport.Solana:
            return await getSolanaNativeBalance(asset, ownerAddress);

        case NetworkTransport.Tron:
            return await getTronNativeBalance(asset, ownerAddress);

        default:
            throw new Error(
                `unsupported native balance transport for asset: ${asset}`,
            );
    }
};
