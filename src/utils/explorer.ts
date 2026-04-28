import { Explorer, NetworkTransport } from "../configs/base";

export const getExplorerId = (transport: NetworkTransport): Explorer => {
    switch (transport) {
        case NetworkTransport.Evm:
            return Explorer.Blockscout;

        case NetworkTransport.Solana:
            return Explorer.Solscan;

        case NetworkTransport.Tron:
            return Explorer.Tronscan;
    }
};
