import { AssetKind, NetworkTransport, setBoltzSwapsConfig } from "boltz-swaps";
import { getAddress } from "viem";

import { erc20SwapAbiV5, etherSwapAbiV5 } from "../../src/evm/abis/index.ts";
import { buildSwapContractsForAsset } from "../../src/evm/swapContracts.ts";
import { erc20SwapAbi, etherSwapAbi } from "../../src/generated/evm-abis.ts";

type AbisModule = typeof import("../../src/evm/abis/index.ts");
const realAbis = (await vi.importActual(
    "../../src/evm/abis/index.ts",
)) as AbisModule;
const resolveEtherSwapAbi = realAbis.resolveEtherSwapAbi;
const resolveErc20SwapAbi = realAbis.resolveErc20SwapAbi;

const {
    getContractsMock,
    createAssetProviderMock,
    getContractMock,
    resolveEtherSwapAbiMock,
    resolveErc20SwapAbiMock,
} = vi.hoisted(() => ({
    getContractsMock: vi.fn(),
    createAssetProviderMock: vi.fn(),
    getContractMock: vi.fn(),
    resolveEtherSwapAbiMock: vi.fn(),
    resolveErc20SwapAbiMock: vi.fn(),
}));

vi.mock("../../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof import("../../src/client.ts")>()),
    getContracts: getContractsMock,
}));

vi.mock("../../src/evm/provider.ts", async (importActual) => ({
    ...(await importActual<typeof import("../../src/evm/provider.ts")>()),
    createAssetProvider: createAssetProviderMock,
}));

vi.mock("../../src/evm/abis/index.ts", async (importActual) => ({
    ...(await importActual<typeof import("../../src/evm/abis/index.ts")>()),
    resolveEtherSwapAbi: resolveEtherSwapAbiMock,
    resolveErc20SwapAbi: resolveErc20SwapAbiMock,
}));

vi.mock("viem", async (importActual) => {
    const actual = await importActual<typeof import("viem")>();
    return {
        ...actual,
        getAddress: actual.getAddress,
        getContract: getContractMock,
    };
});

const ETHER_SWAP = "0x000000000000000000000000000000000000e000";
const ERC20_SWAP = "0x000000000000000000000000000000000000c020";

const SENTINEL_PROVIDER = { id: "sentinel-public-provider" } as never;
const SENTINEL_SIGNER = { id: "sentinel-wallet-signer" } as never;
const ETHER_ABI = { id: "resolved-ether-abi" } as never;
const ERC20_ABI = { id: "resolved-erc20-abi" } as never;
const ETHER_CONTRACT = { address: "etherSwapContract" } as never;
const ERC20_CONTRACT = { address: "erc20SwapContract" } as never;

const setAssetConfig = (
    chainId: number,
    rpcUrls: readonly string[] = ["http://localhost"],
) => {
    setBoltzSwapsConfig({
        assets: {
            ETH: {
                type: AssetKind.EVMNative,
                network: {
                    chainName: "Ethereum",
                    symbol: "ETH",
                    gasToken: "ETH",
                    transport: NetworkTransport.Evm,
                    chainId,
                    rpcUrls,
                },
            },
        } as never,
    });
};

const contractsEntry = (
    chainId: number,
    overrides: {
        swapContracts?: Record<string, string>;
        supportedContracts?: Record<
            string,
            Record<string, unknown> & { features: string[] }
        >;
    } = {},
) => ({
    network: { chainId, name: `chain-${chainId}` },
    swapContracts: overrides.swapContracts ?? {
        EtherSwap: ETHER_SWAP,
        ERC20Swap: ERC20_SWAP,
    },
    supportedContracts: overrides.supportedContracts ?? {
        "5": {
            EtherSwap: ETHER_SWAP,
            ERC20Swap: ERC20_SWAP,
            features: [],
        },
    },
    tokens: {},
});

beforeEach(() => {
    getContractsMock.mockReset();
    createAssetProviderMock.mockReset();
    getContractMock.mockReset();
    resolveEtherSwapAbiMock.mockReset();
    resolveErc20SwapAbiMock.mockReset();

    createAssetProviderMock.mockReturnValue(SENTINEL_PROVIDER);
    resolveEtherSwapAbiMock.mockReturnValue(ETHER_ABI);
    resolveErc20SwapAbiMock.mockReturnValue(ERC20_ABI);
    getContractMock.mockImplementation((args: { address: string }) =>
        args.address === getAddress(ETHER_SWAP)
            ? ETHER_CONTRACT
            : ERC20_CONTRACT,
    );

    setAssetConfig(1);
});

