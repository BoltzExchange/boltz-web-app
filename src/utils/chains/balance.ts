import { NetworkTransport } from "../../configs/base";
import { getNetworkTransport } from "../../consts/Assets";
import { createAssetProvider } from "../provider";
import { getSolanaNativeBalance } from "./solana";
import { getTronNativeBalance } from "./tron";

export const getAssetNativeBalance = async (
    asset: string,
    ownerAddress: string,
): Promise<bigint> => {
    switch (getNetworkTransport(asset)) {
        case NetworkTransport.Evm:
            return await createAssetProvider(asset).getBalance(ownerAddress);

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
