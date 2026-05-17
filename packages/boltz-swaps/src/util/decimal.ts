const scaledDecimalPattern = /^(0|[1-9]\d*)(?:\.(\d+))?$/;
const scaledNumberPattern = /^(0|[1-9]\d*)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;

const assertValidDecimals = (decimals: number): void => {
    if (!Number.isSafeInteger(decimals) || decimals < 0) {
        throw new Error("invalid decimal scale");
    }
};

export const parseScaledBigInt = (
    value: number | string,
    decimals: number,
): bigint => {
    assertValidDecimals(decimals);

    const pattern =
        typeof value === "number" ? scaledNumberPattern : scaledDecimalPattern;

    if (typeof value === "number") {
        if (
            !Number.isFinite(value) ||
            value < 0 ||
            (Number.isInteger(value) && !Number.isSafeInteger(value))
        ) {
            throw new Error("invalid scaled decimal");
        }
    }

    const match = pattern.exec(String(value));
    if (match === null) {
        throw new Error("invalid scaled decimal");
    }

    const integerPart = match[1];
    const fractionalPart = match[2] ?? "";
    const exponent = Number(match[3] ?? 0);
    if (!Number.isSafeInteger(exponent)) {
        throw new Error("invalid scaled decimal");
    }

    const digits = BigInt(integerPart + fractionalPart);
    const scaleShift = exponent + decimals - fractionalPart.length;

    if (scaleShift >= 0) {
        return digits * 10n ** BigInt(scaleShift);
    }

    const divisor = 10n ** BigInt(-scaleShift);
    if (digits % divisor !== 0n) {
        throw new Error("scaled decimal exceeds supported precision");
    }

    return digits / divisor;
};
