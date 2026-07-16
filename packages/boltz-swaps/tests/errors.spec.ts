import {
    BridgeCapacityError,
    LnurlAmountError,
    LnurlAmountErrorKind,
    formatError,
    isBridgeCapacityError,
    isLnurlAmountError,
    toError,
} from "../src/errors.ts";

describe("toError", () => {
    test("returns the same Error instance unchanged", () => {
        const err = new Error("original");
        expect(toError(err)).toBe(err);
    });

    test("preserves an Error subclass", () => {
        class CustomError extends Error {}
        const err = new CustomError("custom");
        expect(toError(err)).toBe(err);
        expect(toError(err)).toBeInstanceOf(CustomError);
    });

    test("wraps a string in an Error with that message", () => {
        const result = toError("boom");
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("boom");
    });

    test("wraps a non-Error object using its formatted message", () => {
        const result = toError({ error: "backend failed" });
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("backend failed");
    });

    test("returns a LnurlAmountError instance unchanged", () => {
        const err = new LnurlAmountError(LnurlAmountErrorKind.Max, 1000);
        expect(toError(err)).toBe(err);
    });
});

describe("LnurlAmountError", () => {
    test("Min variant exposes message, cause, kind and limits", () => {
        const err = new LnurlAmountError(LnurlAmountErrorKind.Min, 5000);
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(LnurlAmountError);
        expect(err.name).toBe("LnurlAmountError");
        expect(err.message).toBe("minAmount");
        expect(err.cause).toBe(5000);
        expect(err.kind).toBe(LnurlAmountErrorKind.Min);
        expect(err.limitMsat).toBe(5000);
        expect(err.limitSat).toBe(5);
    });

    test("Max variant exposes maxAmount message and floors limitSat", () => {
        const err = new LnurlAmountError(LnurlAmountErrorKind.Max, 2500);
        expect(err.message).toBe("maxAmount");
        expect(err.kind).toBe(LnurlAmountErrorKind.Max);
        expect(err.cause).toBe(2500);
        expect(err.limitMsat).toBe(2500);
        expect(err.limitSat).toBe(2);
    });

    test("Min variant ceils limitSat into the satisfiable range", () => {
        const err = new LnurlAmountError(LnurlAmountErrorKind.Min, 2500);
        expect(err.limitSat).toBe(3);
    });
});

describe("isLnurlAmountError", () => {
    test("returns true for a LnurlAmountError instance", () => {
        const err = new LnurlAmountError(LnurlAmountErrorKind.Min, 5000);
        expect(isLnurlAmountError(err)).toBe(true);
    });

    test("returns false for a plain Error with the same message", () => {
        expect(isLnurlAmountError(new Error("minAmount"))).toBe(false);
    });

    test("returns false for non-error values", () => {
        expect(isLnurlAmountError("minAmount")).toBe(false);
        expect(isLnurlAmountError(null)).toBe(false);
        expect(isLnurlAmountError(undefined)).toBe(false);
        expect(isLnurlAmountError({})).toBe(false);
    });
});

describe("BridgeCapacityError", () => {
    test("exposes name, message, amounts and cause", () => {
        const cause = new Error("execution reverted");
        const err = new BridgeCapacityError(50n, 100n, { cause });
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(BridgeCapacityError);
        expect(err.name).toBe("BridgeCapacityError");
        expect(err.message).toBe(
            "bridge capacity exceeded: requested 100, available 50",
        );
        expect(err.available).toBe(50n);
        expect(err.requested).toBe(100n);
        expect(err.cause).toBe(cause);
    });

    test("isBridgeCapacityError only matches instances", () => {
        expect(isBridgeCapacityError(new BridgeCapacityError(1n, 2n))).toBe(
            true,
        );
        expect(
            isBridgeCapacityError(new Error("bridge capacity exceeded")),
        ).toBe(false);
        expect(isBridgeCapacityError(undefined)).toBe(false);
        expect(isBridgeCapacityError({ available: 1n, requested: 2n })).toBe(
            false,
        );
    });

    test("toError returns the same BridgeCapacityError instance", () => {
        const err = new BridgeCapacityError(1n, 2n);
        expect(toError(err)).toBe(err);
    });
});

describe("formatError / toError with LnurlAmountError", () => {
    test("formatError returns the error message", () => {
        expect(
            formatError(new LnurlAmountError(LnurlAmountErrorKind.Min, 5000)),
        ).toBe("minAmount");
    });

    test("toError returns the same LnurlAmountError instance", () => {
        const err = new LnurlAmountError(LnurlAmountErrorKind.Max, 1000);
        expect(toError(err)).toBe(err);
    });
});
