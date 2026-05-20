import { setBoltzSwapsConfig } from "boltz-swaps/config";
import { etherSwapAbiV5 } from "boltz-swaps/evm/abis";
import { getLogsFromReceipt, scanLockupEvents } from "boltz-swaps/evm/logs";
import { etherSwapAbi } from "boltz-swaps/generated/evm-abis";
import { AssetKind, type AssetType, RskRescueMode } from "boltz-swaps/types";
import {
    type AbiEvent,
    type Address,
    type Hex,
    encodeAbiParameters,
    encodeEventTopics,
    getAddress,
} from "viem";

import type * as ProviderModule from "../../src/evm/provider.ts";

const {
    mockCreateProvider,
    mockCreateAssetProvider,
    provider,
    getBlockNumber,
    getLogs,
    getTransactionReceipt,
    readContract,
    contractReadVersion,
    contractReadHashValues,
    contractReadSwaps,
} = vi.hoisted(() => {
    const getBlockNumber = vi.fn();
    const getLogs = vi.fn();
    const getTransactionReceipt = vi.fn();
    const readContract = vi.fn();
    const contractReadVersion = vi.fn();
    const contractReadHashValues = vi.fn();
    const contractReadSwaps = vi.fn();
    const provider = {
        getBlockNumber,
        getLogs,
        getTransactionReceipt,
        readContract,
    };

    return {
        mockCreateProvider: vi.fn(),
        mockCreateAssetProvider: vi.fn(),
        provider,
        getBlockNumber,
        getLogs,
        getTransactionReceipt,
        readContract,
        contractReadVersion,
        contractReadHashValues,
        contractReadSwaps,
    };
});

vi.mock("../../src/evm/provider.ts", async (importActual) => ({
    ...(await importActual<typeof ProviderModule>()),
    createProvider: mockCreateProvider,
    createAssetProvider: mockCreateAssetProvider,
}));

