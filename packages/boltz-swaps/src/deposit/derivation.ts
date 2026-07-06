import { type HDAccount, mnemonicToAccount } from "viem/accounts";

// Derive the reusable deposit account from a mnemonic. viem already bundles
// bip32/bip39 (no extra dependency). The default HD path is
// `m/44'/60'/0'/0/{index}`, which is chain-agnostic — the same address exists on
// every EVM chain, so a single derivation serves every source chain + Arbitrum.
//
// The returned account has `type: "local"` with a `.sign` method, which the
// EIP-7702 gas sponsor requires (`evm/alchemy.ts`).
export const deriveDepositAccount = (mnemonic: string, index = 0): HDAccount =>
    mnemonicToAccount(mnemonic, { addressIndex: index });

export const deriveDepositAddress = (mnemonic: string, index = 0): string =>
    deriveDepositAccount(mnemonic, index).address;
