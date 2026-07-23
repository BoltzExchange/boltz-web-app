import type * as SolidRouter from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { RskRescueMode } from "boltz-swaps/types";
import { type Accessor, createEffect, createSignal } from "solid-js";
import { describe, expect, test, vi } from "vitest";

import type * as ContractsModule from "../../packages/boltz-swaps/src/evm/contracts.ts";
import { TBTC, USDC, USDT0, requireChainId } from "../../src/consts/Assets";
import type * as RescueContextModule from "../../src/context/Rescue";
import type * as Web3Module from "../../src/context/Web3";
import type { Signer } from "../../src/context/Web3";
import type * as GasAbstractionSweepModule from "../../src/utils/gasAbstractionSweep";
import type { RescueFile } from "../../src/utils/rescueFile";
import { contextWrapper } from "../helper";

// `useParams` is mocked per-test by reassigning `paramsMock`. The mock factory
// is hoisted, so this signal lives at module scope.
const { paramsMock } = vi.hoisted(() => ({
    paramsMock: {
        current: {} as {
            asset: string;
            address: string;
            action: RskRescueMode;
        },
    },
}));

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual<typeof SolidRouter>("@solidjs/router");
    return {
        ...actual,
        useParams: () => paramsMock.current,
    };
});

const [signer, setSigner] = createSignal<Signer | undefined>(undefined);
const [rescueFile, setRescueFile] = createSignal<RescueFile | undefined>(
    undefined,
);

const getGasAbstractionSigner =
    vi.fn<(asset: string, rescueFile?: RescueFile) => Signer>();
const balanceOf = vi.fn<(args: readonly [`0x${string}`]) => Promise<bigint>>();
const sweepGasAbstractionToken = vi.fn<() => Promise<string>>();

vi.mock("../../src/context/Web3", async () => {
    const actual = await vi.importActual<typeof Web3Module>(
        "../../src/context/Web3",
    );
    return {
        ...actual,
        useWeb3Signer: () => ({
            signer,
            getGasAbstractionSigner,
        }),
    };
});

vi.mock("../../packages/boltz-swaps/src/evm/contracts.ts", async () => {
    const actual = await vi.importActual<typeof ContractsModule>(
        "../../packages/boltz-swaps/src/evm/contracts.ts",
    );
    return {
        ...actual,
        createTokenContract: () => ({ read: { balanceOf } }),
    };
});

vi.mock("../../src/context/Rescue", async () => {
    const actual = await vi.importActual<typeof RescueContextModule>(
        "../../src/context/Rescue",
    );
    return {
        ...actual,
        useRescueContext: () => ({ rescueFile }),
    };
});

vi.mock("../../src/utils/gasAbstractionSweep", async () => {
    const actual = await vi.importActual<typeof GasAbstractionSweepModule>(
        "../../src/utils/gasAbstractionSweep",
    );
    return {
        ...actual,
        sweepGasAbstractionToken,
    };
});

const lastContractTxProps: { current: ContractTxProps | undefined } = {
    current: undefined,
};
type ContractTxProps = {
    asset: string;
    disabled?: boolean;
    signerOverride?: Accessor<Signer>;
    onClick: () => Promise<unknown>;
    buttonText: string;
    promptText?: string;
};
vi.mock("../../src/components/ContractTransaction", () => ({
    default: (props: ContractTxProps) => {
        createEffect(() => {
            lastContractTxProps.current = {
                asset: props.asset,
                disabled: props.disabled,
                signerOverride: props.signerOverride,
                onClick: props.onClick,
                buttonText: props.buttonText,
                promptText: props.promptText,
            };
        });
        return (
            <div data-testid="contract-transaction">
                <p data-testid="prompt-text">{props.promptText}</p>
                <button
                    data-testid="contract-tx-button"
                    onClick={() => void props.onClick()}>
                    {props.buttonText}
                </button>
            </div>
        );
    },
}));

vi.mock("../../src/components/ConnectWallet", () => ({
    default: (props: { asset?: string }) => (
        <button data-testid="connect-wallet">
            {signer()?.address ??
                (props.asset === undefined
                    ? "Connect wallet"
                    : `Connect ${props.asset}`)}
        </button>
    ),
}));

vi.mock("../../src/components/BlockExplorer", () => ({
    BlockExplorerTargetKind: { Tx: "tx", Address: "address" },
    default: (props: { id: string }) => (
        <a data-testid="block-explorer" href={`#${props.id}`}>
            {props.id}
        </a>
    ),
}));
vi.mock("../../src/components/settings/SettingsCog", () => ({
    default: () => null,
}));
vi.mock("../../src/components/settings/SettingsMenu", () => ({
    default: () => null,
}));

const { default: GasAbstractionSweepRescue } =
    await import("../../src/pages/GasAbstractionSweepRescue");
const i18n = (await import("../../src/i18n/i18n")).default;

