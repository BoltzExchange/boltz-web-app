import {
    type GasAbstractionSweepTokenContract,
    type GasAbstractionBalance as LibGasAbstractionBalance,
    type GasAbstractionSweep as LibGasAbstractionSweep,
    getSweepableGasAbstractionBalances as libGetSweepableGasAbstractionBalances,
    sweepGasAbstractionToken as libSweepGasAbstractionToken,
} from "boltz-swaps/evm";

import { type AssetType, TBTC, USDC, USDT0, WBTC } from "../consts/Assets";
import type { Signer } from "../context/Web3";
import { sendPopulatedTransaction } from "./evmTransaction";
import type { RescueFile } from "./rescueFile";
import { GasAbstractionType } from "./swapCreator";

export type GasAbstractionBalance = LibGasAbstractionBalance & {
    asset: AssetType;
};

export type GasAbstractionSweep = LibGasAbstractionSweep & {
    asset: AssetType;
};

export const gasAbstractionSweepAssets = [TBTC, WBTC, USDT0, USDC] as const;

export const getSweepableGasAbstractionBalances = ({
    assets = gasAbstractionSweepAssets,
    rescueFile,
    getGasAbstractionSigner,
    createToken,
}: {
    assets?: readonly AssetType[];
    rescueFile: RescueFile;
    getGasAbstractionSigner: (asset: string, rescueFile?: RescueFile) => Signer;
    createToken?: (
        asset: string,
        signer: Signer,
    ) => GasAbstractionSweepTokenContract;
}): Promise<GasAbstractionBalance[]> =>
    libGetSweepableGasAbstractionBalances({
        assets,
        getSigner: (asset) => getGasAbstractionSigner(asset, rescueFile),
        createToken,
    }) as Promise<GasAbstractionBalance[]>;

export const sweepGasAbstractionToken = (
    sweep: GasAbstractionSweep,
    sendTransaction = sendPopulatedTransaction,
): Promise<string> =>
    libSweepGasAbstractionToken(sweep, (signer, transaction) =>
        sendTransaction(GasAbstractionType.Signer, signer, transaction),
    );
