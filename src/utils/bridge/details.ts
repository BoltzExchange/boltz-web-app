export type SolanaDetails = {
    blockhash: string;
};

export type BridgeDetails = Record<string, unknown> & {
    solana?: SolanaDetails;
};
