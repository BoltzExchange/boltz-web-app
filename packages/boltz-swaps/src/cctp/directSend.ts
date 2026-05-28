import { hex } from "@scure/base";
import {
    type Address,
    encodeFunctionData,
    getAddress,
    getContract,
    parseAbi,
} from "viem";

import { getTokenAddress } from "../config.ts";
import type { Signer } from "../interfaces/signer.ts";
import type { CctpSendParam } from "./types.ts";

export const tokenMessengerV2Abi = parseAbi([
    "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)",
    "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData) external returns (uint64 nonce)",
    "event DepositForBurn(address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller, uint256 maxFee, uint32 indexed minFinalityThreshold, bytes hookData)",
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
    route: { sourceAsset: string },
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

const getDepositForBurnArgs = (
    target: CctpDirectSendTarget,
    sendParam: CctpSendParam,
) =>
    [
        sendParam.amount,
        sendParam.destinationDomain,
        sendParam.mintRecipient,
        getAddress(target.burnToken),
        sendParam.destinationCaller,
        sendParam.maxFee,
        sendParam.minFinalityThreshold,
    ] as const;

const getDepositForBurnWithHookArgs = (
    target: CctpDirectSendTarget,
    sendParam: CctpSendParam,
) => [...getDepositForBurnArgs(target, sendParam), sendParam.hookData] as const;

export const populateCctpDirectSendTransaction = ({
    target,
    sendParam,
}: {
    target: CctpDirectSendTarget;
    sendParam: CctpSendParam;
}) => {
    const address = getAddress(target.executionContract.address);

    if (isEmptyHookData(sendParam.hookData)) {
        return {
            to: address,
            value: 0n,
            data: encodeFunctionData({
                abi: tokenMessengerV2Abi,
                functionName: "depositForBurn",
                args: getDepositForBurnArgs(target, sendParam),
            }),
        };
    }

    return {
        to: address,
        value: 0n,
        data: encodeFunctionData({
            abi: tokenMessengerV2Abi,
            functionName: "depositForBurnWithHook",
            args: getDepositForBurnWithHookArgs(target, sendParam),
        }),
    };
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
                getDepositForBurnArgs(target, sendParam),
                writeOptions,
            ),
        };
    }

    return {
        hash: await messenger.write.depositForBurnWithHook(
            getDepositForBurnWithHookArgs(target, sendParam),
            writeOptions,
        ),
    };
};
