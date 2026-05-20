import {
    type GasAbstractionSweepTokenContract,
    type GasAbstractionSweep as LibGasAbstractionSweep,
    getSweepableGasAbstractionBalances as libGetSweepableGasAbstractionBalances,
    sweepGasAbstractionToken as libSweepGasAbstractionToken,
} from "boltz-swaps/evm";
import type { Address } from "viem";

import { type AssetType, TBTC, USDC, USDT0 } from "../consts/Assets";
import type { Signer } from "../context/Web3";
import { sendPopulatedTransaction } from "./evmTransaction";
import type { RescueFile } from "./rescueFile";
import { GasAbstractionType } from "./swapCreator";

export type GasAbstractionSweep = LibGasAbstractionSweep & {
    asset: AssetType;
};

export const gasAbstractionSweepAssets = [TBTC, USDT0, USDC] as const;

export const getSweepableGasAbstractionBalances = ({
    assets = gasAbstractionSweepAssets,
    destination,
    rescueFile,
    getGasAbstractionSigner,
    createToken,
}: {
    assets?: readonly AssetType[];
    destination: Address;
    rescueFile: RescueFile;
    getGasAbstractionSigner: (asset: string, rescueFile?: RescueFile) => Signer;
    createToken?: (
        asset: string,
        signer: Signer,
    ) => GasAbstractionSweepTokenContract;
}): Promise<GasAbstractionSweep[]> =>
    libGetSweepableGasAbstractionBalances({
        assets,
        destination,
        getSigner: (asset) => getGasAbstractionSigner(asset, rescueFile),
        createToken,
    }) as Promise<GasAbstractionSweep[]>;

export const sweepGasAbstractionToken = (
    sweep: GasAbstractionSweep,
    sendTransaction = sendPopulatedTransaction,
): Promise<string> =>
    libSweepGasAbstractionToken(sweep, (signer, transaction) =>
        sendTransaction(GasAbstractionType.Signer, signer, transaction),
    );
