import type { Address, TypedDataDomain } from "viem";

interface TypedDataField {
    name: string;
    type: string;
}

export const relayDataType = [
    { name: "gasPrice", type: "uint256" },
    { name: "feesReceiver", type: "address" },
    { name: "callForwarder", type: "address" },
    { name: "callVerifier", type: "address" },
];

export const relayRequestType = [
    { name: "relayHub", type: "address" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "tokenContract", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "tokenAmount", type: "uint256" },
    { name: "tokenGas", type: "uint256" },
    { name: "validUntilTime", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "relayData", type: "RelayData" },
];

export const deployRequestType = [
    { name: "relayHub", type: "address" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "tokenContract", type: "address" },
    { name: "recoverer", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "tokenAmount", type: "uint256" },
    { name: "tokenGas", type: "uint256" },
    { name: "validUntilTime", type: "uint256" },
    { name: "index", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "relayData", type: "RelayData" },
];

export function getDomainSeparator(
    verifyingContract: Address,
    chainId: number,
): TypedDataDomain {
    return {
        name: "RSK Enveloping Transaction",
        version: "2",
        chainId: chainId,
        verifyingContract: verifyingContract,
    };
}

export type EnvelopingRequest = {
    request: Record<string, unknown>;
    relayData: Record<string, unknown>;
};

type GetRequestDataFieldProps = {
    chainId: number;
    verifier: Address;
    requestTypes: TypedDataField[];
    envelopingRequest: EnvelopingRequest;
};

export type EnvelopingMessageTypes = {
    RelayRequest: TypedDataField[];
    RelayData: TypedDataField[];
};

export type TypedMessage<T> = {
    types: T;
    primaryType: keyof T;
    domain: TypedDataDomain;
    value: Record<string, unknown>;
};

export const getEnvelopingRequestDataV4Field = ({
    chainId,
    verifier,
    envelopingRequest,
    requestTypes,
}: GetRequestDataFieldProps): TypedMessage<EnvelopingMessageTypes> => ({
    types: {
        RelayRequest: requestTypes,
        RelayData: relayDataType,
    },
    primaryType: "RelayRequest",
    domain: getDomainSeparator(verifier, chainId),
    value: {
        ...envelopingRequest.request,
        relayData: envelopingRequest.relayData,
    },
});
