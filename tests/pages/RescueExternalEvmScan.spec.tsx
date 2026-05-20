import { render, screen, waitFor } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { getRestorableSwaps } from "boltz-swaps/client";
import { RskRescueMode } from "boltz-swaps/types";
import type { JSX } from "solid-js";
import { vi } from "vitest";

import { TBTC, WBTC } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import RescueExternal from "../../src/pages/external-rescue/RescueExternal";
import { TestComponent, contextWrapper } from "../helper";

const {
    mockGetErc20Swap,
    mockGetSweepableGasAbstractionBalances,
    mockPreimageHashesWorker,
    mockScanLockupEvents,
} = vi.hoisted(() => ({
    mockGetErc20Swap: vi.fn(() => ({})),
    mockGetSweepableGasAbstractionBalances: vi.fn(),
    mockPreimageHashesWorker: vi.fn(function PreimageHashesWorker() {
        return {};
    }),
    mockScanLockupEvents: vi.fn(async function* () {
        await Promise.resolve();
        yield {
            derivedKeys: undefined,
            events: [],
            progress: 1,
            unmatchedSwaps: 0,
        };
    }),
}));

vi.mock("boltz-swaps/client", () => ({
    getRestorableSwaps: vi.fn(),
}));

vi.mock("boltz-swaps/evm", () => ({
    createProvider: vi.fn(() => ({})),
    getTimelockBlockNumber: vi.fn(() => Promise.resolve(0)),
    scanLockupEvents: mockScanLockupEvents,
}));

vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <button type="button">{i18n.en.connect_wallet}</button>,
}));

vi.mock("../../src/context/Web3", () => ({
    Web3SignerProvider: (props: { children: JSX.Element }) => (
        <>{props.children}</>
    ),
    useWeb3Signer: () => ({
        browserWalletTransports: () => new Set(),
        clearSigner: vi.fn(),
        connectProvider: vi.fn(),
        connectProviderForAddress: vi.fn(),
        connectedWallet: () => ({
            address: "0x0000000000000000000000000000000000000001",
            rdns: "test",
            transport: "evm",
        }),
        getContractsForAsset: vi.fn(),
        getErc20Swap: mockGetErc20Swap,
        getEtherSwap: vi.fn(() => ({})),
        getGasAbstractionSigner: vi.fn(),
        getSwapContractVersion: vi.fn(() => 6),
        openWalletConnectModal: () => false,
        providers: () => ({}),
        setOpenWalletConnectModal: vi.fn(),
        setWalletConnected: vi.fn(),
        signer: () => ({
            address: "0x0000000000000000000000000000000000000001",
        }),
        switchNetwork: vi.fn(),
        walletConnected: () => true,
    }),
}));

vi.mock("../../src/utils/gasAbstractionSweep", () => ({
    getSweepableGasAbstractionBalances: mockGetSweepableGasAbstractionBalances,
}));

vi.mock("../../src/workers/preimageHashes/PreimageHashesWorker", () => ({
    PreimageHashesWorker: mockPreimageHashesWorker,
}));

const mockGetRestorableSwaps = vi.mocked(getRestorableSwaps);

describe("RescueExternal EVM scan", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("VITE_RSK_LOG_SCAN_ENDPOINT", "http://localhost:8545");
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "");
        mockGetRestorableSwaps.mockResolvedValue([]);
        mockGetSweepableGasAbstractionBalances.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test("passes a preimage derivation worker to claim scans", async () => {
        const user = userEvent.setup();

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(
                JSON.stringify({
                    mnemonic:
                        "horse olympic laundry marriage material private arch civil theory crew alone thank",
                }),
            );

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(mockScanLockupEvents).toHaveBeenCalledWith(
                expect.any(AbortSignal),
                expect.anything(),
                expect.objectContaining({
                    action: RskRescueMode.Claim,
                    mnemonic: expect.any(String),
                }),
                expect.any(Object),
            );
        });
        expect(mockPreimageHashesWorker).toHaveBeenCalledTimes(1);
    });

    test("scans WBTC and TBTC on Arbitrum", async () => {
        const user = userEvent.setup();
        vi.stubEnv("VITE_ARBITRUM_LOG_SCAN_ENDPOINT", "http://localhost:8547");

        render(
            () => (
                <>
                    <TestComponent />
                    <RescueExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const uploadInput = await screen.findByTestId("refundUpload");
        const rescueFile = new File(["{}"], "rescue.json", {
            type: "application/json",
        });
        (rescueFile as File & { text: () => Promise<string> }).text = () =>
            Promise.resolve(
                JSON.stringify({
                    mnemonic:
                        "horse olympic laundry marriage material private arch civil theory crew alone thank",
                }),
            );

        await user.upload(uploadInput, rescueFile);
        await user.click(screen.getByRole("button", { name: i18n.en.rescue }));

        await waitFor(() => {
            expect(mockGetErc20Swap).toHaveBeenCalledWith(TBTC);
            expect(mockGetErc20Swap).toHaveBeenCalledWith(WBTC);
        });

        expect(mockScanLockupEvents).toHaveBeenCalledWith(
            expect.any(AbortSignal),
            expect.anything(),
            expect.objectContaining({
                asset: WBTC,
                providerUrl: "http://localhost:8547",
            }),
            expect.anything(),
        );
    });
});
