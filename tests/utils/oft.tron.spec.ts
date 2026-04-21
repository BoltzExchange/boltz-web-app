// @vitest-environment node
import type { TronConnector } from "@reown/appkit-utils/tron";

import type * as TronChainsModule from "../../src/utils/chains/tron";

vi.mock("../../src/utils/chains/tron", async () => {
    const actual = await vi.importActual<typeof TronChainsModule>(
        "../../src/utils/chains/tron",
    );

    return {
        ...actual,
        getTronWeb: vi.fn(actual.getTronWeb),
    };
});

const { createTronOftContract } = await import("../../src/utils/oft/tron");
const { getTronWeb } = await import("../../src/utils/chains/tron");

type MockTronClient = Awaited<ReturnType<typeof getTronWeb>>;

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
        vi.mocked(getTronWeb).mockResolvedValue(client);

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
        vi.mocked(getTronWeb).mockResolvedValue(client);

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
});
