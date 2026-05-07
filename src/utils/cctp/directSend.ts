import { hex } from "@scure/base";
import { type Address, getAddress, getContract, parseAbi } from "viem";

import { getTokenAddress } from "../../consts/Assets";
import type { Signer } from "../../context/Web3";
import type { BridgeRoute } from "../bridge/types";
import type { CctpSendParam } from "./types";

const tokenMessengerV2Abi = parseAbi([
    "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)",
    "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData) external returns (uint64 nonce)",
]);

// Shape is compatible with OftDirectSendTarget for the subset used by
// `SendToBridge` (reads `executionContract.address` as the approval spender).
// `executionContract` always points at the source-chain TokenMessenger, which
// is what the user approves USDC for.
export type CctpDirectSendTarget = {
    executionContract: { address: Address };
    burnToken: string;
};

export type CctpDirectSendTransaction = {
    hash: string;
};

export const getCctpDirectSendTarget = (
    route: BridgeRoute,
    tokenMessenger: Address,
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

const isEmptyHookData = (hookData: string): boolean => {
    try {
        return hex.decode(hookData.replace(/^0x/i, "")).length === 0;
    } catch {
        throw new Error("invalid CCTP hook data");
    }
};

export const sendCctpDirect = async ({
    target,
    runner,
    sendParam,
}: {
    target: CctpDirectSendTarget;
    runner: Signer;
    sendParam: CctpSendParam;
}): Promise<CctpDirectSendTransaction> => {
    const messenger = getContract({
        address: getAddress(target.executionContract.address),
        abi: tokenMessengerV2Abi,
        client: { public: runner.provider, wallet: runner },
    });

    const writeOptions = { account: runner.account, chain: null };

    if (isEmptyHookData(sendParam.hookData)) {
        return {
            hash: await messenger.write.depositForBurn(
                [
                    sendParam.amount,
                    sendParam.destinationDomain,
                    sendParam.mintRecipient,
                    getAddress(target.burnToken),
                    sendParam.destinationCaller,
                    sendParam.maxFee,
                    sendParam.minFinalityThreshold,
                ],
                writeOptions,
            ),
        };
    }

    return {
        hash: await messenger.write.depositForBurnWithHook(
            [
                sendParam.amount,
                sendParam.destinationDomain,
                sendParam.mintRecipient,
                getAddress(target.burnToken),
                sendParam.destinationCaller,
                sendParam.maxFee,
                sendParam.minFinalityThreshold,
                sendParam.hookData,
            ],
            writeOptions,
        ),
    };
};
