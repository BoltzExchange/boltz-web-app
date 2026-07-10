import type * as SolidRouter from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import {
    BridgeKind,
    type LogRefundData,
    RskRescueMode,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import type { JSX } from "solid-js";
import { vi } from "vitest";

import { config } from "../../src/config";
import { TBTC } from "../../src/consts/Assets";
import type * as RescueContextModule from "../../src/context/Rescue";
import type * as Web3Module from "../../src/context/Web3";
import i18n from "../../src/i18n/i18n";
import type { EvmRescueResult } from "../../src/pages/external-rescue/types";
import type { RescueFile } from "../../src/utils/rescueFile";
import type { DexDetail } from "../../src/utils/swapCreator";
import { contextWrapper } from "../helper";

const transactionHash =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const preimageHash =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const preimage =
    "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const {
    mockGetLogsFromReceipt,
    mockResolveLockupTokenFunder,
    paramsMock,
    rescueSwaps,
} = vi.hoisted(() => ({
    mockGetLogsFromReceipt: vi.fn(),
    mockResolveLockupTokenFunder: vi.fn(),
    paramsMock: {
        current: {
            asset: "TBTC",
            txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            action: "claim",
        },
    },
    rescueSwaps: { current: [] as EvmRescueResult[] },
}));

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual<typeof SolidRouter>("@solidjs/router");
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        useParams: () => paramsMock.current,
    };
});

vi.mock("boltz-swaps/evm", async () => {
    const actual = await vi.importActual("boltz-swaps/evm");
    return {
        ...actual,
        createAssetProvider: vi.fn(() => ({})),
    };
});

vi.mock("boltz-swaps/evm/logs", async () => {
    const actual = await vi.importActual("boltz-swaps/evm/logs");
    return {
        ...actual,
        getLogsFromReceipt: mockGetLogsFromReceipt,
        getTimelockBlockNumber: vi.fn(() => Promise.resolve(1_000)),
    };
});

vi.mock("../../src/utils/evmLockup", async () => {
    const actual = await vi.importActual("../../src/utils/evmLockup");
    return {
        ...actual,
        resolveLockupTokenFunder: mockResolveLockupTokenFunder,
    };
});

const gasSigner = {
    address: "0x0000000000000000000000000000000000000004",
    provider: {
        getChainId: () =>
            Promise.resolve(config.assets?.TBTC?.network?.chainId ?? 1),
    },
};

vi.mock("../../src/context/Web3", async () => {
    const actual = await vi.importActual<typeof Web3Module>(
        "../../src/context/Web3",
    );
    return {
        ...actual,
        Web3SignerProvider: (props: { children: JSX.Element }) => (
            <>{props.children}</>
        ),
        useWeb3Signer: () => ({
            connectedWallet: () => undefined,
            getErc20Swap: vi.fn(() => ({})),
            getEtherSwap: vi.fn(() => ({})),
            getGasAbstractionSigner: vi.fn(() => gasSigner),
            signer: () => undefined,
        }),
    };
});

vi.mock("../../src/context/Rescue", async () => {
    const actual = await vi.importActual<typeof RescueContextModule>(
        "../../src/context/Rescue",
    );
    return {
        ...actual,
        RescueProvider: (props: { children: JSX.Element }) => (
            <>{props.children}</>
        ),
        useRescueContext: () => ({
            evmRescuableSwaps: () => rescueSwaps.current,
            rescueFile: () => ({ mnemonic: "test" }) as RescueFile,
        }),
    };
});

vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <button type="button">Connect wallet</button>,
    ConnectAddress: () => <button type="button">Connect address</button>,
    SwitchNetwork: () => <button type="button">Switch network</button>,
}));

vi.mock("../../src/components/RefundButton", () => ({
    RefundEvm: (props: { disabled?: boolean }) => (
        <button type="button" disabled={props.disabled}>
            Refund
        </button>
    ),
}));

const { default: RescueEvm } = await import("../../src/pages/RescueEvm");

const logData = {
    asset: TBTC,
    blockNumber: 100,
    transactionHash,
    preimageHash,
    amount: 1_000_000_000_000n,
    claimAddress: "0x0000000000000000000000000000000000000001",
    refundAddress: "0x0000000000000000000000000000000000000002",
    timelock: 500n,
} satisfies LogRefundData;

const restoredSwap = {
    id: "restored-dex",
    type: SwapType.Reverse,
    status: "transaction.confirmed",
    createdAt: 1,
    from: "L-BTC",
    to: TBTC,
    preimageHash,
    evmClaimDetails: {
        contractAddress: "0x0000000000000000000000000000000000000003",
        claimAddress: logData.claimAddress,
        transaction: { id: transactionHash },
        timeoutBlockHeight: 500,
    },
};

const originalFunder = "0x0000000000000000000000000000000000000005";
const originalDestination = "0x0000000000000000000000000000000000000006";

const preDex: DexDetail = {
    position: SwapPosition.Pre,
    quoteAmount: "1000",
    hops: [
        {
            type: SwapType.Dex,
            from: "USDT0",
            to: TBTC,
            dexDetails: {
                chain: "ARB",
                tokenIn: "0x0000000000000000000000000000000000000010",
                tokenOut: "0x0000000000000000000000000000000000000011",
            },
        },
    ],
};

const postDex: DexDetail = {
    position: SwapPosition.Post,
    quoteAmount: "1000",
    hops: [
        {
            type: SwapType.Dex,
            from: TBTC,
            to: "USDT0",
            dexDetails: {
                chain: "ARB",
                tokenIn: "0x0000000000000000000000000000000000000010",
                tokenOut: "0x0000000000000000000000000000000000000011",
            },
        },
    ],
};

