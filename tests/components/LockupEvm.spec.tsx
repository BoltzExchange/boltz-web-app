import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import LockupEvm from "../../src/components/LockupEvm";
import { GasAbstractionType } from "../../src/utils/swapCreator";

let currentSwap: Record<string, unknown>;

const mockGetCommitmentLockupDetails =
    vi.fn<
        (asset: string) => Promise<{ claimAddress: string; timelock: number }>
    >();
const mockSendPopulatedTransaction =
    vi.fn<(...args: unknown[]) => Promise<string>>();
const mockSetSwap = vi.fn((swap: Record<string, unknown>) => {
    currentSwap = { ...swap };
});
const mockSetSwapStorage = vi.fn((swap: Record<string, unknown>) => {
    currentSwap = { ...swap };
    return Promise.resolve();
});
const mockSigner = {
    address: "0x1000000000000000000000000000000000000000",
    rdns: "mock.wallet",
    provider: {
        getChainId: vi.fn().mockResolvedValue(30),
        getBalance: vi.fn().mockResolvedValue(1_000_000n),
        estimateFeesPerGas: vi.fn().mockResolvedValue({ gasPrice: 2n }),
        getGasPrice: vi.fn().mockResolvedValue(2n),
    },
};

vi.mock("../../src/config", () => ({
    config: {
        assets: {
            RBTC: {
                network: {
                    chainId: 30,
                },
            },
        },
    },
}));

vi.mock("../../src/consts/Assets", () => ({
    AssetKind: {
        ERC20: "ERC20",
        EVMNative: "EVM_NATIVE",
    },
    getKindForAsset: (asset: string) =>
        asset === "RBTC" ? "EVM_NATIVE" : "ERC20",
    getTokenAddress: vi.fn(),
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        getSwap: vi.fn().mockResolvedValue(currentSwap),
        setSwapStorage: mockSetSwapStorage,
        slippage: () => 0.5,
        t: (key: string) => key,
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        setSwap: mockSetSwap,
    }),
}));

vi.mock("../../src/context/Web3", () => ({
    createRouterContract: vi.fn(),
    createTokenContract: vi.fn(),
    customDerivationPathRdns: [],
    useWeb3Signer: () => ({
        getErc20Swap: vi.fn(),
        getEtherSwap: vi.fn(() => ({
            address: "0x4000000000000000000000000000000000000000",
        })),
        getGasAbstractionSigner: vi.fn(() => ({
            address: "0x2000000000000000000000000000000000000000",
        })),
        providers: () => ({}),
        signer: () => mockSigner,
    }),
}));

vi.mock("../../src/utils/boltzClient", () => ({
    encodeDexQuote: vi.fn(),
    getCommitmentLockupDetails: (asset: string) =>
        mockGetCommitmentLockupDetails(asset),
    quoteDexAmountOut: vi.fn(),
}));

vi.mock("../../src/utils/calculate", () => ({
    calculateAmountWithSlippage: (amount: bigint) => amount,
}));

vi.mock("../../src/utils/commitment", () => ({
    emptyPreimageHash: `0x${"00".repeat(32)}`,
}));

vi.mock("../../src/utils/evmTransaction", async () => {
    const actual = await vi.importActual("../../src/utils/evmTransaction");

    return {
        ...actual,
        getSignerForGasAbstraction: () => mockSigner,
        sendPopulatedTransaction: (...args: unknown[]) =>
            mockSendPopulatedTransaction(...args),
    };
});

vi.mock("../../src/components/ApproveErc20", () => ({
    default: () => <div>approve</div>,
}));

vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <span>connect</span>,
}));

vi.mock("../../src/components/ContractTransaction", () => ({
    default: (props: { onClick: () => Promise<void> }) => (
        <button type="button" onClick={() => void props.onClick()}>
            send
        </button>
    ),
}));

vi.mock("../../src/components/InsufficientBalance", () => ({
    default: () => <div>insufficient</div>,
}));

vi.mock("../../src/components/LoadingSpinner", () => ({
    default: () => <div>loading</div>,
}));

vi.mock("../../src/components/OptimizedRoute", () => ({
    default: () => <div />,
}));

vi.mock("../../src/components/SendToBridge", () => ({
    default: () => <div>bridge</div>,
}));

describe("LockupEvm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentSwap = {
            id: "swap-rbtc",
        };
        mockGetCommitmentLockupDetails.mockResolvedValue({
            claimAddress: "0x3000000000000000000000000000000000000000",
            timelock: 321,
        });
        mockSendPopulatedTransaction.mockResolvedValue("0xcommitment");
    });

    test("should send all native EVM lockups as commitment lockups", async () => {
        render(() => (
            <LockupEvm
                asset="RBTC"
                gasAbstraction={GasAbstractionType.None}
                swapId="swap-rbtc"
                amount={0}
                preimageHash={"11".repeat(32)}
                claimAddress="0x5000000000000000000000000000000000000000"
                timeoutBlockHeight={123}
            />
        ));

        const sendButton = await screen.findByRole("button", { name: "send" });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalled();
        });

        expect(mockGetCommitmentLockupDetails).toHaveBeenCalledWith("RBTC");
        expect(mockSendPopulatedTransaction).toHaveBeenCalledWith(
            GasAbstractionType.None,
            mockSigner,
            expect.objectContaining({
                to: "0x4000000000000000000000000000000000000000",
                data: expect.stringMatching(/^0x/),
                value: 908_000n,
            }),
        );
        expect(currentSwap).toMatchObject({
            commitmentLockupTxHash: "0xcommitment",
            commitmentSignatureSubmitted: false,
            signer: "0x1000000000000000000000000000000000000000",
        });
        expect(mockSetSwapStorage).toHaveBeenCalledWith(
            expect.objectContaining({
                commitmentLockupTxHash: "0xcommitment",
            }),
        );
    });
});
