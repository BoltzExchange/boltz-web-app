import { getRawTransaction } from "./blockchain";

export const fetchBlockExplorerTx = async (
    asset: string,
    txid: string,
): Promise<string> => await getRawTransaction(asset, txid);
