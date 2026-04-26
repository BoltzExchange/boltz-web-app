import { render, screen, waitFor } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import CreateButton, {
    getClaimAddress,
} from "../../src/components/CreateButton";
import type * as ConfigModule from "../../src/config";
import { BTC, LBTC, LN, RBTC, TBTC, USDT0 } from "../../src/consts/Assets";
import { useCreateContext } from "../../src/context/Create";
import { useGlobalContext } from "../../src/context/Global";
import i18n from "../../src/i18n/i18n";
import * as rifSigner from "../../src/rif/Signer";
import Pair from "../../src/utils/Pair";
import type { Pairs } from "../../src/utils/boltzClient";
import {
    GasAbstractionType,
    createUniformGasAbstraction,
} from "../../src/utils/swapCreator";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";
import { pairs as testPairs } from "../pairs";

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: {
            ...actual.config,
            assets: {
                ...actual.config.assets,
                "USDT0-POL": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Polygon PoS",
                        symbol: "POL",
                        gasToken: "POL",
                        chainId: 137,
                        nativeCurrency: {
                            name: "POL",
                            symbol: "POL",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000000137",
                    },
                },
                "USDT0-CFX": {
                    ...actual.config.assets.USDT0,
                    canSend: false,
                    network: {
                        ...actual.config.assets.USDT0.network,
                        chainName: "Conflux eSpace",
                        symbol: "CFX",
                        gasToken: "CFX",
                        chainId: 1030,
                        nativeCurrency: {
                            name: "CFX",
                            symbol: "CFX",
                            decimals: 18,
                        },
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "0x0000000000000000000000000000000000001030",
                    },
                },
                "USDT0-SOL": {
                    ...actual.config.assets.USDT0,
                    canSend: true,
                    blockExplorerUrl: {
                        id: "solscan",
                        normal: "https://solscan.io",
                    },
                    network: {
                        chainName: "Solana",
                        symbol: "SOL",
                        gasToken: "SOL",
                        transport: "solana",
                        rpcUrls: ["https://api.mainnet.solana.com"],
                        nativeCurrency: {
                            name: "SOL",
                            symbol: "SOL",
                            decimals: 9,
                        },
                    },
                    bridge: {
                        ...actual.config.assets.USDT0.bridge,
                        mesh: "legacy",
                        quotePayer:
                            "EzTybRqGouGB4vKin67HFYgLsVkzE6A1YUq26uKyTvPN",
                    },
                    token: {
                        ...actual.config.assets.USDT0.token,
                        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                    },
                },
            },
        },
    };
});

const invoice =
    "lnbcrt600u1p5ynhmgpp5l8j7lnaql4mqeukvcqmhr8zp9vh3rngfgmla6km2fh9vf8pt678sdqqcqzzsxqrpwusp56gha98s9xk2f4eeyhs7dcsx4j4rt79llks72nf6l6hc9cna6vfgs9qxpqysgqqnt8lqcrujmuuv3ajvrlu5z7ydvvge4efv39hj28etf8v72vpcl597evz5e0tvq04tv3z089wxtugee4xh5hvu6309ymrfddrlzfhzgqumsrpk";

const usdt0Pairs: Pairs = {
    submarine: {
        TBTC: {
            BTC: {
                hash: "tbtc-ln-pair-hash",
                rate: 1,
                limits: {
                    maximal: 1_000_000,
                    minimal: 1,
                    maximalZeroConf: 0,
                },
                fees: {
                    percentage: 0,
                    minerFees: 0,
                },
            },
        },
    },
    reverse: {},
    chain: {},
};

const setPairAssets = (fromAsset: string, toAsset: string) => {
    signals.setPair(new Pair(signals.pair().pairs, fromAsset, toAsset));
};

const setPairAssetsWithPairs = (
    pairs: Pairs,
    fromAsset: string,
    toAsset: string,
) => {
    signals.setPair(new Pair(pairs, fromAsset, toAsset, pairs));
};

