// @vitest-environment node
import type { TronConnector } from "@reown/appkit-utils/tron";
import {
    createTronOftContract,
    getTronOftGuidFromTransactionInfo,
    oftAbi,
    waitForSuccessfulTronTransaction,
} from "boltz-swaps/oft";
import * as tronChain from "boltz-swaps/tron";
import type { TronTransactionInfo } from "boltz-swaps/tron";
import {
    encodeAbiParameters,
    encodeEventTopics,
    encodeFunctionResult,
} from "viem";

type MockTronClient = Awaited<ReturnType<typeof tronChain.getTronWeb>>;

const contractAddress = "TFG4wBaDQ8sHWWP1ACeSGnoNR6RRzevLPt";
const refundAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const tronChainId = "tron:0x2b6653dc";
const sendParam = [
    30420,
    `0x${"00".repeat(32)}`,
    100n,
    100n,
    "0x",
    "0x",
    "0x",
] as const;
const msgFee = [123n, 0n] as const;

const createConstantResponse = (result: string) => ({
    result: {
        result: true,
    },
    constant_result: [result],
});

const createWalletProvider = (request = vi.fn()) =>
    ({
        chains: [{ caipNetworkId: tronChainId }],
        provider: { request },
    }) as unknown as TronConnector;

const createMockClient = () => {
    const triggerConstantContract = vi.fn();
    const triggerSmartContract = vi.fn().mockResolvedValue({
        result: {
            result: true,
        },
        transaction: {
            txID: "built-tron-tx",
        },
    });
    const sendRawTransaction = vi.fn().mockResolvedValue({
        result: true,
    });
    const client = {
        transactionBuilder: {
            triggerConstantContract,
            triggerSmartContract,
        },
        trx: {
            sendRawTransaction,
        },
    } as unknown as MockTronClient;

    return {
        client,
        triggerConstantContract,
        triggerSmartContract,
        sendRawTransaction,
    };
};

