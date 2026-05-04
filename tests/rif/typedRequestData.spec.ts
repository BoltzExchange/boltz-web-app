// @vitest-environment node
import { hashTypedData } from "viem";
import { describe, expect, test } from "vitest";

import {
    type EnvelopingRequest,
    deployRequestType,
    getDomainSeparator,
    getEnvelopingRequestDataV4Field,
    relayDataType,
    relayRequestType,
} from "../../src/rif/types/TypedRequestData";

const verifier = "0x1234567890abcdef1234567890abcdef12345678" as const;
const chainId = 30; // RSK mainnet

describe("getDomainSeparator", () => {
    test("matches the RIF Relay v2 EIP-712 domain shape", () => {
        expect(getDomainSeparator(verifier, chainId)).toEqual({
            name: "RSK Enveloping Transaction",
            version: "2",
            chainId: 30,
            verifyingContract: verifier,
        });
    });

    test("propagates chainId for testnet vs mainnet", () => {
        expect(getDomainSeparator(verifier, 31).chainId).toBe(31);
        expect(getDomainSeparator(verifier, 30).chainId).toBe(30);
    });
});

describe("relayRequestType / deployRequestType field ordering", () => {
    test("relayRequestType field order matches the RIF Relay v2 canonical type", () => {
        expect(relayRequestType.map((f) => f.name)).toEqual([
            "relayHub",
            "from",
            "to",
            "tokenContract",
            "value",
            "gas",
            "nonce",
            "tokenAmount",
            "tokenGas",
            "validUntilTime",
            "data",
            "relayData",
        ]);
        expect(relayRequestType.at(-1)).toEqual({
            name: "relayData",
            type: "RelayData",
        });
    });

    test("deployRequestType field order matches the RIF Relay v2 canonical type", () => {
        expect(deployRequestType.map((f) => f.name)).toEqual([
            "relayHub",
            "from",
            "to",
            "tokenContract",
            "recoverer",
            "value",
            "nonce",
            "tokenAmount",
            "tokenGas",
            "validUntilTime",
            "index",
            "data",
            "relayData",
        ]);
    });

    test("relayDataType field order matches the canonical RelayData type", () => {
        expect(relayDataType.map((f) => f.name)).toEqual([
            "gasPrice",
            "feesReceiver",
            "callForwarder",
            "callVerifier",
        ]);
    });
});

describe("getEnvelopingRequestDataV4Field", () => {
    const baseRelayRequest: EnvelopingRequest = {
        request: {
            relayHub: "0x0000000000000000000000000000000000000001",
            from: "0x0000000000000000000000000000000000000002",
            to: "0x0000000000000000000000000000000000000003",
            tokenContract: "0x0000000000000000000000000000000000000000",
            value: "0",
            gas: "100000",
            nonce: "0",
            tokenAmount: "0",
            tokenGas: "20000",
            validUntilTime: "9999999999",
            data: "0xabcdef",
        },
        relayData: {
            gasPrice: "1",
            feesReceiver: "0x0000000000000000000000000000000000000004",
            callForwarder: "0x0000000000000000000000000000000000000005",
            callVerifier: "0x0000000000000000000000000000000000000006",
        },
    };

    test("flattens the request and nests relayData verbatim", () => {
        const data = getEnvelopingRequestDataV4Field({
            chainId,
            verifier,
            envelopingRequest: baseRelayRequest,
            requestTypes: relayRequestType,
        });

        expect(data.primaryType).toBe("RelayRequest");
        expect(data.domain.verifyingContract).toBe(verifier);
        expect(data.types.RelayRequest).toBe(relayRequestType);
        expect(data.types.RelayData).toBe(relayDataType);

        expect(data.value).toEqual({
            ...baseRelayRequest.request,
            relayData: baseRelayRequest.relayData,
        });
        expect("request" in data.value).toBe(false);
    });

    test("uses the same primaryType label for deploy and relay (matches on-chain verifier)", () => {
        const deployRequest: EnvelopingRequest = {
            request: {
                ...baseRelayRequest.request,
                recoverer: "0x0000000000000000000000000000000000000000",
                index: 0,
            },
            relayData: baseRelayRequest.relayData,
        };
        delete deployRequest.request.gas;

        const data = getEnvelopingRequestDataV4Field({
            chainId,
            verifier,
            envelopingRequest: deployRequest,
            requestTypes: deployRequestType,
        });
        expect(data.primaryType).toBe("RelayRequest");
        expect(data.types.RelayRequest).toBe(deployRequestType);
    });

    test("typehash for relay vs deploy differs (different field sets produce different EIP-712 digests)", () => {
        const deployRequest: EnvelopingRequest = {
            request: {
                ...baseRelayRequest.request,
                recoverer: "0x0000000000000000000000000000000000000000",
                index: 0,
            },
            relayData: baseRelayRequest.relayData,
        };
        delete deployRequest.request.gas;

        const relayData = getEnvelopingRequestDataV4Field({
            chainId,
            verifier,
            envelopingRequest: baseRelayRequest,
            requestTypes: relayRequestType,
        });
        const deployData = getEnvelopingRequestDataV4Field({
            chainId,
            verifier,
            envelopingRequest: deployRequest,
            requestTypes: deployRequestType,
        });

        const relayDigest = hashTypedData({
            domain: relayData.domain,
            types: relayData.types,
            primaryType: relayData.primaryType,
            message: relayData.value,
        });
        const deployDigest = hashTypedData({
            domain: deployData.domain,
            types: deployData.types,
            primaryType: deployData.primaryType,
            message: deployData.value,
        });
        expect(relayDigest).not.toBe(deployDigest);
    });

    test("digest changes when verifyingContract changes (per-domain separation holds)", () => {
        const dataA = getEnvelopingRequestDataV4Field({
            chainId,
            verifier,
            envelopingRequest: baseRelayRequest,
            requestTypes: relayRequestType,
        });
        const dataB = getEnvelopingRequestDataV4Field({
            chainId,
            verifier: "0x9999999999999999999999999999999999999999" as const,
            envelopingRequest: baseRelayRequest,
            requestTypes: relayRequestType,
        });
        expect(
            hashTypedData({
                domain: dataA.domain,
                types: dataA.types,
                primaryType: dataA.primaryType,
                message: dataA.value,
            }),
        ).not.toBe(
            hashTypedData({
                domain: dataB.domain,
                types: dataB.types,
                primaryType: dataB.primaryType,
                message: dataB.value,
            }),
        );
    });

    test("digest changes when chainId changes (cross-chain replay protection)", () => {
        const dataMainnet = getEnvelopingRequestDataV4Field({
            chainId: 30,
            verifier,
            envelopingRequest: baseRelayRequest,
            requestTypes: relayRequestType,
        });
        const dataTestnet = getEnvelopingRequestDataV4Field({
            chainId: 31,
            verifier,
            envelopingRequest: baseRelayRequest,
            requestTypes: relayRequestType,
        });
        expect(
            hashTypedData({
                domain: dataMainnet.domain,
                types: dataMainnet.types,
                primaryType: dataMainnet.primaryType,
                message: dataMainnet.value,
            }),
        ).not.toBe(
            hashTypedData({
                domain: dataTestnet.domain,
                types: dataTestnet.types,
                primaryType: dataTestnet.primaryType,
                message: dataTestnet.value,
            }),
        );
    });
});
