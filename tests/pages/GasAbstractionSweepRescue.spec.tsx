import type * as SolidRouter from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { type Accessor, createEffect, createSignal } from "solid-js";
import { describe, expect, test, vi } from "vitest";

import { TBTC, USDC, USDT0 } from "../../src/consts/Assets";
import { RskRescueMode } from "../../src/consts/Enums";
import type * as RescueContextModule from "../../src/context/Rescue";
import type * as Web3Module from "../../src/context/Web3";
import type { Signer } from "../../src/context/Web3";
import type * as ContractsModule from "../../src/context/contracts";
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

vi.mock("../../src/context/contracts", async () => {
    const actual = await vi.importActual<typeof ContractsModule>(
        "../../src/context/contracts",
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

const makeSigner = (address: string) =>
    ({
        address,
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
    test("shows the no-wallet fallback when the signer is undefined", async () => {
        resetState();
        setRescueFile({ mnemonic: "test" } as RescueFile);

        renderPage();

        expect(await screen.findByText(i18n.en.no_wallet)).toBeInTheDocument();
    });

    test("prompts to scan with the rescue file when none is loaded", async () => {
        resetState();
        setSigner(makeSigner(validAddress));

        renderPage();

        expect(
            await screen.findByText(i18n.en.refund_scan_required),
        ).toBeInTheDocument();
    });

    test("re-runs the resource when the signer arrives after mount", async () => {
        resetState();
        setRescueFile({ mnemonic: "test" } as RescueFile);
        getGasAbstractionSigner.mockReturnValue(makeSigner(validAddress));
        balanceOf.mockResolvedValue(0n);

        renderPage();

        // initial render: signer undefined → no_wallet fallback
        expect(await screen.findByText(i18n.en.no_wallet)).toBeInTheDocument();
        expect(getGasAbstractionSigner).not.toHaveBeenCalled();

        setSigner(makeSigner(validAddress));

        // resource fetches once the source signal becomes truthy
        await waitFor(() =>
            expect(getGasAbstractionSigner).toHaveBeenCalledWith(
                USDT0,
                expect.objectContaining({ mnemonic: "test" }),
            ),
        );
        expect(
            await screen.findByText(i18n.en.connected_wallet_no_swaps),
        ).toBeInTheDocument();
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
            await screen.findByText(i18n.en.connected_wallet_no_swaps),
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

            const prompt = await screen.findByTestId("prompt-text");
            // Prompt starts with the localized "Refund" verb and embeds the
            // formatted balance.
            expect(prompt.textContent).toMatch(
                new RegExp(`^${i18n.en.refund} ${expectedAmountFragment}`),
            );
            expect(lastContractTxProps.current?.signerOverride?.()).toBe(
                gasSigner,
            );
            expect(lastContractTxProps.current?.asset).toBe(asset);
        },
    );

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