describe("tron oft", () => {
    beforeEach(() => {
        vi.spyOn(tronChain, "getTronTransactionInfo");
        vi.spyOn(tronChain, "getTronWeb");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should read whether approval is required", async () => {
        const walletProvider = createWalletProvider();
        const { client, triggerConstantContract } = createMockClient();
        triggerConstantContract.mockResolvedValue(
            createConstantResponse(
                "0000000000000000000000000000000000000000000000000000000000000001",
            ),
        );
        vi.mocked(tronChain.getTronWeb).mockResolvedValue(client);

        await expect(
            createTronOftContract({
                sourceAsset: "USDT0-TRON",
                contractAddress,
                walletProvider,
            }).approvalRequired?.(),
        ).resolves.toBe(true);
    });

    test("should sign and broadcast Tron OFT sends through the WalletConnect provider", async () => {
        const walletConnectRequest = vi.fn().mockResolvedValue({
            result: {
                txID: "wallet-connect-tx",
                signature: ["0x01"],
            },
        });
        const walletProvider = createWalletProvider(walletConnectRequest);
        const { client, sendRawTransaction } = createMockClient();
        vi.mocked(tronChain.getTronWeb).mockResolvedValue(client);

        const transaction = await createTronOftContract({
            sourceAsset: "USDT0-TRON",
            contractAddress,
            walletProvider,
        }).send([...sendParam], [...msgFee], refundAddress);

        expect(transaction.hash).toBe("wallet-connect-tx");
        expect(walletConnectRequest).toHaveBeenCalledWith(
            {
                method: "tron_signTransaction",
                params: {
                    address: refundAddress,
                    transaction: {
                        transaction: {
                            txID: "built-tron-tx",
                        },
                    },
                },
            },
            tronChainId,
        );
        expect(sendRawTransaction).toHaveBeenCalledWith({
            txID: "wallet-connect-tx",
            signature: ["0x01"],
        });
    });

    test("should decode hex Tron transaction failure messages", async () => {
        const walletConnectRequest = vi.fn().mockResolvedValue({
            result: {
                txID: "failed-tron-tx",
                signature: ["0x01"],
            },
        });
        const walletProvider = createWalletProvider(walletConnectRequest);
        const { client } = createMockClient();
        vi.mocked(tronChain.getTronWeb).mockResolvedValue(client);
        vi.mocked(tronChain.getTronTransactionInfo).mockResolvedValue({
            result: "FAILED",
            resMessage: "0x4f55545f4f465f454e45524759",
        } as TronTransactionInfo);

        const transaction = await createTronOftContract({
            sourceAsset: "USDT0-TRON",
            contractAddress,
            walletProvider,
        }).send([...sendParam], [...msgFee], refundAddress);

        await expect(
            waitForSuccessfulTronTransaction("USDT0-TRON", transaction.hash),
        ).rejects.toThrow("OUT_OF_ENERGY");
    });

    test("should decode the named-tuple return of quoteOFT", async () => {
        const encodedResult = encodeFunctionResult({
            abi: oftAbi,
            functionName: "quoteOFT",
            result: [
                { minAmountLD: 10n, maxAmountLD: 1_000n },
                [{ feeAmountLD: -5n, description: "slippage" }],
                { amountSentLD: 100n, amountReceivedLD: 95n },
            ],
        });
        const walletProvider = createWalletProvider();
        const { client, triggerConstantContract } = createMockClient();
        triggerConstantContract.mockResolvedValue(
            createConstantResponse(encodedResult.replace(/^0x/, "")),
        );
        vi.mocked(tronChain.getTronWeb).mockResolvedValue(client);

        const [oftLimit, oftFeeDetails, oftReceipt] =
            await createTronOftContract({
                sourceAsset: "USDT0-TRON",
                contractAddress,
                walletProvider,
            }).quoteOFT([...sendParam]);

        expect(oftLimit).toEqual([10n, 1_000n]);
        expect(oftFeeDetails).toEqual([[-5n, "slippage"]]);
        expect(oftReceipt).toEqual([100n, 95n]);
    });

    test("should decode the named-tuple return of quoteSend", async () => {
        const encodedResult = encodeFunctionResult({
            abi: oftAbi,
            functionName: "quoteSend",
            result: { nativeFee: 7n, lzTokenFee: 3n },
        });
        const walletProvider = createWalletProvider();
        const { client, triggerConstantContract } = createMockClient();
        triggerConstantContract.mockResolvedValue(
            createConstantResponse(encodedResult.replace(/^0x/, "")),
        );
        vi.mocked(tronChain.getTronWeb).mockResolvedValue(client);

        const fee = await createTronOftContract({
            sourceAsset: "USDT0-TRON",
            contractAddress,
            walletProvider,
        }).quoteSend([...sendParam], false);

        expect(fee).toEqual([7n, 3n]);
    });

    test("should decode the OFTSent event from a Tron transaction info log", () => {
        const guid = `0x${"ab".repeat(32)}` as const;
        const dstEid = 30420;
        const fromAddressHex = `0x${"11".repeat(20)}` as const;
        const amountSentLD = 1_000n;
        const amountReceivedLD = 950n;

        const topics = encodeEventTopics({
            abi: oftAbi,
            eventName: "OFTSent",
            args: { guid, fromAddress: fromAddressHex },
        });
        const data = encodeAbiParameters(
            [{ type: "uint32" }, { type: "uint256" }, { type: "uint256" }],
            [dstEid, amountSentLD, amountReceivedLD],
        );

        // Tron RPC returns logs without 0x prefixes — decoder must handle both.
        const transactionInfo = {
            log: [
                {
                    address: contractAddress,
                    data: data.replace(/^0x/, ""),
                    topics: topics.map((topic) =>
                        String(topic).replace(/^0x/, ""),
                    ),
                },
            ],
        } as unknown as Pick<TronTransactionInfo, "log">;

        expect(
            getTronOftGuidFromTransactionInfo(transactionInfo, contractAddress),
        ).toBe(guid);
    });

    test("should ignore non-OFTSent logs and unrelated contract addresses", () => {
        const otherContract = "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH";
        const transactionInfo = {
            log: [
                {
                    address: otherContract,
                    data: "00".repeat(64),
                    topics: ["aa".repeat(32)],
                },
            ],
        } as unknown as Pick<TronTransactionInfo, "log">;

        expect(
            getTronOftGuidFromTransactionInfo(transactionInfo, contractAddress),
        ).toBeUndefined();
    });
});
