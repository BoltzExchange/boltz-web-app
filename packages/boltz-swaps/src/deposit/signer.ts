import { type Account, createWalletClient } from "viem";

import { requireRpcUrls } from "../config.ts";
import {
    createAssetProvider,
    createProviderTransport,
} from "../evm/provider.ts";
import type { Signer } from "../interfaces/signer.ts";

// Wrap a derived local account into the SDK `Signer` for a given EVM asset's
// chain. The wallet carries no fixed chain (supplied per call), matching the
// `Signer` shape; the provider is the asset's read RPC. Mirrors the signer
// assembly in `examples/chainSwapLbtcToTbtc.ts`.
//
// One signer per (account, chain): the source-chain signer drives the CCTP
// burn, the Arbitrum signer drives the mint/lockup/settle. Both wrap the same
// derived address.
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