describe("buildSwapContractsForAsset: findContractsForAsset", () => {
    test("throws when no chain entry matches the asset chainId", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            other: contractsEntry(10),
        });

        await expect(
            buildSwapContractsForAsset("ETH", SENTINEL_SIGNER),
        ).rejects.toThrow(
            /no swap contracts available for asset ETH \(chainId 1\)/,
        );
    });

    test("resolves when a chain entry matches the asset chainId", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1),
        });

        await expect(
            buildSwapContractsForAsset("ETH", SENTINEL_SIGNER),
        ).resolves.toEqual({
            etherSwap: ETHER_CONTRACT,
            erc20Swap: ERC20_CONTRACT,
        });
    });

    test("selects the entry by chainId among multiple, not the first", async () => {
        setAssetConfig(1);
        const matchEther = "0x000000000000000000000000000000000000b001";
        const matchErc20 = "0x000000000000000000000000000000000000b002";
        getContractsMock.mockResolvedValue({
            a: contractsEntry(10, {
                swapContracts: {
                    EtherSwap: "0x000000000000000000000000000000000000a001",
                    ERC20Swap: "0x000000000000000000000000000000000000a002",
                },
            }),
            b: contractsEntry(1, {
                swapContracts: {
                    EtherSwap: matchEther,
                    ERC20Swap: matchErc20,
                },
                supportedContracts: {
                    "5": {
                        EtherSwap: matchEther,
                        ERC20Swap: matchErc20,
                        features: [],
                    },
                },
            }),
        });

        await buildSwapContractsForAsset("ETH", SENTINEL_SIGNER);

        const etherCall = getContractMock.mock.calls.find(
            (call) => call[0].address === getAddress(matchEther),
        );
        const erc20Call = getContractMock.mock.calls.find(
            (call) => call[0].address === getAddress(matchErc20),
        );
        expect(etherCall).toBeDefined();
        expect(erc20Call).toBeDefined();
        expect(
            getContractMock.mock.calls.some(
                (call) =>
                    call[0].address ===
                    getAddress("0x000000000000000000000000000000000000a001"),
            ),
        ).toBe(false);
    });
});

describe("buildSwapContractsForAsset: requireSwapAddress", () => {
    test("throws when EtherSwap address is missing", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1, {
                swapContracts: { ERC20Swap: ERC20_SWAP },
            }),
        });

        await expect(
            buildSwapContractsForAsset("ETH", SENTINEL_SIGNER),
        ).rejects.toThrow(/missing EtherSwap swap contract address/);
    });

    test("throws when ERC20Swap address is missing", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1, {
                swapContracts: { EtherSwap: ETHER_SWAP },
            }),
        });

        await expect(
            buildSwapContractsForAsset("ETH", SENTINEL_SIGNER),
        ).rejects.toThrow(/missing ERC20Swap swap contract address/);
    });

    test("surfaces the EtherSwap message first when both are missing", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1, {
                swapContracts: {},
            }),
        });

        await expect(
            buildSwapContractsForAsset("ETH", SENTINEL_SIGNER),
        ).rejects.toThrow(/missing EtherSwap swap contract address/);
    });

    test("checksums a lowercase address via getAddress", async () => {
        setAssetConfig(1);
        const lowerEther = "0x00000000000000000000000000000000000000ab";
        const lowerErc20 = "0x00000000000000000000000000000000000000cd";
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1, {
                swapContracts: {
                    EtherSwap: lowerEther,
                    ERC20Swap: lowerErc20,
                },
                supportedContracts: {
                    "5": {
                        EtherSwap: lowerEther,
                        ERC20Swap: lowerErc20,
                        features: [],
                    },
                },
            }),
        });

        await buildSwapContractsForAsset("ETH", SENTINEL_SIGNER);

        const addresses = getContractMock.mock.calls.map(
            (call) => (call[0] as { address: string }).address,
        );
        expect(addresses).toContain(getAddress(lowerEther));
        expect(addresses).toContain(getAddress(lowerErc20));
    });

    test("propagates getAddress throwing on an invalid address", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1, {
                swapContracts: {
                    EtherSwap: "0xnot-a-valid-address",
                    ERC20Swap: ERC20_SWAP,
                },
            }),
        });

        await expect(
            buildSwapContractsForAsset("ETH", SENTINEL_SIGNER),
        ).rejects.toThrow();
    });
});