describe("RescueEvm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        paramsMock.current = {
            asset: TBTC,
            txHash: transactionHash,
            action: RskRescueMode.Claim,
        };
        mockGetLogsFromReceipt.mockResolvedValue(logData);
        mockResolveLockupTokenFunder.mockResolvedValue(originalFunder);
        rescueSwaps.current = [
            {
                ...logData,
                action: RskRescueMode.Claim,
                preimage,
                restoredSwap,
            },
        ];
    });

    test("loads a restored DEX claim before the wallet is connected", async () => {
        render(() => <RescueEvm />, { wrapper: contextWrapper });

        expect(
            await screen.findByRole("button", { name: "Connect wallet" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Claim" })).toBeDisabled();
        expect(screen.queryByText("No wallet connected")).toBeNull();
        expect(mockGetLogsFromReceipt).toHaveBeenCalled();
    });

    test("enables a plain restored refund without a connected wallet", async () => {
        paramsMock.current.action = RskRescueMode.Refund;
        rescueSwaps.current = [
            {
                ...logData,
                action: RskRescueMode.Refund,
                currentHeight: 1_000n,
                restoredSwap: {
                    ...restoredSwap,
                    type: SwapType.Chain,
                    from: TBTC,
                    to: "L-BTC",
                },
            },
        ];

        render(() => <RescueEvm />, { wrapper: contextWrapper });

        expect(
            await screen.findByRole("button", { name: "Refund" }),
        ).not.toBeDisabled();
        expect(
            screen.queryByRole("button", { name: "Connect wallet" }),
        ).toBeNull();
        expect(mockResolveLockupTokenFunder).not.toHaveBeenCalled();
        expect(mockGetLogsFromReceipt).toHaveBeenCalled();
    });

    test("resolves the original funder for a pre-DEX refund without a wallet", async () => {
        paramsMock.current.action = RskRescueMode.Refund;
        rescueSwaps.current = [
            {
                ...logData,
                action: RskRescueMode.Refund,
                currentHeight: 1_000n,
                restoredSwap: {
                    ...restoredSwap,
                    type: SwapType.Chain,
                    from: TBTC,
                    to: "L-BTC",
                    dex: preDex,
                },
            },
        ];

        render(() => <RescueEvm />, { wrapper: contextWrapper });

        const refund = await screen.findByRole("button", { name: "Refund" });
        await waitFor(() => expect(refund).not.toBeDisabled());
        expect(
            screen.queryByRole("button", { name: "Connect wallet" }),
        ).toBeNull();
        expect(mockResolveLockupTokenFunder).toHaveBeenCalledWith(
            TBTC,
            preDex.hops[0].dexDetails!.tokenIn,
            transactionHash,
        );
    });

    test("does not resolve a funder for pre-bridge refunds", async () => {
        paramsMock.current.action = RskRescueMode.Refund;
        rescueSwaps.current = [
            {
                ...logData,
                action: RskRescueMode.Refund,
                currentHeight: 1_000n,
                restoredSwap: {
                    ...restoredSwap,
                    type: SwapType.Chain,
                    from: TBTC,
                    to: "L-BTC",
                    dex: preDex,
                    bridge: {
                        kind: BridgeKind.Oft,
                        position: SwapPosition.Pre,
                        sourceAsset: "USDT0-ETH",
                        destinationAsset: "USDT0",
                    },
                },
            },
        ];

        render(() => <RescueEvm />, { wrapper: contextWrapper });

        expect(
            await screen.findByRole("button", { name: "Refund" }),
        ).not.toBeDisabled();
        expect(
            screen.queryByRole("button", { name: "Connect wallet" }),
        ).toBeNull();
        expect(mockResolveLockupTokenFunder).not.toHaveBeenCalled();
    });

    test("asks for a wallet when the pre-DEX refund destination cannot be resolved", async () => {
        paramsMock.current.action = RskRescueMode.Refund;
        mockResolveLockupTokenFunder.mockResolvedValue(undefined);
        rescueSwaps.current = [
            {
                ...logData,
                action: RskRescueMode.Refund,
                currentHeight: 1_000n,
                restoredSwap: {
                    ...restoredSwap,
                    type: SwapType.Chain,
                    from: TBTC,
                    to: "L-BTC",
                    dex: preDex,
                },
            },
        ];

        render(() => <RescueEvm />, { wrapper: contextWrapper });

        expect(
            await screen.findByRole("button", { name: "Connect wallet" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Refund" })).toBeDisabled();
    });

    test("keeps a routed DEX claim gated when the original destination is missing", async () => {
        rescueSwaps.current = [
            {
                ...logData,
                action: RskRescueMode.Claim,
                preimage,
                restoredSwap: {
                    ...restoredSwap,
                    dex: postDex,
                },
            },
        ];

        render(() => <RescueEvm />, { wrapper: contextWrapper });

        expect(
            await screen.findByRole("button", { name: "Connect wallet" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Claim" })).toBeDisabled();
    });

    test("claims a restored routed DEX swap without a connected wallet", async () => {
        rescueSwaps.current = [
            {
                ...logData,
                action: RskRescueMode.Claim,
                preimage,
                restoredSwap: {
                    ...restoredSwap,
                    originalDestination,
                    dex: postDex,
                },
            },
        ];

        render(() => <RescueEvm />, { wrapper: contextWrapper });

        expect(
            await screen.findByRole("button", { name: i18n.en.continue }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Connect wallet" }),
        ).toBeNull();
        expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();
    });
});