describe("CreateButton", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should render CreateButton", () => {
        render(() => <CreateButton />, {
            wrapper: contextWrapper,
        });
    });

    test("should show a loading spinner while pairs are loading", async () => {
        render(() => <CreateButton />, {
            wrapper: contextWrapper,
        });

        const btn = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;
        expect(btn.disabled).toBeTruthy();
        expect(btn.classList.contains("btn-danger")).toBe(false);
        expect(btn.classList.contains("btn-error")).toBe(false);

        expect(await screen.findByTestId("loading-spinner")).not.toBeNull();
        expect(screen.queryByText(i18n.en.invalid_pair)).toBeNull();
    });

    test("should clear spinner and show label once pairs load", async () => {
        let global: ReturnType<typeof useGlobalContext> | undefined;
        let create: ReturnType<typeof useCreateContext> | undefined;
        const Capture = () => {
            global = useGlobalContext();
            create = useCreateContext();
            return null;
        };

        render(
            () => (
                <>
                    <Capture />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );

        expect(await screen.findByTestId("loading-spinner")).not.toBeNull();

        global!.setPairs(testPairs);
        global!.setRegularPairs(testPairs);
        create!.setMinimum(50_000);

        const btn = (await screen.findByText(
            i18n.en.minimum_amount
                .replace("{{ amount }}", "50 000")
                .replace("{{ denomination }}", "sats"),
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(screen.queryByTestId("loading-spinner")).toBeNull();
    });

    test("should use rif relay gas abstraction for low-balance RBTC claims", async () => {
        vi.spyOn(rifSigner, "getSmartWalletAddress").mockResolvedValue({
            address: "0xsmartwallet",
            nonce: 0n,
        });

        const signer = {
            getAddress: vi.fn().mockResolvedValue("0xsigner"),
            provider: {
                getBalance: vi.fn().mockResolvedValue(0n),
                getFeeData: vi.fn().mockResolvedValue({ gasPrice: 1n }),
            },
        } as never;

        await expect(
            getClaimAddress(
                () => RBTC,
                () => BTC,
                () => signer,
                () => "0xuser",
                vi.fn(),
                false,
            ),
        ).resolves.toEqual({
            gasAbstraction: {
                lockup: GasAbstractionType.None,
                claim: GasAbstractionType.RifRelay,
            },
            gasPrice: 1n,
            claimAddress: "0xsmartwallet",
        });
    });

    test("should keep signer lockup gas abstraction for TBTC to low-balance RBTC swaps", async () => {
        vi.spyOn(rifSigner, "getSmartWalletAddress").mockResolvedValue({
            address: "0xsmartwallet",
            nonce: 0n,
        });

        const signer = {
            getAddress: vi.fn().mockResolvedValue("0xsigner"),
            provider: {
                getBalance: vi.fn().mockResolvedValue(0n),
                getFeeData: vi.fn().mockResolvedValue({ gasPrice: 1n }),
            },
        } as never;

        await expect(
            getClaimAddress(
                () => RBTC,
                () => TBTC,
                () => signer,
                () => "0xuser",
                vi.fn(),
                false,
            ),
        ).resolves.toEqual({
            gasAbstraction: {
                lockup: GasAbstractionType.Signer,
                claim: GasAbstractionType.RifRelay,
            },
            gasPrice: 1n,
            claimAddress: "0xsmartwallet",
        });
    });

    test("should use no gas abstraction for non-EVM claims", async () => {
        await expect(
            getClaimAddress(
                () => BTC,
                () => LBTC,
                () => undefined,
                () => "bc1qaddr",
                vi.fn(),
                false,
            ),
        ).resolves.toEqual({
            gasAbstraction: createUniformGasAbstraction(
                GasAbstractionType.None,
            ),
            gasPrice: 0n,
            claimAddress: "bc1qaddr",
        });
    });

    test("should keep the user destination for TBTC claims without gas token", async () => {
        const getGasAbstractionSigner = vi
            .fn()
            .mockReturnValue({ address: "0xgas" });

        await expect(
            getClaimAddress(
                () => TBTC,
                () => BTC,
                () => undefined,
                () => "0xuser",
                getGasAbstractionSigner,
                false,
            ),
        ).resolves.toEqual({
            gasAbstraction: {
                lockup: GasAbstractionType.None,
                claim: GasAbstractionType.Signer,
            },
            gasPrice: 0n,
            claimAddress: "0xuser",
        });
        expect(getGasAbstractionSigner).toHaveBeenCalledWith(TBTC);
    });

    test("should use gas signer address for TBTC claims with gas token", async () => {
        const getGasAbstractionSigner = vi
            .fn()
            .mockReturnValue({ address: "0xgas" });

        await expect(
            getClaimAddress(
                () => TBTC,
                () => BTC,
                () => undefined,
                () => "0xuser",
                getGasAbstractionSigner,
                true,
            ),
        ).resolves.toEqual({
            gasAbstraction: {
                lockup: GasAbstractionType.None,
                claim: GasAbstractionType.Signer,
            },
            gasPrice: 0n,
            claimAddress: "0xgas",
        });
        expect(getGasAbstractionSigner).toHaveBeenCalledWith(TBTC);
    });

    test("should use signer gas abstraction for USDT0 claims", async () => {
        const getGasAbstractionSigner = vi
            .fn()
            .mockReturnValue({ address: "0xgas" });

        await expect(
            getClaimAddress(
                () => USDT0,
                () => BTC,
                () => undefined,
                () => "0xuser",
                getGasAbstractionSigner,
                false,
            ),
        ).resolves.toEqual({
            gasAbstraction: {
                lockup: GasAbstractionType.None,
                claim: GasAbstractionType.Signer,
            },
            gasPrice: 0n,
            claimAddress: "0xgas",
        });
        expect(getGasAbstractionSigner).toHaveBeenCalledWith(USDT0);
    });

    test("should use canonical USDT0 gas abstraction for legacy mesh receives", async () => {
        const getGasAbstractionSigner = vi
            .fn()
            .mockReturnValue({ address: "0xgas" });

        await expect(
            getClaimAddress(
                () => "USDT0-SOL",
                () => BTC,
                () => undefined,
                () => "So11111111111111111111111111111111111111112",
                getGasAbstractionSigner,
                false,
            ),
        ).resolves.toEqual({
            gasAbstraction: {
                lockup: GasAbstractionType.None,
                claim: GasAbstractionType.Signer,
            },
            gasPrice: 0n,
            claimAddress: "0xgas",
        });
        expect(getGasAbstractionSigner).toHaveBeenCalledWith(USDT0);
    });

    test("should not use signer gas abstraction when sending RBTC", async () => {
        const getGasAbstractionSigner = vi.fn();

        await expect(
            getClaimAddress(
                () => BTC,
                () => RBTC,
                () => undefined,
                () => "bc1qaddr",
                getGasAbstractionSigner,
                false,
            ),
        ).resolves.toEqual({
            gasAbstraction: createUniformGasAbstraction(
                GasAbstractionType.None,
            ),
            gasPrice: 0n,
            claimAddress: "bc1qaddr",
        });
        expect(getGasAbstractionSigner).not.toHaveBeenCalled();
    });

    test("should initially be disabled with minimum label", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        signals.setMinimum(50_000);
        const btn = (await screen.findByText(
            i18n.en.minimum_amount
                .replace("{{ amount }}", "50 000")
                .replace("{{ denomination }}", "sats"),
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });

    test("should apply btn-error class for maximum_amount", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(250_000));
        signals.setReceiveAmount(BigNumber(200_000));
        signals.setMinimum(50_000);
        signals.setMaximum(200_000);
        signals.setAmountValid(false);
        signals.setInvoice(invoice);
        signals.setInvoiceValid(true);
        setPairAssets(LBTC, LN);

        const btn = (await screen.findByText(
            i18n.en.maximum_amount
                .replace("{{ amount }}", "200 000")
                .replace("{{ denomination }}", "sats"),
        )) as HTMLButtonElement;
        expect(btn.classList.contains("btn-error")).toBe(true);
        expect(btn.classList.contains("btn-danger")).toBe(false);
    });

    test("should be enabled with create_swap label", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        setPairAssets(LBTC, BTC);
        signals.setAmountValid(true);
        signals.setAddressValid(true);
        signals.setOnchainAddress(
            "bcrt1qfan5dacdvedpzmweqcq0swxg7klhsh4d0qn74u",
        );
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
    });

    test("should be disabled with api_offline label", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(false);
        const btn = (await screen.findByText(
            i18n.en.api_offline,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });

    test("should be disabled on invalid address", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setAddressValid(true);
        setPairAssets(LBTC, BTC);
        signals.setOnchainAddress(
            "bcrt1qfan5dacdvedpzmweqcq0swxg7klhsh4d0qn74u",
        );
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
        signals.setAddressValid(false);
        expect(btn.disabled).toBeTruthy();
        const label = i18n.en.invalid_address.replace("{{ asset }}", "BTC");
        expect(btn.textContent).toEqual(label);
    });

    test("should be disabled on invalid invoice", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoiceValid(true);
        setPairAssets(LBTC, LN);
        signals.setInvoice(invoice);
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
        signals.setInvoiceValid(false);
        expect(btn.disabled).toBeTruthy();
        expect(btn.textContent).toEqual(i18n.en.invalid_invoice);
    });

    test("should be disabled with invalid_0_amount label", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoiceValid(true);
        setPairAssets(LBTC, LN);
        signals.setInvoice(invoice);
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();
        signals.setInvoiceValid(false);
        signals.setInvoiceError("invalid_0_amount");
        expect(btn.disabled).toBeTruthy();
        expect(btn.textContent).toEqual(i18n.en.invalid_0_amount);
        expect(btn.classList.contains("btn-error")).toBe(true);
        signals.setAmountValid(false);
        expect(btn.disabled).toBeTruthy();
        expect(btn.textContent).toEqual(i18n.en.invalid_0_amount);
    });

    test("should be disabled on empty invoice", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoiceValid(true);
        setPairAssets(LBTC, LN);
        signals.setInvoice("");
        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });

    test("should be disabled on empty address", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoiceValid(true);
        setPairAssets(LN, LBTC);
        signals.setOnchainAddress("");
        const btn = (await screen.findByText(
            i18n.en.invalid_address.replace("{{ asset }}", "LBTC"),
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeTruthy();
    });

    test("should be enabled for sendable USDT0 variants", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoice(invoice);
        signals.setInvoiceValid(true);
        setPairAssetsWithPairs(usdt0Pairs, "USDT0-POL", LN);

        const btn = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;

        await waitFor(() => {
            expect(signals.valid()).toBe(true);
            expect(btn.disabled).toBe(false);
            expect(btn.textContent).toBe(i18n.en.create_swap);
        });
    });

    test("should reject unsendable USDT0 variants as invalid pairs", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoice(invoice);
        signals.setInvoiceValid(true);
        setPairAssetsWithPairs(usdt0Pairs, "USDT0-CFX", LN);

        const btn = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;

        await waitFor(() => {
            expect(signals.valid()).toBe(false);
            expect(btn.disabled).toBe(true);
            expect(btn.textContent).toBe(i18n.en.invalid_send_asset);
        });
        expect(btn.classList.contains("btn-error")).toBe(true);
        expect(btn.classList.contains("btn-danger")).toBe(false);
    });

    test("should show btn-error for invalid pairs with sendable assets", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoice(invoice);
        signals.setInvoiceValid(true);
        setPairAssetsWithPairs(usdt0Pairs, "USDT0-POL", "USDT0-CFX");

        const btn = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;

        await waitFor(() => {
            expect(btn.textContent).toBe(i18n.en.invalid_pair);
        });
        expect(btn.classList.contains("btn-error")).toBe(true);
        expect(btn.classList.contains("btn-danger")).toBe(false);
    });

    test("should not show a loading spinner for invalid pairs", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoice(invoice);
        signals.setInvoiceValid(true);
        setPairAssetsWithPairs(usdt0Pairs, "USDT0-CFX", LN);
        signals.setQuoteLoading(true);

        const btn = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;

        await waitFor(() => {
            expect(btn.textContent).toBe(i18n.en.invalid_send_asset);
        });
        expect(screen.queryByTestId("loading-spinner")).toBeNull();
    });

    test("should be disabled with LNURL min amount error", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        // response in milisats
                        minSendable: 100_000, // 100 sats
                        maxSendable: 200_000, // 200 sats
                    }),
            }),
        );

        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(90));
        signals.setReceiveAmount(BigNumber(80));
        signals.setAmountValid(true);
        signals.setAddressValid(true);
        setPairAssets(LBTC, LN);
        signals.setLnurl("test@example.com");

        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();

        btn.click();

        const errorBtn = (await screen.findByText(
            i18n.en.min_amount_destination
                .replace("{{ amount }}", "100")
                .replace("{{ denomination }}", "sats"),
        )) as HTMLButtonElement;
        expect(errorBtn).not.toBeUndefined();
        expect(errorBtn.disabled).toBeTruthy();
        expect(errorBtn.classList.contains("btn-error")).toBe(true);
        expect(errorBtn.classList.contains("btn-danger")).toBe(false);
    });

    test("should apply btn-error class only for user-error labels", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const btn = (await screen.findByTestId(
            "create-swap-button",
        )) as HTMLButtonElement;

        // Default in-progress state (initial load shows minimum_amount): no
        // btn-error class should be applied.
        globalSignals.setOnline(true);
        signals.setMinimum(50_000);
        await waitFor(() => {
            expect(btn.textContent).toBe(
                i18n.en.minimum_amount
                    .replace("{{ amount }}", "50 000")
                    .replace("{{ denomination }}", "sats"),
            );
        });
        expect(btn.classList.contains("btn-error")).toBe(false);
        expect(btn.classList.contains("btn-danger")).toBe(false);

        // User-error state: invalid send asset triggers btn-error.
        signals.setSendAmount(BigNumber(100_000));
        signals.setAmountValid(true);
        signals.setInvoice(invoice);
        signals.setInvoiceValid(true);
        setPairAssetsWithPairs(usdt0Pairs, "USDT0-CFX", LN);
        await waitFor(() => {
            expect(btn.textContent).toBe(i18n.en.invalid_send_asset);
        });
        expect(btn.classList.contains("btn-error")).toBe(true);
        expect(btn.classList.contains("btn-danger")).toBe(false);

        // Offline takes precedence over user-error: btn-danger, not btn-error.
        globalSignals.setOnline(false);
        await waitFor(() => {
            expect(btn.textContent).toBe(i18n.en.api_offline);
        });
        expect(btn.classList.contains("btn-danger")).toBe(true);
        expect(btn.classList.contains("btn-error")).toBe(false);
    });

    test("should be disabled with LNURL max amount error", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        // response in milisats
                        minSendable: 100_000, // 100 sats
                        maxSendable: 200_000, // 200 sats
                    }),
            }),
        );

        render(
            () => (
                <>
                    <TestComponent />
                    <CreateButton />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setOnline(true);
        signals.setSendAmount(BigNumber(400));
        signals.setReceiveAmount(BigNumber(300));
        signals.setAmountValid(true);
        signals.setAddressValid(true);
        setPairAssets(LBTC, LN);
        signals.setLnurl("test@example.com");

        const btn = (await screen.findByText(
            i18n.en.create_swap,
        )) as HTMLButtonElement;
        expect(btn).not.toBeUndefined();
        expect(btn.disabled).toBeFalsy();

        btn.click();

        const errorBtn = (await screen.findByText(
            i18n.en.max_amount_destination
                .replace("{{ amount }}", "200")
                .replace("{{ denomination }}", "sats"),
        )) as HTMLButtonElement;
        expect(errorBtn).not.toBeUndefined();
        expect(errorBtn.disabled).toBeTruthy();
        expect(errorBtn.classList.contains("btn-error")).toBe(true);
        expect(errorBtn.classList.contains("btn-danger")).toBe(false);
    });
});
