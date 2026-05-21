import {
    type PublicClient,
    encodeFunctionData,
    getAddress,
    getContract,
} from "viem";

import { getBoltzSwapsConfig, requireTokenConfig } from "../config.ts";
import type { Signer } from "../interfaces/signer.ts";
import {
    createEvmOftContract,
    oftAbi,
    tempoOftWrapperAbi,
    toViemSendParam,
} from "./evm.ts";
import { getBufferedOftNativeFee } from "./oft.ts";
import {
    type OftContract,
    defaultOftName,
    findOftChainContract,
    formatRoute,
    getOftChain,
    getOftContract,
} from "./registry.ts";
import type { MsgFee, OftRoute, SendParam } from "./types.ts";

export enum OftDirectSendTargetKind {
    Oft = "oft",
    TempoWrapper = "tempoWrapper",
}

export type OftDirectSendTarget =
    | {
          kind: OftDirectSendTargetKind.Oft;
          oftContract: OftContract;
          executionContract: OftContract;
      }
    | {
          kind: OftDirectSendTargetKind.TempoWrapper;
          oftContract: OftContract;
          executionContract: OftContract;
          feeTokenAddress: string;
      };

type OftDirectSendTransaction = {
    hash: string;
};

type TempoOftWrapperInstance = {
    sendOFT: (
        oftAddress: string,
        feeTokenAddress: string,
        sendParam: SendParam,
        maxNativeFee: bigint,
    ) => Promise<OftDirectSendTransaction>;
};

const tempoChainName = "tempo";
const tempoWrapperContractName = "TempoOFTWrapper";

const createTempoOftWrapperContract = (
    address: string,
    runner: Signer,
): TempoOftWrapperInstance => {
    const contract = getContract({
        address: getAddress(address),
        abi: tempoOftWrapperAbi,
        client: { public: runner.provider, wallet: runner },
    });
    return {
        sendOFT: async (
            oftAddress,
            feeTokenAddress,
            sendParam,
            maxNativeFee,
        ) => {
            const hash = await contract.write.sendOFT(
                [
                    getAddress(oftAddress),
                    getAddress(feeTokenAddress),
                    toViemSendParam(sendParam),
                    maxNativeFee,
                ],
                { account: runner.account, chain: null },
            );
            return { hash };
        },
    };
};

const isTempoSourceAsset = (asset: string): boolean => {
    return (
        getBoltzSwapsConfig().assets?.[
            asset
        ]?.network?.chainName?.toLowerCase() === tempoChainName
    );
};

export const getOftDirectSendTarget = async (
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftDirectSendTarget> => {
    const oftContract = await getOftContract(route, oftName);
    if (!isTempoSourceAsset(route.sourceAsset)) {
        return {
            kind: OftDirectSendTargetKind.Oft,
            oftContract,
            executionContract: oftContract,
        };
    }

    const chain = await getOftChain(route.sourceAsset, route, oftName);
    const executionContract = findOftChainContract(chain, [
        tempoWrapperContractName,
    ]);
    if (executionContract === undefined) {
        throw new Error(
            `Missing Tempo OFT wrapper for route ${formatRoute(route)}`,
        );
    }

    return {
        kind: OftDirectSendTargetKind.TempoWrapper,
        oftContract,
        executionContract,
        feeTokenAddress: requireTokenConfig(route.sourceAsset).address,
    };
};

export const getOftDirectRequiredTokenAmount = (
    target: OftDirectSendTarget,
    amount: bigint,
    msgFee: MsgFee,
): bigint => {
    switch (target.kind) {
        case OftDirectSendTargetKind.Oft:
            return amount;

        case OftDirectSendTargetKind.TempoWrapper:
            return amount + msgFee[0];

        default: {
            const exhaustiveCheck: never = target;
            throw new Error(
                `Unhandled OFT direct send target: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

export const getOftDirectRequiredNativeBalance = (
    target: OftDirectSendTarget,
    msgFee: MsgFee,
): bigint => {
    switch (target.kind) {
        case OftDirectSendTargetKind.Oft:
            return getBufferedOftNativeFee(msgFee[0]);

        case OftDirectSendTargetKind.TempoWrapper:
            return 0n;

        default: {
            const exhaustiveCheck: never = target;
            throw new Error(
                `Unhandled OFT direct send target: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

export const requiresOftDirectUserApproval = async (
    target: OftDirectSendTarget,
    runner: PublicClient | Signer,
): Promise<boolean> => {
    switch (target.kind) {
        case OftDirectSendTargetKind.Oft:
            return await createEvmOftContract(
                target.executionContract.address,
                runner,
            ).approvalRequired();

        case OftDirectSendTargetKind.TempoWrapper:
            return true;

        default: {
            const exhaustiveCheck: never = target;
            throw new Error(
                `Unhandled OFT direct send target: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

export const sendOftDirect = async ({
    target,
    runner,
    sendParam,
    msgFee,
    refundAddress,
}: {
    target: OftDirectSendTarget;
    runner: Signer;
    sendParam: SendParam;
    msgFee: MsgFee;
    refundAddress: string;
}): Promise<OftDirectSendTransaction> => {
    switch (target.kind) {
        case OftDirectSendTargetKind.Oft:
            return await createEvmOftContract(
                target.executionContract.address,
                runner,
            ).send(sendParam, msgFee, refundAddress, {
                value: msgFee[0],
            });

        case OftDirectSendTargetKind.TempoWrapper:
            return await createTempoOftWrapperContract(
                target.executionContract.address,
                runner,
            ).sendOFT(
                target.oftContract.address,
                target.feeTokenAddress,
                sendParam,
                msgFee[0],
            );

        default: {
            const exhaustiveCheck: never = target;
            throw new Error(
                `Unhandled OFT direct send target: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

// Builds the same transaction as `sendOftDirect`, but returns a request the
// caller can sign and broadcast itself.
export const populateOftDirectSendTransaction = ({
    target,
    sendParam,
    msgFee,
    refundAddress,
}: {
    target: OftDirectSendTarget;
    sendParam: SendParam;
    msgFee: MsgFee;
    refundAddress: string;
}) => {
    switch (target.kind) {
        case OftDirectSendTargetKind.Oft:
            return {
                to: getAddress(target.executionContract.address),
                value: msgFee[0],
                data: encodeFunctionData({
                    abi: oftAbi,
                    functionName: "send",
                    args: [
                        toViemSendParam(sendParam),
                        {
                            nativeFee: msgFee[0],
                            lzTokenFee: msgFee[1],
                        },
                        getAddress(refundAddress),
                    ],
                }),
            };

        case OftDirectSendTargetKind.TempoWrapper:
            return {
                to: getAddress(target.executionContract.address),
                value: 0n,
                data: encodeFunctionData({
                    abi: tempoOftWrapperAbi,
                    functionName: "sendOFT",
                    args: [
                        getAddress(target.oftContract.address),
                        getAddress(target.feeTokenAddress),
                        toViemSendParam(sendParam),
                        msgFee[0],
                    ],
                }),
            };

        default: {
            const exhaustiveCheck: never = target;
            throw new Error(
                `Unhandled OFT direct send target: ${String(exhaustiveCheck)}`,
            );
        }
    }
};
