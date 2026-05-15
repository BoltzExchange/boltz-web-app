// @vitest-environment node
import { setBoltzSwapsConfig } from "boltz-swaps/config";
import {
    createRouterContract,
    createTokenContract,
} from "boltz-swaps/evm/contracts";
import type { PublicClient } from "viem";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type * as ProviderModule from "../../packages/boltz-swaps/src/evm/provider.ts";
import type { Signer } from "../../src/context/Web3";

const tokenAddress = "0x000000000000000000000000000000000000aaaa";
const routerAddress = "0x000000000000000000000000000000000000bbbb";
const owner = "0x1111111111111111111111111111111111111111";
const spender = "0x2222222222222222222222222222222222222222";

const { sentinelAssetReadContract, sentinelAssetProvider, walletReadContract } =
    vi.hoisted(() => {
        const sentinelAssetReadContract = vi.fn();
        return {
            sentinelAssetReadContract,
            sentinelAssetProvider: {
                readContract: sentinelAssetReadContract,
            } as unknown as PublicClient,
            walletReadContract: vi.fn(),
        };
    });

const { mockCreateAssetProvider } = vi.hoisted(() => ({
    mockCreateAssetProvider: vi.fn(),
}));

vi.mock(
    "../../packages/boltz-swaps/src/evm/provider.ts",
    async (importActual) => ({
        ...(await importActual<typeof ProviderModule>()),
        createAssetProvider: mockCreateAssetProvider,
    }),
);

const buildSigner = (): Signer =>
    ({
        address: owner,
        provider: { readContract: walletReadContract },
    }) as unknown as Signer;

beforeAll(() => {
    // Inject a stub assets entry for USDT-RSK so the lib's requireTokenConfig
    // and requireRouterAddress accessors resolve without depending on the
    // host's runtime config.
    setBoltzSwapsConfig({
        assets: {
            "USDT-RSK": {
                type: "ERC20",
                token: { address: tokenAddress, decimals: 18 },
                contracts: { deployHeight: 0, router: routerAddress },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
    });
});

beforeEach(() => {
    mockCreateAssetProvider.mockReset().mockReturnValue(sentinelAssetProvider);
    sentinelAssetReadContract.mockReset();
    walletReadContract.mockReset();
});

describe("createTokenContract", () => {
    test("reads via createAssetProvider, not the wallet's provider", async () => {
        const expectedAllowance = 4242n;
        sentinelAssetReadContract.mockResolvedValue(expectedAllowance);

        const contract = createTokenContract("USDT-RSK", buildSigner());
        const result = await contract.read.allowance([owner, spender]);

        expect(result).toBe(expectedAllowance);
        expect(mockCreateAssetProvider).toHaveBeenCalledWith("USDT-RSK");
        expect(sentinelAssetReadContract).toHaveBeenCalledTimes(1);
        expect(walletReadContract).not.toHaveBeenCalled();
    });

    test("forwards the call to the underlying public client with the right args", async () => {
        sentinelAssetReadContract.mockResolvedValue(0n);

        const contract = createTokenContract("USDT-RSK", buildSigner());
        await contract.read.allowance([owner, spender]);

        const [callArgs] = sentinelAssetReadContract.mock.calls[0];
        expect(callArgs).toMatchObject({
            address: tokenAddress,
            functionName: "allowance",
            args: [owner, spender],
        });
    });
});

describe("createRouterContract", () => {
    test("reads via createAssetProvider, not the wallet's provider", async () => {
        const expectedPermit2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
        sentinelAssetReadContract.mockResolvedValue(expectedPermit2);

        const contract = createRouterContract("USDT-RSK", buildSigner());
        const result = await contract.read.PERMIT2();

        expect(result).toBe(expectedPermit2);
        expect(mockCreateAssetProvider).toHaveBeenCalledWith("USDT-RSK");
        expect(sentinelAssetReadContract).toHaveBeenCalledTimes(1);
        expect(walletReadContract).not.toHaveBeenCalled();
    });
});
