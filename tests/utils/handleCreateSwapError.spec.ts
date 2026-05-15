import BigNumber from "bignumber.js";
import type * as BoltzClientModule from "boltz-swaps/client";
import type { Pairs } from "boltz-swaps/client";
import type { Setter } from "solid-js";
import type { Mock } from "vitest";

import { BTC, LN } from "../../src/consts/Assets";
import { Side } from "../../src/consts/Enums";
import type { notifyFn, tFn } from "../../src/context/Global";
import Pair from "../../src/utils/Pair";
import { handleCreateSwapError } from "../../src/utils/handleCreateSwapError";
import { pairs } from "../pairs";

const { getPairsMock } = vi.hoisted(() => ({
    getPairsMock: vi.fn(),
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

describe("handleCreateSwapError", () => {
    let notify: Mock<notifyFn>;
    let t: Mock<tFn>;
    let setPairs: Setter<Pairs | undefined>;
    let setSendAmount: Setter<BigNumber>;
    let setAmountChanged: Setter<Side>;
    let pair: Pair;

    beforeEach(() => {
        vi.clearAllMocks();
        getPairsMock.mockResolvedValue(pairs);
        notify = vi.fn();
        t = vi.fn((key) => key);
        setPairs = vi.fn() as unknown as Setter<Pairs | undefined>;
        setSendAmount = vi.fn() as unknown as Setter<BigNumber>;
        setAmountChanged = vi.fn() as unknown as Setter<Side>;
        pair = new Pair(pairs, LN, BTC);
    });

    const call = (err: unknown) =>
        handleCreateSwapError(
            err,
            notify,
            t,
            () => pair,
            () => undefined,
            setPairs,
            setSendAmount,
            setAmountChanged,
        );

    test("returns false and does nothing for unrecognized errors", async () => {
        await expect(call(new Error("some random failure"))).resolves.toBe(
            false,
        );
        expect(notify).not.toHaveBeenCalled();
        expect(setPairs).not.toHaveBeenCalled();
        expect(setSendAmount).not.toHaveBeenCalled();
    });

    test("recovers from invalid pair hash", async () => {
        await expect(call(new Error("invalid pair hash"))).resolves.toBe(true);

        expect(setPairs).toHaveBeenCalledWith(pairs);
        expect(notify).toHaveBeenCalledWith("error", "feecheck");
        expect(setSendAmount).not.toHaveBeenCalled();
        expect(setAmountChanged).not.toHaveBeenCalled();
    });

    test("clamps the send amount to the minimum on amount-too-low errors", async () => {
        await expect(
            call(new Error("100 is less than minimal of 50000")),
        ).resolves.toBe(true);

        expect(setPairs).toHaveBeenCalledWith(pairs);
        expect(setAmountChanged).toHaveBeenCalledWith(Side.Send);
        expect(vi.mocked(setSendAmount).mock.calls[0][0]).toEqual(
            BigNumber(pairs.reverse[BTC][BTC].limits.minimal),
        );
        expect(notify).toHaveBeenCalledWith("error", "amount_limits_changed");
    });

    test("clamps the send amount to the maximum on amount-too-high errors", async () => {
        await expect(
            call(new Error("9999999 exceeds maximal of 4294967")),
        ).resolves.toBe(true);

        expect(vi.mocked(setSendAmount).mock.calls[0][0]).toEqual(
            BigNumber(pairs.reverse[BTC][BTC].limits.maximal),
        );
        expect(notify).toHaveBeenCalledWith("error", "amount_limits_changed");
    });

    test.each([
        "100 is less than minimal of 50000",
        new Error("100 is less than minimal of 50000"),
        { message: "100 is less than minimal of 50000" },
    ])("detects errors regardless of shape (%s)", async (err) => {
        await expect(call(err)).resolves.toBe(true);
        expect(notify).toHaveBeenCalledWith("error", "amount_limits_changed");
    });

    test("uses the freshly fetched pairs when computing limits", async () => {
        const tighter: typeof pairs = JSON.parse(JSON.stringify(pairs));
        tighter.reverse[BTC][BTC].limits.minimal = 75000;
        getPairsMock.mockResolvedValue(tighter);

        await expect(
            call(new Error("100 is less than minimal of 50000")),
        ).resolves.toBe(true);

        expect(vi.mocked(setSendAmount).mock.calls[0][0]).toEqual(
            BigNumber(75000),
        );
        expect(setPairs).toHaveBeenCalledWith(tighter);
    });
});
