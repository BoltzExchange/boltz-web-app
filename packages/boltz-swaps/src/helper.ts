export const defaultTimeoutDuration = 15_000;

const slippageBpsScale = 10_000;
const slippageBpsScaleBigInt = 10_000n;

// `slippage` is a fraction (e.g. 0.01 == 1%). Returns `amount` grown by the
// slippage tolerance, rounded up.
export const calculateAmountWithSlippage = (
    amount: bigint,
    slippage: number,
): bigint => {
    if (!Number.isFinite(slippage)) {
        throw new TypeError(
            `slippage must be a finite number, got ${slippage}`,
        );
    }
    if (slippage < 0 || slippage > 1) {
        throw new RangeError(
            `slippage must be between 0 and 1 (0-100%), got ${slippage}`,
        );
    }

    const slippageBps = BigInt(Math.round(slippage * slippageBpsScale));
    const numerator = amount * (slippageBpsScaleBigInt + slippageBps);

    return (numerator + slippageBpsScaleBigInt - 1n) / slippageBpsScaleBigInt;
};

// Minimum acceptable output for `amountOut` given the slippage tolerance
// (i.e. `amountOut` shrunk by the same amount it would have grown).
export const calculateAmountOutMin = (
    amountOut: bigint,
    slippage: number,
): bigint => {
    const amountWithSlippage = calculateAmountWithSlippage(amountOut, slippage);
    const slippageAmount = amountWithSlippage - amountOut;

    return amountOut - slippageAmount;
};

export const constructRequestOptions = (
    options: RequestInit = {},
    timeout: number = defaultTimeoutDuration,
) => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(
        () => controller.abort({ reason: "Request timed out" }),
        timeout,
    );

    const opts: RequestInit = {
        signal: controller.signal,
        ...options,
    };

    return { opts, requestTimeout };
};
