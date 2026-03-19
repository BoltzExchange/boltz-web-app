// @vitest-environment node
import { isAddress } from "ethers/address";
import { expect, test } from "vitest";

import { config } from "../../src/configs/mainnet";
import { getOftContract } from "../../src/utils/oft/oft";

type Usdt0ChainTestCase = {
    asset: string;
    chainId: number;
    chainName: string;
};

const usdt0ChainTestCases = Object.entries(config.assets).flatMap(
    ([asset, assetConfig]) => {
        const network = assetConfig.network;

        if (
            network === undefined ||
            (asset !== "USDT0" && !asset.startsWith("USDT0-"))
        ) {
            return [];
        }

        return [
            {
                asset,
                chainId: network.chainId,
                chainName: network.chainName,
            },
        ];
    },
);

test.each(usdt0ChainTestCases)(
    "$asset ($chainName) should resolve a live OFT contract",
    async ({ asset, chainId, chainName }: Usdt0ChainTestCase) => {
        const contract = await getOftContract(chainId);

        expect(
            contract,
            `${asset} (${chainName}) is missing an OFT contract in the live registry`,
        ).toBeDefined();
        expect(["OFT", "OFT Adapter"]).toContain(contract?.name);
        expect(isAddress(contract?.address ?? "")).toBe(true);
    },
    60_000,
);