beforeAll(() => {
    setBoltzSwapsConfig({
        assets: {
            RBTC: {
                type: AssetKind.EVMNative,
                contracts: { deployHeight: 1 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                network: { chainId: 31 } as any,
            },
            TBTC: {
                type: AssetKind.ERC20,
                contracts: { deployHeight: 1 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                network: { chainId: 31 } as any,
                token: {
                    address: "0x4000000000000000000000000000000000000000",
                    decimals: 18,
                },
            },
            WBTC: {
                type: AssetKind.ERC20,
                contracts: { deployHeight: 1 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                network: { chainId: 31 } as any,
                token: {
                    address: "0x5000000000000000000000000000000000000000",
                    decimals: 8,
                },
            },
        },
    });
});

const swapAddress = getAddress("0x1000000000000000000000000000000000000000");
const claimAddress = getAddress("0x2000000000000000000000000000000000000000");
const refundAddress = getAddress("0x3000000000000000000000000000000000000000");
const tbtcAddress = getAddress("0x4000000000000000000000000000000000000000");
const wbtcAddress = getAddress("0x5000000000000000000000000000000000000000");
const preimageHash = `0x${"11".repeat(32)}` as Hex;
const swapHash = `0x${"22".repeat(32)}` as Hex;

const buildDecodedLockup = (tokenAddress?: Address) => ({
    address: swapAddress,
    blockNumber: 10n,
    transactionHash: `0x${"aa".repeat(32)}` as Hex,
    eventName: "Lockup" as const,
    args: {
        preimageHash,
        amount: 123n,
        claimAddress,
        refundAddress,
        timelock: 456n,
        tokenAddress,
    },
});

const setupScanner = (version: number, tokenAddress?: Address) => {
    mockCreateProvider.mockReturnValue(provider);
    mockCreateAssetProvider.mockReturnValue(provider);
    getBlockNumber.mockResolvedValue(10n);
    getLogs.mockResolvedValue([buildDecodedLockup(tokenAddress)]);
    getTransactionReceipt.mockReset();
    readContract.mockImplementation(({ functionName }) => {
        switch (functionName) {
            case "version":
                return Promise.resolve(version);
            case "hashValues":
                return Promise.resolve(swapHash);
            case "swaps":
                return Promise.resolve(true);
            default:
                throw new Error(
                    `unexpected readContract: ${String(functionName)}`,
                );
        }
    });
    contractReadVersion.mockResolvedValue(version);
    contractReadHashValues.mockResolvedValue(swapHash);
    contractReadSwaps.mockResolvedValue(true);
};

const scanOnce = async (
    asset: AssetType = "RBTC",
    action = RskRescueMode.Claim,
    filterAddress = claimAddress,
) => {
    const generator = scanLockupEvents(
        new AbortController().signal,
        {
            address: swapAddress,
            read: {
                version: contractReadVersion,
                hashValues: contractReadHashValues,
                swaps: contractReadSwaps,
            },
        } as never,
        {
            asset,
            providerUrl: "https://example.invalid/rpc",
            scanInterval: 10,
            filter: { address: filterAddress },
            action,
        },
    );

    return await generator.next();
};

describe("contractLogs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("does not topic-filter claimAddress for v5 Lockup scans because claimAddress is not indexed", async () => {
        setupScanner(5);

        const result = await scanOnce();

        expect(result.value).toMatchObject({
            events: [],
            unmatchedSwaps: 1,
        });

        const [getLogsArgs] = getLogs.mock.calls[0];
        expect(getLogsArgs.args).toBeUndefined();
        const claimInput = (getLogsArgs.event as AbiEvent).inputs.find(
            (input) => input.name === "claimAddress",
        );
        expect(claimInput).toMatchObject({ indexed: false });
    });

    test("uses indexed claimAddress filtering for v6 Lockup scans", async () => {
        setupScanner(6);

        const result = await scanOnce();

        expect(result.value).toMatchObject({
            events: [],
            unmatchedSwaps: 1,
        });

        const [getLogsArgs] = getLogs.mock.calls[0];
        expect(getLogsArgs.args).toEqual({ claimAddress });
        const claimInput = (getLogsArgs.event as AbiEvent).inputs.find(
            (input) => input.name === "claimAddress",
        );
        expect(claimInput).toMatchObject({ indexed: true });
    });

    test("filters ERC20 scans by the configured token address", async () => {
        setupScanner(6, tbtcAddress);

        const result = await scanOnce(
            "WBTC",
            RskRescueMode.Refund,
            refundAddress,
        );

        expect(result.value).toMatchObject({
            events: [],
            unmatchedSwaps: 0,
        });
        expect(
            readContract.mock.calls.some(
                ([call]) => call.functionName === "hashValues",
            ),
        ).toBe(false);
        expect(
            readContract.mock.calls.some(
                ([call]) => call.functionName === "swaps",
            ),
        ).toBe(false);
    });

    test("keeps matching ERC20 token lockups", async () => {
        setupScanner(6, wbtcAddress);

        const result = await scanOnce(
            "WBTC",
            RskRescueMode.Refund,
            refundAddress,
        );

        expect(result.value).toMatchObject({
            events: [
                {
                    asset: "WBTC",
                    tokenAddress: wbtcAddress,
                    refundAddress,
                },
            ],
            unmatchedSwaps: 0,
        });
        expect(
            readContract.mock.calls.some(
                ([call]) => call.functionName === "hashValues",
            ),
        ).toBe(true);
        expect(
            readContract.mock.calls.some(
                ([call]) => call.functionName === "swaps",
            ),
        ).toBe(true);
    });

    test("decodes v5 Lockup receipts with non-indexed claimAddress", async () => {
        const rawLog = {
            address: swapAddress,
            blockNumber: 10n,
            transactionHash: `0x${"bb".repeat(32)}` as Hex,
            logIndex: 0,
            topics: encodeEventTopics({
                abi: etherSwapAbiV5,
                eventName: "Lockup",
                args: { preimageHash, refundAddress },
            }),
            data: encodeAbiParameters(
                [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
                [123n, claimAddress, 456n],
            ),
        };
        getTransactionReceipt.mockResolvedValue({ logs: [rawLog] });

        const data = await getLogsFromReceipt(
            provider as never,
            "RBTC",
            {
                address: swapAddress,
                read: { version: vi.fn().mockResolvedValue(5) },
            } as never,
            rawLog.transactionHash,
        );

        expect(data).toMatchObject({
            amount: 123n,
            preimageHash: preimageHash.replace(/^0x/, ""),
            claimAddress,
            refundAddress,
            timelock: 456n,
            transactionHash: rawLog.transactionHash,
        });
    });

    test("decodes v6 Lockup receipts with indexed claimAddress", async () => {
        const rawLog = {
            address: swapAddress,
            blockNumber: 10n,
            transactionHash: `0x${"cc".repeat(32)}` as Hex,
            logIndex: 0,
            topics: encodeEventTopics({
                abi: etherSwapAbi,
                eventName: "Lockup",
                args: { preimageHash, claimAddress, refundAddress },
            }),
            data: encodeAbiParameters(
                [{ type: "uint256" }, { type: "uint256" }],
                [123n, 456n],
            ),
        };
        getTransactionReceipt.mockResolvedValue({ logs: [rawLog] });

        const data = await getLogsFromReceipt(
            provider as never,
            "RBTC",
            {
                address: swapAddress,
                read: { version: vi.fn().mockResolvedValue(6) },
            } as never,
            rawLog.transactionHash,
        );

        expect(data).toMatchObject({
            amount: 123n,
            preimageHash: preimageHash.replace(/^0x/, ""),
            claimAddress,
            refundAddress,
            timelock: 456n,
            transactionHash: rawLog.transactionHash,
        });
    });
});
