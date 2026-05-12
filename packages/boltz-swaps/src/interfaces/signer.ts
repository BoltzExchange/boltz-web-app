import type {
    Account,
    Address,
    PublicClient,
    Transport,
    WalletClient,
} from "viem";

export type Signer = WalletClient<Transport, undefined, Account> & {
    address: Address;
    provider: PublicClient;
    rdns: string;
};
