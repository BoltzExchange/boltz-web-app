// @vitest-environment node
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type * as AssetsModule from "../../src/consts/Assets";
import type { Signer } from "../../src/context/Web3";
import type * as ProviderModule from "../../src/utils/provider";

const {
    sentinelAssetReadContract,
    sentinelAssetProvider,
    walletReadContract,
    mockCreateAssetProvider,
    mockRequireTokenConfig,
    mockRequireRouterAddress,
} = vi.hoisted(() => {
    const sentinelAssetReadContract = vi.fn();
    const sentinelAssetProvider = {
        readContract: sentinelAssetReadContract,
    } as unknown as PublicClient;
    return {
        sentinelAssetReadContract,
        sentinelAssetProvider,
        walletReadContract: vi.fn(),
        mockCreateAssetProvider:
            vi.fn<typeof ProviderModule.createAssetProvider>(),
        mockRequireTokenConfig: vi.fn<typeof AssetsModule.requireTokenConfig>(),
        mockRequireRouterAddress:
            vi.fn<typeof AssetsModule.requireRouterAddress>(),
    };
});

vi.mock("../../src/utils/provider", async () => {
    const actual = await vi.importActual<typeof ProviderModule>(
        "../../src/utils/provider",
    );
    return { ...actual, createAssetProvider: mockCreateAssetProvider };
});

vi.mock("../../src/consts/Assets", async () => {
    const actual = await vi.importActual<typeof AssetsModule>(
        "../../src/consts/Assets",
    );
    return {
        ...actual,
        requireTokenConfig: mockRequireTokenConfig,
        requireRouterAddress: mockRequireRouterAddress,
    };
});

const { createRouterContract, createTokenContract } =
    await import("../../src/context/contracts");

const tokenAddress = "0x000000000000000000000000000000000000aaaa";
const routerAddress = "0x000000000000000000000000000000000000bbbb";
const owner = "0x1111111111111111111111111111111111111111";
const spender = "0x2222222222222222222222222222222222222222";

const buildSigner = (): Signer =>
    ({
        address: owner,
        provider: { readContract: walletReadContract },
    }) as unknown as Signer;

beforeEach(() => {
    mockCreateAssetProvider.mockReset().mockReturnValue(sentinelAssetProvider);
    mockRequireTokenConfig
        .mockReset()
        .mockReturnValue({ address: tokenAddress, decimals: 18 });
    mockRequireRouterAddress.mockReset().mockReturnValue(routerAddress);
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