const validAddress = "0x0000000000000000000000000000000000000001";
const otherAddress = "0x0000000000000000000000000000000000000002";
const switchedAddress = "0x0000000000000000000000000000000000000003";

const makeSigner = (address: string, chainId = requireChainId(USDT0)) =>
    ({
        address,
        provider: {
            getChainId: vi.fn().mockResolvedValue(chainId),
        },
    }) as unknown as Signer;

const renderPage = () =>
    render(() => <GasAbstractionSweepRescue />, { wrapper: contextWrapper });

const resetState = () => {
    setSigner(undefined);
    setRescueFile(undefined);
    paramsMock.current = {
        asset: USDT0,
        address: validAddress,
        action: RskRescueMode.Refund,
    };
    getGasAbstractionSigner.mockReset();
    balanceOf.mockReset();
    sweepGasAbstractionToken.mockReset();
    lastContractTxProps.current = undefined;
};

describe("GasAbstractionSweepRescue", () => {
    test("prompts to connect a wallet when the signer is undefined", async () => {
        resetState();
        getGasAbstractionSigner.mockReturnValue(makeSigner(validAddress));
        balanceOf.mockResolvedValue(1n);
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        expect(await screen.findByTestId("connect-wallet")).toHaveTextContent(
            `Connect ${USDT0}`,
        );
        expect(
            screen.getByText(
                "Enter an address on Arbitrum One to receive your USDT refund:",
            ),
        ).toBeInTheDocument();
        expect(screen.getByTestId("refundAddress")).toHaveAttribute(
            "placeholder",
            "Enter an address on Arbitrum One",
        );
        expect(screen.getByText(i18n.en.or)).toBeInTheDocument();
        expect(
            screen
                .getByTestId("refund-amount")
                .compareDocumentPosition(screen.getByTestId("refundAddress")) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    test("prompts to scan with the rescue file when none is loaded", async () => {
        resetState();
        setSigner(makeSigner(validAddress));

        renderPage();

        expect(
            await screen.findByText(i18n.en.refund_scan_required),
        ).toBeInTheDocument();
    });

    test("switches between manual and connected-wallet destinations", async () => {
        resetState();
        setRescueFile({ mnemonic: "test" } as RescueFile);
        getGasAbstractionSigner.mockReturnValue(makeSigner(validAddress));
        balanceOf.mockResolvedValue(1n);

        renderPage();

        expect(await screen.findByTestId("connect-wallet")).toBeInTheDocument();
        expect(screen.getByTestId("refundAddress")).toHaveValue("");
        expect(screen.getByText(i18n.en.or)).toBeInTheDocument();

        setSigner(makeSigner(validAddress));

        await waitFor(() => {
            expect(screen.queryByTestId("refundAddress")).toBeNull();
            expect(screen.getByTestId("connect-wallet")).toBeInTheDocument();
            expect(screen.queryByText(i18n.en.or)).toBeNull();
            expect(lastContractTxProps.current?.disabled).toBe(false);
        });
        expect(sweepGasAbstractionToken).not.toHaveBeenCalled();

        setSigner(undefined);

        expect(await screen.findByTestId("refundAddress")).toBeInTheDocument();
        expect(screen.getByTestId("connect-wallet")).toBeInTheDocument();
        expect(screen.getByText(i18n.en.or)).toBeInTheDocument();
    });

    test("requires the connected wallet to use the refund network", async () => {
        resetState();
        setRescueFile({ mnemonic: "test" } as RescueFile);
        getGasAbstractionSigner.mockReturnValue(makeSigner(validAddress));
        balanceOf.mockResolvedValue(1n);
        setSigner(makeSigner(otherAddress, 1));

        renderPage();

        expect(
            await screen.findByTestId("refund-destination"),
        ).toHaveTextContent("Arbitrum One");
        expect(screen.queryByTestId("contract-transaction")).toBeNull();

        setSigner(makeSigner(switchedAddress));

        expect(
            await screen.findByTestId("contract-transaction"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("connect-wallet")).toHaveTextContent(
            switchedAddress,
        );
    });

    test("errors when the URL asset is not sweepable", async () => {
        resetState();
        paramsMock.current.asset = "BTC";
        setSigner(makeSigner(validAddress));
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        expect(
            await screen.findByText(/unsupported asset: BTC/),
        ).toBeInTheDocument();
        expect(getGasAbstractionSigner).not.toHaveBeenCalled();
    });

    test("errors when the URL action is not refund", async () => {
        resetState();
        paramsMock.current.action = "claim" as RskRescueMode;
        setSigner(makeSigner(validAddress));
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        expect(
            await screen.findByText(/unsupported action: claim/),
        ).toBeInTheDocument();
        expect(getGasAbstractionSigner).not.toHaveBeenCalled();
    });

    test("errors when the rescue-derived address does not match the URL", async () => {
        resetState();
        getGasAbstractionSigner.mockReturnValue(makeSigner(otherAddress));
        setSigner(makeSigner(validAddress));
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        expect(
            await screen.findByText(i18n.en.invalid_rescue_key_evm),
        ).toBeInTheDocument();
        expect(balanceOf).not.toHaveBeenCalled();
    });

    test("renders the no-balance message when the rescue address is empty", async () => {
        resetState();
        getGasAbstractionSigner.mockReturnValue(makeSigner(validAddress));
        balanceOf.mockResolvedValue(0n);
        setSigner(makeSigner(validAddress));
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        expect(
            await screen.findByText(i18n.en.no_rescuable_swaps),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("contract-transaction")).toBeNull();
    });

    test.each([
        {
            asset: USDT0,
            balance: 1_000_000n,
            expectedAmountFragment: "1",
        },
        {
            asset: USDC,
            balance: 1_000_000n,
            expectedAmountFragment: "1",
        },
        {
            asset: TBTC,
            balance: 1_000_000_000_000_000_000n,
            expectedAmountFragment: "1",
        },
    ])(
        "renders a refund prompt for the full balance ($asset)",
        async ({ asset, balance, expectedAmountFragment }) => {
            resetState();
            paramsMock.current.asset = asset;
            const gasSigner = makeSigner(validAddress);
            getGasAbstractionSigner.mockReturnValue(gasSigner);
            balanceOf.mockResolvedValue(balance);
            setSigner(makeSigner(otherAddress));
            setRescueFile({ mnemonic: "test" } as RescueFile);

            renderPage();

            const prompt = await screen.findByTestId("refund-amount");
            // Prompt starts with the localized "Refund" verb and embeds the
            // formatted balance.
            expect(prompt.textContent).toMatch(
                new RegExp(`^${i18n.en.refund} ${expectedAmountFragment}`),
            );
            expect(lastContractTxProps.current?.signerOverride?.()).toBe(
                gasSigner,
            );
            expect(lastContractTxProps.current?.asset).toBe(asset);
            expect(lastContractTxProps.current?.disabled).toBe(false);
        },
    );

    test("refunds to a manually entered address without a connected wallet", async () => {
        resetState();
        const user = userEvent.setup();
        const gasSigner = makeSigner(validAddress);
        getGasAbstractionSigner.mockReturnValue(gasSigner);
        balanceOf.mockResolvedValue(2_500_000n);
        sweepGasAbstractionToken.mockResolvedValue("0xmanual");
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        const input = await screen.findByTestId("refundAddress");
        await user.type(input, `  ${otherAddress}  `);
        await user.click(screen.getByTestId("contract-tx-button"));

        await waitFor(() => {
            expect(sweepGasAbstractionToken).toHaveBeenCalledWith({
                asset: USDT0,
                amount: 2_500_000n,
                destination: otherAddress,
                signer: gasSigner,
            });
        });
    });

    test("clicking refund sweeps to the connected wallet and shows the explorer link", async () => {
        resetState();
        const user = userEvent.setup();
        const gasSigner = makeSigner(validAddress);
        const connectedWallet = makeSigner(otherAddress);
        getGasAbstractionSigner.mockReturnValue(gasSigner);
        balanceOf.mockResolvedValue(2_500_000n);
        sweepGasAbstractionToken.mockResolvedValue("0xdeadbeef");
        setSigner(connectedWallet);
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        const button = await screen.findByTestId("contract-tx-button");
        expect(screen.getByTestId("refund-destination")).toHaveTextContent(
            /Funds will be refunded as USDT on Arbitrum One to your connected EVM wallet/,
        );
        expect(screen.getByTestId("refund-destination")).not.toHaveTextContent(
            otherAddress,
        );
        expect(screen.getByTestId("connect-wallet")).toHaveTextContent(
            otherAddress,
        );
        await user.click(button);

        await waitFor(() => {
            expect(sweepGasAbstractionToken).toHaveBeenCalledWith({
                asset: USDT0,
                amount: 2_500_000n,
                destination: otherAddress,
                signer: gasSigner,
            });
        });

        expect(await screen.findByText(i18n.en.refunded)).toBeInTheDocument();
        expect(await screen.findByTestId("block-explorer")).toHaveTextContent(
            "0xdeadbeef",
        );
    });

    test("does not call sweepGasAbstractionToken when the asset becomes invalid mid-flight", async () => {
        resetState();
        getGasAbstractionSigner.mockReturnValue(makeSigner(validAddress));
        balanceOf.mockResolvedValue(1n);
        setSigner(makeSigner(otherAddress));
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();
        await screen.findByTestId("contract-transaction");

        // Simulate a stale render where params.asset somehow becomes invalid
        // before the user clicks (e.g. router params mutated). The guard in
        // sweep() must prevent the call.
        paramsMock.current.asset = "BTC";

        await lastContractTxProps.current!.onClick();

        expect(sweepGasAbstractionToken).not.toHaveBeenCalled();
    });
});
