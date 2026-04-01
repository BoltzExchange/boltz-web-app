import { Contract, type ContractRunner } from "ethers";

import { config } from "../../config";
import { requireTokenConfig } from "../../consts/Assets";
import TempoOFTWrapperAbi from "../../consts/abis/tempo/TempoOFTWrapper.json";
import type { OftRoute } from "../Pair";
import type { MsgFee, SendParam } from "./oft";
import { createOftContract } from "./oft";
import {
    type OftContract,
    defaultOftName,
    findOftChainContract,
    getOftChain,
    getPrimaryOftContract,
} from "./registry";

export const enum OftDirectSendTargetKind {
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
    wait: (confirmations?: number) => Promise<unknown>;
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
    runner: ContractRunner,
): TempoOftWrapperInstance =>
    new Contract(
        address,
        TempoOFTWrapperAbi,
        runner,
    ) as unknown as TempoOftWrapperInstance;

const isTempoSourceAsset = (asset: string): boolean => {
    return (
        config.assets?.[asset]?.network?.chainName?.toLowerCase() ===
        tempoChainName
    );
};

export const getOftDirectSendTarget = async (
    route: OftRoute,
    oftName = defaultOftName,
): Promise<OftDirectSendTarget> => {
    const oftContract = await getPrimaryOftContract(route, oftName);
    if (!isTempoSourceAsset(route.from)) {
        return {
            kind: OftDirectSendTargetKind.Oft,
            oftContract,
            executionContract: oftContract,
        };
    }

    const chain = await getOftChain(route.from, route, oftName);
    const executionContract = findOftChainContract(chain, [
        tempoWrapperContractName,
    ]);
    if (executionContract === undefined) {
        throw new Error(
            `Missing Tempo OFT wrapper for route ${route.from} -> ${route.to}`,
        );
    }

    return {
        kind: OftDirectSendTargetKind.TempoWrapper,
        oftContract,
        executionContract,
        feeTokenAddress: requireTokenConfig(route.from).address,
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
            return (msgFee[0] * 110n) / 100n;

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
    runner: ContractRunner,
): Promise<boolean> => {
    switch (target.kind) {
        case OftDirectSendTargetKind.Oft:
            return await createOftContract(
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
    runner: ContractRunner;
    sendParam: SendParam;
    msgFee: MsgFee;
    refundAddress: string;
}): Promise<OftDirectSendTransaction> => {
    switch (target.kind) {
        case OftDirectSendTargetKind.Oft:
            return await createOftContract(
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