describe("buildSwapContractsForAsset: resolveSwapContractVersion wiring", () => {
    test("passes the matched supportedContracts version through to abi resolvers", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1, {
                swapContracts: {
                    EtherSwap: ETHER_SWAP,
                    ERC20Swap: ERC20_SWAP,
                },
                supportedContracts: {
                    "7": {
                        EtherSwap: ETHER_SWAP,
                        ERC20Swap: ERC20_SWAP,
                        features: [],
                    },
                },
            }),
        });

        await buildSwapContractsForAsset("ETH", SENTINEL_SIGNER);

        expect(resolveEtherSwapAbiMock).toHaveBeenCalledWith(7);
        expect(resolveErc20SwapAbiMock).toHaveBeenCalledWith(7);
    });

    test("falls back to version 5 when no supportedContracts key matches", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1, {
                swapContracts: {
                    EtherSwap: ETHER_SWAP,
                    ERC20Swap: ERC20_SWAP,
                },
                supportedContracts: {
                    "9": {
                        EtherSwap: "0x000000000000000000000000000000000000dead",
                        ERC20Swap: "0x000000000000000000000000000000000000beef",
                        features: [],
                    },
                },
            }),
        });

        await buildSwapContractsForAsset("ETH", SENTINEL_SIGNER);

        expect(resolveEtherSwapAbiMock).toHaveBeenCalledWith(5);
        expect(resolveErc20SwapAbiMock).toHaveBeenCalledWith(5);
    });
});

describe("buildSwapContractsForAsset: happy path", () => {
    test("builds both contracts with checksummed addresses, resolved abis, and a shared client", async () => {
        setAssetConfig(1);
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1),
        });

        const result = await buildSwapContractsForAsset("ETH", SENTINEL_SIGNER);

        expect(result).toEqual({
            etherSwap: ETHER_CONTRACT,
            erc20Swap: ERC20_CONTRACT,
        });

        expect(createAssetProviderMock).toHaveBeenCalledWith("ETH");
        expect(getContractMock).toHaveBeenCalledTimes(2);

        const expectedClient = {
            public: SENTINEL_PROVIDER,
            wallet: SENTINEL_SIGNER,
        };

        expect(getContractMock).toHaveBeenCalledWith({
            address: getAddress(ETHER_SWAP),
            abi: ETHER_ABI,
            client: expectedClient,
        });
        expect(getContractMock).toHaveBeenCalledWith({
            address: getAddress(ERC20_SWAP),
            abi: ERC20_ABI,
            client: expectedClient,
        });

        const [firstCall, secondCall] = getContractMock.mock.calls;
        expect(firstCall[0].client).toBe(secondCall[0].client);
        expect(firstCall[0].client.public).toBe(SENTINEL_PROVIDER);
        expect(firstCall[0].client.wallet).toBe(SENTINEL_SIGNER);
    });

    test("propagates createAssetProvider failures when RPC config is missing", async () => {
        setBoltzSwapsConfig({
            assets: {
                ETH: {
                    type: AssetKind.EVMNative,
                    network: {
                        chainName: "Ethereum",
                        symbol: "ETH",
                        gasToken: "ETH",
                        transport: NetworkTransport.Evm,
                        chainId: 1,
                    },
                } as never,
            } as never,
        });
        createAssetProviderMock.mockImplementation((asset: string) => {
            throw new Error(`missing RPC configuration for asset: ${asset}`);
        });
        getContractsMock.mockResolvedValue({
            only: contractsEntry(1),
        });

        await expect(
            buildSwapContractsForAsset("ETH", SENTINEL_SIGNER),
        ).rejects.toThrow(/missing RPC configuration for asset/);
    });
});

describe("abi resolvers: version cutoff", () => {
    test("resolveEtherSwapAbi selects V5 abi at the inclusive cutoff (5) and current abi above (6)", () => {
        expect(resolveEtherSwapAbi(5)).toBe(etherSwapAbiV5);
        expect(resolveEtherSwapAbi(6)).toBe(etherSwapAbi);
    });

    test("resolveErc20SwapAbi selects V5 abi at the inclusive cutoff (5) and current abi above (6)", () => {
        expect(resolveErc20SwapAbi(5)).toBe(erc20SwapAbiV5);
        expect(resolveErc20SwapAbi(6)).toBe(erc20SwapAbi);
    });
});
