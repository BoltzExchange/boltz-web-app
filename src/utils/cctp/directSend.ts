import { Contract, type ContractRunner } from "ethers";

import { getTokenAddress } from "../../consts/Assets";
import type { BridgeRoute } from "../bridge/types";
import type { CctpSendParam } from "./types";

const tokenMessengerV2Abi = [
    "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData) external returns (uint64 nonce)",
] as const;

type TokenMessengerV2Instance = {
    depositForBurnWithHook: (
        amount: bigint,
        destinationDomain: number,
        mintRecipient: string,
        burnToken: string,
        destinationCaller: string,
        maxFee: bigint,
        minFinalityThreshold: number,
        hookData: string,
    ) => Promise<CctpDirectSendTransaction>;
};

// Shape is compatible with OftDirectSendTarget for the subset used by
// `SendToBridge` (reads `executionContract.address` as the approval spender).
// `executionContract` always points at the source-chain TokenMessenger, which
// is what the user approves USDC for.
export type CctpDirectSendTarget = {
    executionContract: { address: string };
    burnToken: string;
};

export type CctpDirectSendTransaction = {
    hash: string;
    wait: (confirmations?: number) => Promise<unknown>;
};

export const getCctpDirectSendTarget = (
    route: BridgeRoute,
    tokenMessenger: string,
): CctpDirectSendTarget => ({
    executionContract: { address: tokenMessenger },
    burnToken: getTokenAddress(route.sourceAsset),
});

// Direct CCTP sends cost no native gas (Circle charges the burn token), so the
// user only needs enough of the burn token to cover `amount` (protocol/forward
// fees are deducted from that amount, not added on top).
export const getCctpDirectRequiredTokenAmount = (amount: bigint): bigint => {
    return amount;
};

export const getCctpDirectRequiredNativeBalance = (): bigint => {
    return 0n;
};

export const sendCctpDirect = async ({
    target,
    runner,
    sendParam,
}: {
    target: CctpDirectSendTarget;
    runner: ContractRunner;
    sendParam: CctpSendParam;
}): Promise<CctpDirectSendTransaction> => {
    const messenger = new Contract(
        target.executionContract.address,
        tokenMessengerV2Abi,
        runner,
    ) as unknown as TokenMessengerV2Instance;

    return await messenger.depositForBurnWithHook(
        sendParam.amount,
        sendParam.destinationDomain,
        sendParam.mintRecipient,
        target.burnToken,
        sendParam.destinationCaller,
        sendParam.maxFee,
        sendParam.minFinalityThreshold,
        sendParam.hookData,
    );
};
