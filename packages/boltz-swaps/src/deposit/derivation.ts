import { type HDAccount, mnemonicToAccount } from "viem/accounts";

// viem already bundles bip32/bip39, so no extra dependency. The default HD path
// `m/44'/60'/0'/0/{index}` is chain-agnostic — one derivation serves every
// source chain + Arbitrum. The account is `type: "local"` with `.sign`, which
// the EIP-7702 gas sponsor requires (`evm/alchemy.ts`).
export const deriveDepositAccount = (mnemonic: string, index = 0): HDAccount =>
    mnemonicToAccount(mnemonic, { addressIndex: index });

export const deriveDepositAddress = (mnemonic: string, index = 0): string =>
    deriveDepositAccount(mnemonic, index).address;
