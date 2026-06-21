import {
    AssetKind,
    type ChainSwapExecuteArgs,
    GasAbstractionType,
    NetworkTransport,
    executeChainSwap,
    setBoltzSwapsConfig,
} from "boltz-swaps";
import { getAddress } from "viem";

import type * as SwapContractsModule from "../src/evm/swapContracts.ts";
import type * as TransactionModule from "../src/evm/transaction.ts";

const { buildSwapContractsForAssetMock, claimAssetMock } = vi.hoisted(() => ({
    buildSwapContractsForAssetMock: vi.fn(),
    claimAssetMock: vi.fn(),
}));

vi.mock("../src/evm/swapContracts.ts", async (importActual) => ({
    ...(await importActual<typeof SwapContractsModule>()),
    buildSwapContractsForAsset: buildSwapContractsForAssetMock,
}));

vi.mock("../src/evm/transaction.ts", async (importActual) => ({
    ...(await importActual<typeof TransactionModule>()),
    claimAsset: claimAssetMock,
}));

const REFUND = "0x000000000000000000000000000000000000dead";
const CLAIM = "0x1111111111111111111111111111111111111111";
const DESTINATION = "0x2222222222222222222222222222222222222222";

const createdSwap = {
    id: "swap-1",
    claimDetails: {
        swapTree: {} as never,
        lockupAddress: "0xcontract",
        serverPublicKey: "02",
        timeoutBlockHeight: 12345,
        amount: 100_000,
        refundAddress: REFUND,
        claimAddress: CLAIM,
    },
    lockupDetails: {} as never,
};

const evmArgs = (
    overrides: Partial<ChainSwapExecuteArgs> = {},
): ChainSwapExecuteArgs => ({
    createdSwap,
    to: "TBTC",
    preimage: "0xpre",
    claimAddress: CLAIM,
    signer: {} as never,
    ...overrides,
});

beforeEach(() => {
    buildSwapContractsForAssetMock.mockReset();
    claimAssetMock.mockReset();
    buildSwapContractsForAssetMock.mockResolvedValue({
        etherSwap: { address: "0xe" },
        erc20Swap: { address: "0xr" },
    });
    claimAssetMock.mockResolvedValue({
        transactionHash: "0xclaimtx",
        receiveAmount: 99_000n,
    });
    setBoltzSwapsConfig({
        assets: {
            TBTC: {
                type: AssetKind.ERC20,
                network: {
                    chainName: "Arbitrum",
                    symbol: "TBTC",
                    gasToken: "ETH",
                    transport: NetworkTransport.Evm,
                    chainId: 42161,
                    rpcUrls: ["http://localhost"],
                },
                token: { address: CLAIM, decimals: 18 },
            },
            RBTC: {
                type: AssetKind.EVMNative,
                network: {
                    chainName: "Rootstock",
                    symbol: "RBTC",
                    gasToken: "RBTC",
                    transport: NetworkTransport.Evm,
                    chainId: 30,
                    rpcUrls: ["http://localhost"],
                },
            },
        } as never,
    });
});

describe("executeChainSwap: EVM destination", () => {
    test("claims the destination and returns the claim tx", async () => {
        const result = await executeChainSwap(evmArgs());

        expect(result).toEqual({
            claimTransactionId: "0xclaimtx",
            receiveAmount: 99_000n,
        });
        expect(claimAssetMock).toHaveBeenCalledTimes(1);
        expect(claimAssetMock).toHaveBeenCalledWith(
            expect.objectContaining({
                gasAbstraction: GasAbstractionType.Signer,
                asset: "TBTC",
                preimage: "0xpre",
                amount: 100_000,
                claimAddress: getAddress(CLAIM),
                refundAddress: getAddress(REFUND),
                timeoutBlockHeight: 12345,
                destination: getAddress(CLAIM),
            }),
        );
    });

    test("preserves the committed claim address when forwarding to a distinct destination", async () => {
        await executeChainSwap(evmArgs({ destination: DESTINATION }));

        expect(claimAssetMock).toHaveBeenCalledTimes(1);
        expect(claimAssetMock).toHaveBeenCalledWith(
            expect.objectContaining({
                claimAddress: getAddress(CLAIM),
                destination: getAddress(DESTINATION),
            }),
        );
    });

    test("requires a signer", async () => {
        await expect(
            executeChainSwap(evmArgs({ signer: undefined })),
        ).rejects.toThrow(/requires a signer/);
        expect(claimAssetMock).not.toHaveBeenCalled();
    });
});

describe("executeChainSwap: destination validation", () => {
    test("rejects a distinct destination for a native-EVM asset", async () => {
        await expect(
            executeChainSwap(evmArgs({ to: "RBTC", destination: DESTINATION })),
        ).rejects.toThrow(/destination must be omitted or equal claimAddress/);
        expect(claimAssetMock).not.toHaveBeenCalled();
    });

    test("allows a native-EVM destination equal to claimAddress", async () => {
        await executeChainSwap(evmArgs({ to: "RBTC", destination: CLAIM }));
        expect(claimAssetMock).toHaveBeenCalledTimes(1);
    });

    test("rejects a distinct destination for a UTXO asset", async () => {
        await expect(
            executeChainSwap(evmArgs({ to: "BTC", destination: DESTINATION })),
        ).rejects.toThrow(/destination must be omitted or equal claimAddress/);
        expect(claimAssetMock).not.toHaveBeenCalled();
    });
});
