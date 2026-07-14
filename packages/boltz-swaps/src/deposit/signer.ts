import { type Account, createWalletClient } from "viem";

import { requireRpcUrls } from "../config.ts";
import {
    createAssetProvider,
    createProviderTransport,
} from "../evm/provider.ts";
import type { Signer } from "../interfaces/signer.ts";

// Wrap a derived local account into the SDK `Signer` for one EVM asset's
// chain: the wallet carries no fixed chain (supplied per call) and the provider
// is the asset's read RPC. One signer per (account, chain).
export const buildDepositSigner = (account: Account, asset: string): Signer => {
    const wallet = createWalletClient({
        account,
        transport: createProviderTransport(requireRpcUrls(asset)),
    });
    return Object.assign(wallet, {
        address: account.address,
        provider: createAssetProvider(asset),
        rdns: "boltz-deposit",
    }) as Signer;
};
