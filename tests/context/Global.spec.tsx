import { render } from "@solidjs/testing-library";
import type * as BoltzClientModule from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";

import type * as ConfigModule from "../../src/config";
import type { SomeSwap } from "../../src/utils/swapCreator";

const { getPairsMock, configMock } = vi.hoisted(() => ({
    getPairsMock: vi.fn<typeof BoltzClientModule.getPairs>(),
    configMock: { isPro: false } as { isPro: boolean },
}));

vi.mock("../../packages/boltz-swaps/src/client.ts", async () => {
    const actual = await vi.importActual<typeof BoltzClientModule>(
        "../../packages/boltz-swaps/src/client.ts",
    );

    return {
        ...actual,
        getPairs: getPairsMock,
    };
});

vi.mock("../../src/utils/migration", () => ({
    migrateStorage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: new Proxy(actual.config as object, {
            get(target, prop) {
                if (prop === "isPro") {
                    return configMock.isPro;
                }
                return target[prop as keyof typeof target];
            },
        }),
    };
});

const { GlobalProvider, useGlobalContext } =
    await import("../../src/context/Global");

const emptyPairs = {
    [SwapType.Submarine]: {},
    [SwapType.Reverse]: {},
    [SwapType.Chain]: {},
} as unknown as Awaited<ReturnType<typeof BoltzClientModule.getPairs>>;

describe("Global context", () => {
    let globalSignals: ReturnType<typeof useGlobalContext>;

    const Probe = () => {
        globalSignals = useGlobalContext();
        return null;
    };

    beforeEach(() => {
        getPairsMock.mockReset();
        configMock.isPro = false;
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe("pair fetching", () => {
        test("fetchRegularPairs uses the regular referral on the pro site", async () => {
            // Regression: previously fetchRegularPairs called getReferral(),
            // which on the pro site returns "pro" — making fetchPairs and
            // fetchRegularPairs return identical data and breaking the
            // FeeComparisonTable opportunity filter.
            configMock.isPro = true;
            getPairsMock.mockResolvedValue(emptyPairs);

            render(() => (
                <GlobalProvider>
                    <Probe />
                </GlobalProvider>
            ));

            await globalSignals.fetchRegularPairs();

            expect(getPairsMock).toHaveBeenCalledTimes(1);
            expect(getPairsMock).toHaveBeenCalledWith({
                headers: { referral: "boltz_webapp_desktop" },
            });
        });

        test("fetchPairs and fetchRegularPairs send different referrals on the pro site", async () => {
            configMock.isPro = true;
            getPairsMock.mockResolvedValue(emptyPairs);

            render(() => (
                <GlobalProvider>
                    <Probe />
                </GlobalProvider>
            ));

            await globalSignals.fetchPairs();
            await globalSignals.fetchRegularPairs();

            expect(getPairsMock).toHaveBeenCalledTimes(2);
            // fetchPairs sends no override — fetcher will fall back to
            // getReferral() which is "pro" on the pro site.
            expect(getPairsMock).toHaveBeenNthCalledWith(1);
            // fetchRegularPairs must explicitly override with the regular
            // referral so the opportunity comparison sees non-pro rates.
            expect(getPairsMock).toHaveBeenNthCalledWith(2, {
                headers: { referral: "boltz_webapp_desktop" },
            });
        });
    });

    describe("embeddedMode", () => {
        test("defaults to false when initialEmbeddedMode is not provided", () => {
            getPairsMock.mockResolvedValue(emptyPairs);

            render(() => (
                <GlobalProvider>
                    <Probe />
                </GlobalProvider>
            ));

            expect(globalSignals.embeddedMode()).toBe(false);
        });

        test("seeds from initialEmbeddedMode prop when true", () => {
            getPairsMock.mockResolvedValue(emptyPairs);

            render(() => (
                <GlobalProvider initialEmbeddedMode={true}>
                    <Probe />
                </GlobalProvider>
            ));

            expect(globalSignals.embeddedMode()).toBe(true);
        });

        test("setter toggles the signal", () => {
            getPairsMock.mockResolvedValue(emptyPairs);

            render(() => (
                <GlobalProvider>
                    <Probe />
                </GlobalProvider>
            ));

            expect(globalSignals.embeddedMode()).toBe(false);
            globalSignals.setEmbeddedMode(true);
            expect(globalSignals.embeddedMode()).toBe(true);
        });
    });

    describe("swap storage", () => {
        const renderProvider = () => {
            getPairsMock.mockResolvedValue(emptyPairs);
            render(() => (
                <GlobalProvider>
                    <Probe />
                </GlobalProvider>
            ));
        };

        const storeSwap = (id: string, status: string) =>
            globalSignals.setSwapStorage({ id, status } as unknown as SomeSwap);

        test("modifySwapStorage applies the mutator and persists", async () => {
            renderProvider();
            await storeSwap("s1", "a");

            const updated = await globalSignals.modifySwapStorage("s1", (s) => {
                (s as unknown as { status: string }).status = "b";
            });

            expect(
                (updated as unknown as { status: string } | null)?.status,
            ).toBe("b");
            const stored = await globalSignals.getSwap<{ status: string }>(
                "s1",
            );
            expect(stored?.status).toBe("b");
        });

        test("modifySwapStorage returns null for a missing swap", async () => {
            renderProvider();
            const result = await globalSignals.modifySwapStorage(
                "missing",
                () => {},
            );
            expect(result).toBeNull();
        });

        test("updateSwapStatus persists through the lock and reports changes", async () => {
            renderProvider();
            await storeSwap("s2", "old");

            expect(await globalSignals.updateSwapStatus("s2", "new")).toBe(
                true,
            );
            const stored = await globalSignals.getSwap<{ status: string }>(
                "s2",
            );
            expect(stored?.status).toBe("new");

            expect(await globalSignals.updateSwapStatus("s2", "new")).toBe(
                false,
            );
        });

        test("updateSwapStatus returns false for a missing swap", async () => {
            renderProvider();
            expect(await globalSignals.updateSwapStatus("nope", "x")).toBe(
                false,
            );
        });
    });
});
