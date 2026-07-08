import { BigNumber } from "bignumber.js";
import {
    type BridgeDriver,
    type BridgeRoute,
    bridgeRegistry,
} from "boltz-swaps/bridge";
import { AssetKind, NetworkTransport } from "boltz-swaps/types";

import { config } from "../../src/config";
import { RBTC, USDT0 } from "../../src/consts/Assets";
import type { ConnectedWallet, Signer } from "../../src/context/Web3";
import { getConnectedMaximum } from "../../src/utils/connectedMaximum";
import { baseAssetAmountToInternal } from "../../src/utils/denomination";

const {
    createTokenContractMock,
    estimateFeesPerGasMock,
    getNativeBalanceMock,
} = vi.hoisted(() => ({
    createTokenContractMock: vi.fn(),
    estimateFeesPerGasMock: vi.fn(),
    getNativeBalanceMock: vi.fn(),
}));

vi.mock("boltz-swaps/evm/contracts", async () => {
    const actual = await vi.importActual("boltz-swaps/evm/contracts");

    return {
        ...actual,
        createTokenContract: createTokenContractMock,
    };
});

vi.mock("../../src/utils/chains/balance", () => ({
    getAssetNativeBalance: getNativeBalanceMock,
}));

vi.mock("../../src/utils/provider", () => ({
    estimateFeesPerGas: estimateFeesPerGasMock,
}));

const originalAssets = structuredClone(config.assets ?? {});
const routedToken = "USDT0-POL";

const signer = {
    address: "0x0000000000000000000000000000000000000001",
} as unknown as Signer;

beforeEach(() => {
    vi.clearAllMocks();
    config.assets = {
        ...originalAssets,
        [RBTC]: {
            ...originalAssets[RBTC],
            type: AssetKind.EVMNative,
            network: {
                ...originalAssets[RBTC]?.network,
                nativeCurrency: {
                    name: RBTC,
                    symbol: RBTC,
                    decimals: 18,
                },
            },
        },
        [routedToken]: {
            type: AssetKind.ERC20,
            token: {
                address: "0x0000000000000000000000000000000000000002",
                decimals: 6,
                routeVia: USDT0,
            },
        },
    } as typeof config.assets;
});

afterEach(() => {
    vi.restoreAllMocks();
    config.assets = originalAssets;
});

describe("baseAssetAmountToInternal", () => {
    test("converts native asset base units to sats", () => {
        expect(
            baseAssetAmountToInternal(RBTC, 1_000_000_000_000_000_000n),
        ).toEqual(BigNumber(100_000_000));
    });

    test("keeps routed ERC20 balances in token base units", () => {
        expect(baseAssetAmountToInternal(routedToken, 1_234_567n)).toEqual(
            BigNumber(1_234_567),
        );
    });
});

describe("getConnectedMaximum", () => {
    test("uses the connected bridge wallet for pre-bridge assets", async () => {
        const route: BridgeRoute = {
            sourceAsset: routedToken,
            destinationAsset: USDT0,
        };
        const getSourceTokenBalance = vi.fn(() => Promise.resolve(123_456n));
        const driver = {
            getTransport: vi.fn(() => NetworkTransport.Solana),
            getSourceTokenBalance,
        } as unknown as BridgeDriver;
        const connectedWallet = {
            address: "solana-address",
            transport: NetworkTransport.Solana,
            rdns: "wallet",
        } as ConnectedWallet;
        vi.spyOn(bridgeRegistry, "getPreRoute").mockReturnValue(route);
        vi.spyOn(bridgeRegistry, "requireDriverForRoute").mockReturnValue(
            driver,
        );

        await expect(
            getConnectedMaximum({
                fromAsset: routedToken,
                connectedWallet,
            }),
        ).resolves.toEqual(BigNumber(123_456));

        expect(getSourceTokenBalance).toHaveBeenCalledWith(
            route,
            "solana-address",
        );
    });

    test("returns undefined for pre-bridge assets when the connected wallet transport differs", async () => {
        const route: BridgeRoute = {
            sourceAsset: routedToken,
            destinationAsset: USDT0,
        };
        const getSourceTokenBalance = vi.fn();
        const driver = {
            getTransport: vi.fn(() => NetworkTransport.Solana),
            getSourceTokenBalance,
        } as unknown as BridgeDriver;
        vi.spyOn(bridgeRegistry, "getPreRoute").mockReturnValue(route);
        vi.spyOn(bridgeRegistry, "requireDriverForRoute").mockReturnValue(
            driver,
        );

        await expect(
            getConnectedMaximum({
                fromAsset: routedToken,
                connectedWallet: {
                    address: "0xevm",
                    transport: NetworkTransport.Evm,
                    rdns: "wallet",
                },
            }),
        ).resolves.toBeUndefined();

        expect(getSourceTokenBalance).not.toHaveBeenCalled();
    });

    test("subtracts the lockup gas reserve from native EVM balances", async () => {
        vi.spyOn(bridgeRegistry, "getPreRoute").mockReturnValue(undefined);
        getNativeBalanceMock.mockResolvedValue(1_000_000_000_000_092_000n);
        estimateFeesPerGasMock.mockResolvedValue({ gasPrice: 2n });

        await expect(
            getConnectedMaximum({
                fromAsset: RBTC,
                signer,
            }),
        ).resolves.toEqual(BigNumber(100_000_000));
    });

    test("uses ERC20 signer balances directly", async () => {
        const balanceOf = vi.fn(() => Promise.resolve(654_321n));
        createTokenContractMock.mockReturnValue({
            read: {
                balanceOf,
            },
        });
        vi.spyOn(bridgeRegistry, "getPreRoute").mockReturnValue(undefined);

        await expect(
            getConnectedMaximum({
                fromAsset: routedToken,
                signer,
            }),
        ).resolves.toEqual(BigNumber(654_321));

        expect(balanceOf).toHaveBeenCalledWith([signer.address]);
    });

    test("returns undefined without a compatible bridge wallet or signer", async () => {
        vi.spyOn(bridgeRegistry, "getPreRoute").mockReturnValue(undefined);

        await expect(
            getConnectedMaximum({
                fromAsset: RBTC,
            }),
        ).resolves.toBeUndefined();
    });
});
