import {
    AbiCoder,
    type ContractRunner,
    Interface,
    getAddress,
    keccak256,
    zeroPadValue,
} from "ethers";

import type { CctpData } from "./types";

export const cctpFastFinalityThreshold = 1000;
export const cctpStandardFinalityThreshold = 2000;

// bytes32(0) — permissionless destination caller.
export const cctpZeroBytes32 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

export const cctpEmptyHookData = "0x";

// Magic hookData that routes a CCTP v2 burn through Circle's Forwarding Service
// on EVM destinations. Encodes the ASCII tag "cctp-forward" (12 bytes) right-
// padded to 32 bytes, which Circle's forwarder recognizes as version 0 with no
// additional payload.
// Ref: https://developers.circle.com/cctp/howtos/transfer-usdc-with-forwarding-service
export const cctpForwardHookData =
    "0x636374702d666f72776172640000000000000000000000000000000000000000";

const messageTransmitterV2Interface = new Interface([
    "function receiveMessage(bytes message, bytes attestation) external returns (bool)",
    "function usedNonces(bytes32 nonce) view returns (uint256)",
]);

// EIP-712 struct typehash for Router.CctpData. Must match the Router's
// TYPEHASH_CCTP_DATA constant:
//   keccak256(
//     "CctpData(uint32 destinationDomain,bytes32 mintRecipient,bytes32 destinationCaller,uint256 maxFee,uint32 minFinalityThreshold,bytes32 hookData)"
//   )
export const cctpDataTypehash = keccak256(
    new TextEncoder().encode(
        "CctpData(uint32 destinationDomain,bytes32 mintRecipient,bytes32 destinationCaller,uint256 maxFee,uint32 minFinalityThreshold,bytes32 hookData)",
    ),
);

// Left-pad a 20-byte EVM address to bytes32 (used for mintRecipient when the
// destination chain is EVM).
export const addressToBytes32 = (address: string): string =>
    zeroPadValue(getAddress(address), 32);

export const encodeCctpReceiveMessage = (
    message: string,
    attestation: string,
): string =>
    messageTransmitterV2Interface.encodeFunctionData("receiveMessage", [
        message,
        attestation,
    ]);

export const isCctpNonceUsed = async (
    messageTransmitter: string,
    runner: ContractRunner,
    nonce: string,
): Promise<boolean> => {
    if (typeof runner.call !== "function") {
        throw new Error("CCTP nonce check requires a contract runner");
    }

    const result = await runner.call({
        to: messageTransmitter,
        data: messageTransmitterV2Interface.encodeFunctionData("usedNonces", [
            nonce,
        ]),
    });
    const usedNonce = messageTransmitterV2Interface.decodeFunctionResult(
        "usedNonces",
        result,
    )[0] as bigint;

    return usedNonce !== 0n;
};

// EIP-712 struct hash for a CctpData value. Matches Router.hashCctpData().
export const hashCctpData = (sendParam: CctpData): string =>
    keccak256(
        AbiCoder.defaultAbiCoder().encode(
            [
                "bytes32",
                "uint32",
                "bytes32",
                "bytes32",
                "uint256",
                "uint32",
                "bytes32",
            ],
            [
                cctpDataTypehash,
                sendParam.destinationDomain,
                sendParam.mintRecipient,
                sendParam.destinationCaller,
                sendParam.maxFee,
                sendParam.minFinalityThreshold,
                keccak256(sendParam.hookData),
            ],
        ),
    );
