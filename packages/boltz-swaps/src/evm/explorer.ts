import { Explorer, NetworkTransport } from "../types.ts";

export const getExplorerId = (transport: NetworkTransport): Explorer => {
    switch (transport) {
        case NetworkTransport.Evm:
            return Explorer.EtherscanStyle;

        case NetworkTransport.Solana:
            return Explorer.Solscan;

        case NetworkTransport.Tron:
            return Explorer.Tronscan;
    }
};
