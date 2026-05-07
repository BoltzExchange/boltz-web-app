// @vitest-environment node
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Signer } from "../../src/context/Web3";
import type * as ProviderModule from "../../src/utils/provider";

const {
    sentinelAssetReadContract,
    sentinelAssetProvider,
    walletReadContract,
    mockCreateAssetProvider,
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
    };
});

vi.mock("../../src/utils/provider", async () => {
    const actual = await vi.importActual<typeof ProviderModule>(
        "../../src/utils/provider",
    );
    return { ...actual, createAssetProvider: mockCreateAssetProvider };
});

const { getForwarder, getSmartWalletFactory } =
    await import("../../src/rif/Contracts");

const owner = "0x1111111111111111111111111111111111111111";
const forwarderAddress = "0x000000000000000000000000000000000000cccc";

const buildSigner = (): Signer =>
    ({
        address: owner,
        // Wallet's provider — would represent the connected wallet's chain.
        // RIF Relay only operates on RBTC; if anything ever reads through
        // this, the cross-chain bug shape from contracts.ts is back.
        provider: { readContract: walletReadContract },
    }) as unknown as Signer;

beforeEach(() => {
    mockCreateAssetProvider.mockReset().mockReturnValue(sentinelAssetProvider);
    sentinelAssetReadContract.mockReset();
    walletReadContract.mockReset();
});

describe("getSmartWalletFactory", () => {
    test("reads via the RBTC asset provider, not the wallet's provider", async () => {
        // Same fix shape as `createTokenContract` in src/context/contracts.ts:
        // the public client is hardcoded to the RBTC chain (RIF Relay is
        // RBTC-only) so reads can't drift if the wallet sits on a different
        // chain.
        sentinelAssetReadContract.mockResolvedValue(42n);

        const factory = getSmartWalletFactory(buildSigner());
        const result = await factory.read.nonce([owner]);

        expect(result).toBe(42n);
        expect(mockCreateAssetProvider).toHaveBeenCalledWith("RBTC");
        expect(sentinelAssetReadContract).toHaveBeenCalledTimes(1);
        expect(walletReadContract).not.toHaveBeenCalled();
    });
});

describe("getForwarder", () => {
    test("reads via the RBTC asset provider, not the wallet's provider", async () => {
        sentinelAssetReadContract.mockResolvedValue(7n);

        const forwarder = getForwarder(buildSigner(), forwarderAddress);
        const result = await forwarder.read.nonce();

        expect(result).toBe(7n);
        expect(mockCreateAssetProvider).toHaveBeenCalledWith("RBTC");
        expect(sentinelAssetReadContract).toHaveBeenCalledTimes(1);
        expect(walletReadContract).not.toHaveBeenCalled();
    });
});
