import { config } from "../../src/config";
import { CctpReceiveMode, CctpTransferMode } from "../../src/configs/base";
import { cctpFeeBpsDenominator, getCctpFee } from "../../src/utils/cctp/fee";

const oneBps = cctpFeeBpsDenominator / 10_000n;

const feeEntry = (
    finalityThreshold: number,
    minimumFee: number,
    forwardFee: { low: number; med: number; high: number } = {
        low: 0,
        med: 0,
        high: 0,
    },
) => ({
    finalityThreshold,
    minimumFee,
    forwardFee,
});

describe("cctpFee", () => {
    const originalFeeApiUrl = config.cctpApiUrl;

    beforeEach(() => {
        config.cctpApiUrl = "https://iris-api.circle.com";
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(() => {
        config.cctpApiUrl = originalFeeApiUrl;
    });

    test("should select the fast transfer fee with forwarding", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    feeEntry(1000, 1.3, {
                        low: 200_000,
                        med: 207_543,
                        high: 215_000,
                    }),
                    feeEntry(2000, 0),
                ]),
        } as Response);

        await expect(getCctpFee(3, 6, CctpTransferMode.Fast)).resolves.toEqual({
            bpsUnits: (oneBps * 13n) / 10n,
            forwardFee: 207_543n,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/burn/USDC/fees/3/6?forward=true",
            expect.any(Object),
        );
    });

    test("should select the standard transfer fee", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    feeEntry(1000, 7, {
                        low: 300_000,
                        med: 310_000,
                        high: 320_000,
                    }),
                    feeEntry(2000, 0, {
                        low: 100_000,
                        med: 105_000,
                        high: 110_000,
                    }),
                ]),
        } as Response);

        await expect(
            getCctpFee(3, 6, CctpTransferMode.Standard),
        ).resolves.toEqual({
            bpsUnits: 0n,
            forwardFee: 105_000n,
        });
    });

    test("should select fees without forwarding for manual receives", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    {
                        finalityThreshold: 1000,
                        minimumFee: 1.3,
                    },
                    feeEntry(2000, 0),
                ]),
        } as Response);

        await expect(
            getCctpFee(3, 6, CctpTransferMode.Fast, CctpReceiveMode.Manual),
        ).resolves.toEqual({
            bpsUnits: (oneBps * 13n) / 10n,
            forwardFee: 0n,
        });
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/burn/USDC/fees/3/6",
            expect.any(Object),
        );
    });

    test("should fetch route fees on each lookup", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    feeEntry(1000, 1, {
                        low: 1,
                        med: 2,
                        high: 3,
                    }),
                    feeEntry(2000, 0),
                ]),
        } as Response);

        await expect(getCctpFee(3, 6, CctpTransferMode.Fast)).resolves.toEqual({
            bpsUnits: oneBps,
            forwardFee: 2n,
        });
        await expect(getCctpFee(3, 6, CctpTransferMode.Fast)).resolves.toEqual({
            bpsUnits: oneBps,
            forwardFee: 2n,
        });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    test("should throw when the expected finality threshold is missing", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    feeEntry(1000, 1, {
                        low: 1,
                        med: 2,
                        high: 3,
                    }),
                ]),
        } as Response);

        await expect(
            getCctpFee(3, 6, CctpTransferMode.Standard),
        ).rejects.toThrow("missing CCTP fee");
    });

    test("should throw when forwardFee is missing", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    {
                        finalityThreshold: 1000,
                        minimumFee: 1,
                    },
                    {
                        finalityThreshold: 2000,
                        minimumFee: 0,
                    },
                ]),
        } as Response);

        await expect(getCctpFee(3, 6, CctpTransferMode.Fast)).rejects.toThrow(
            /forward fee/,
        );
    });

    test("should throw on API failures", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 503,
        } as Response);

        await expect(getCctpFee(3, 6, CctpTransferMode.Fast)).rejects.toThrow(
            "HTTP 503",
        );
    });
});
