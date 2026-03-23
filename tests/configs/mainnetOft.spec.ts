// @vitest-environment node
import { base58 } from "@scure/base";
import { isAddress } from "ethers/address";
import { expect, test } from "vitest";

import { NetworkTransport } from "../../src/configs/base";
import { config } from "../../src/configs/mainnet";
import { getOftContract, getOftContracts } from "../../src/utils/oft/oft";

type Usdt0ChainTestCase = {
    asset: string;
    chainName: string;
    transport: NetworkTransport;
};

const getAssetTransport = (
    asset: string,
): NetworkTransport | undefined => {
    const transport = config.assets[asset]?.network?.transport;
    if (transport !== undefined) {
        return transport;
    }

    return config.assets[asset]?.network?.chainId !== undefined
        ? NetworkTransport.Evm
        : undefined;
};

const usdt0ChainTestCases = Object.entries(config.assets).flatMap(
    ([asset, assetConfig]) => {
        const network = assetConfig.network;
        const transport = getAssetTransport(asset);

        if (
            network === undefined ||
            transport === undefined ||
            (asset !== "USDT0" && !asset.startsWith("USDT0-"))
        ) {
            return [];
        }

        return [
            {
                asset,
                chainName: network.chainName,
                transport,
            },
        ];
    },
);

const expectTransportAddressFormat = (
    transport: NetworkTransport,
    address: string,
) => {
    switch (transport) {
        case NetworkTransport.Evm:
            expect(isAddress(address)).toBe(true);
            return;

        case NetworkTransport.Solana:
            expect(base58.decode(address)).toHaveLength(32);
            return;

        case NetworkTransport.Tron:
            expect(base58.decode(address)).toHaveLength(25);
            return;

        default: {
            const exhaustiveCheck: never = transport;
            throw new Error(`Unhandled transport: ${String(exhaustiveCheck)}`);
        }
    }
};

test.each(usdt0ChainTestCases)(
    "$asset ($chainName) should resolve live OFT contracts",
    async ({ asset, chainName, transport }: Usdt0ChainTestCase) => {
        const [contract, contracts] = await Promise.all([
            getOftContract(asset),
            getOftContracts(asset),
        ]);

        expect(
            contract,
            `${asset} (${chainName}) is missing a primary OFT contract in the live registry`,
        ).toBeDefined();
        expect(
            contracts.length,
            `${asset} (${chainName}) is missing OFT contracts in the live registry`,
        ).toBeGreaterThan(0);
        expect(contract?.transport).toBe(transport);
        expectTransportAddressFormat(transport, contract?.address ?? "");

        switch (transport) {
            case NetworkTransport.Evm:
                expect(["OFT", "OFT Adapter"]).toContain(contract?.name);
                return;

            case NetworkTransport.Solana:
                expect(contracts.map((candidate) => candidate.name)).toEqual(
                    expect.arrayContaining([
                        "OFT Store",
                        "OFT Program",
                    ]),
                );
                expect(contract?.name).toBe("OFT Program");
                return;

            case NetworkTransport.Tron:
                expect(contract?.name).toBe("OFT");
                return;

            default: {
                const exhaustiveCheck: never = transport;
                throw new Error(
                    `Unhandled transport in test: ${String(exhaustiveCheck)}`,
                );
            }
        }
    },
    60_000,
);
