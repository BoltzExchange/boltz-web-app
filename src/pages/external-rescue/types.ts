import type { RestorableSwap } from "boltz-swaps/client";
import type { SwapContract } from "boltz-swaps/evm";
import type { LogRefundData, RskRescueMode } from "boltz-swaps/types";

import type { Swap } from "../../components/SwapList";
import type { GasAbstractionBalance } from "../../utils/gasAbstractionSweep";
import type { RescueAction } from "../../utils/rescue";
import type { BridgeDetail, DexDetail } from "../../utils/swapCreator";

export enum RecoveryMethod {
    Key = "key",
    Wallet = "wallet",
}

export enum RescueResultSource {
    Restore = "restore",
    Evm = "evm",
    Sweep = "sweep",
}

export enum BtcSearchState {
    Idle = "idle",
    Loading = "loading",
    Ready = "ready",
    Errored = "errored",
}

export type RecoveryAction = RescueAction.Claim | RescueAction.Refund;

export type RecoveryOption = {
    asset: string;
    className: string;
    actions: RecoveryAction[];
    methods: RecoveryMethod[];
};

export type EvmScanTarget = {
    asset: string;
    providerUrl: string;
    scanInterval?: number;
    contract: SwapContract;
};

export type ScanProgress = {
    byAsset: Map<string, { progress: number; derivedKeys?: number }>;
    unmatchedByAsset: Map<string, number>;
    update: (asset: string, progress: number, derivedKeys?: number) => void;
    updateUnmatched: (asset: string, unmatched: number) => void;
};

export type RestoredEvmSwap = RestorableSwap & {
    preimageHash: string;
    lockupTx?: string;
    commitmentLockupTxHash?: string;
    originalDestination?: string;
    dex?: DexDetail;
    bridge?: BridgeDetail;
};

export type RestorableEvmClaimDetails = {
    type?: "evm";
    contractAddress: string;
    claimAddress: string;
    transaction?: { id: string };
    amount?: number;
    keyIndex?: number;
    timeoutBlockHeight: number;
};

export type EvmRescueResult = LogRefundData & {
    action: RskRescueMode;
    currentHeight?: bigint;
    restoredSwap?: RestoredEvmSwap;
    dex?: DexDetail;
    bridge?: BridgeDetail;
};

export type UnifiedRescueResult =
    | {
          source: RescueResultSource.Restore;
          key: string;
          action: RescueAction;
          actionable: boolean;
          sortValue: number;
          swap: Swap;
      }
    | {
          source: RescueResultSource.Evm;
          key: string;
          action: RescueAction;
          evmAction: RskRescueMode;
          actionable: boolean;
          sortValue: number;
          swap: EvmRescueResult;
      }
    | {
          source: RescueResultSource.Sweep;
          key: string;
          action: RescueAction.Refund;
          actionable: true;
          sortValue: number;
          swap: GasAbstractionBalance;
      };
