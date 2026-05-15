import { erc20SwapAbi, etherSwapAbi } from "../../generated/evm-abis.ts";
import erc20SwapAbiV5 from "./v5/ERC20Swap.json" with { type: "json" };
import etherSwapAbiV5 from "./v5/EtherSwap.json" with { type: "json" };

export const resolveEtherSwapAbi = (version: number) =>
    (version <= 5 ? etherSwapAbiV5 : etherSwapAbi) as typeof etherSwapAbi;

export const resolveErc20SwapAbi = (version: number) =>
    (version <= 5 ? erc20SwapAbiV5 : erc20SwapAbi) as typeof erc20SwapAbi;

export { erc20SwapAbiV5, etherSwapAbiV5 };
