import type * as SolidRouter from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";
import { type LogRefundData, RskRescueMode, SwapType } from "boltz-swaps/types";
import type { JSX } from "solid-js";
import { vi } from "vitest";

import { TBTC } from "../../src/consts/Assets";
import type * as RescueContextModule from "../../src/context/Rescue";
import type * as Web3Module from "../../src/context/Web3";
import type { EvmRescueResult } from "../../src/pages/external-rescue/types";
import type { RescueFile } from "../../src/utils/rescueFile";
import { contextWrapper } from "../helper";

const transactionHash =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const preimageHash =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const preimage =
    "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const { mockGetLogsFromReceipt, paramsMock, rescueSwaps } = vi.hoisted(() => ({
    mockGetLogsFromReceipt: vi.fn(),
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

const gasSigner = {
    address: "0x0000000000000000000000000000000000000004",
    provider: {},
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
}));

vi.mock("../../src/components/RefundButton", () => ({
    RefundEvm: () => <button type="button">Refund</button>,
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

describe("RescueEvm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        paramsMock.current = {
            asset: TBTC,
            txHash: transactionHash,
            action: RskRescueMode.Claim,
        };
        mockGetLogsFromReceipt.mockResolvedValue(logData);
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

    test("shows wallet connect and refund actions for a restored DEX refund", async () => {
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
            await screen.findByRole("button", { name: "Connect wallet" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Refund" }),
        ).toBeInTheDocument();
        expect(mockGetLogsFromReceipt).toHaveBeenCalled();
    });
});
