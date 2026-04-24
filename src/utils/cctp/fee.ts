import BigNumber from "bignumber.js";

import { config } from "../../config";
import { CctpTransferMode } from "../../configs/base";
import { getCachedValue } from "../cache";
import { constructRequestOptions } from "../helper";

const requestTimeoutDuration = 6_000;
const cctpFeeScaleDigits = 9;
const cctpFeeScale = 10n ** BigInt(cctpFeeScaleDigits);

// Which tier of Circle's Forwarding Service fee to use. Circle publishes three
// fee tiers (low/med/high); `med` is a reasonable default balance between cost
// and priority.
export type CctpForwardFeeTier = "low" | "med" | "high";
const defaultForwardFeeTier: CctpForwardFeeTier = "med";

type CctpForwardFeeEntry = Record<CctpForwardFeeTier, number | string>;

type CctpFeeEntry = {
    finalityThreshold: number;
    minimumFee: number | string;
    forwardFee?: CctpForwardFeeEntry;
};

export type CctpFee = {
    // Protocol fee in basis points, scaled by `cctpFeeScale`.
    bpsUnits: bigint;
    // Flat forwarding service fee, already in the burn token's smallest units.
    forwardFee: bigint;
};

const cctpFinalityThresholds = {
    [CctpTransferMode.Fast]: 1000,
    [CctpTransferMode.Standard]: 2000,
} as const;

const cctpFeePrefix = "cctpFee:";

const getFeeCacheKey = (
    sourceDomainId: number,
    destDomainId: number,
    transferMode: CctpTransferMode,
) => `${sourceDomainId}:${destDomainId}:${transferMode}`;

const parseScaledDecimal = (value: number | string): bigint => {
    const bn = new BigNumber(value);
    if (!bn.isFinite() || bn.isNegative()) {
        throw new Error("invalid minimum CCTP fee");
    }

    const scaled = bn.shiftedBy(cctpFeeScaleDigits);
    if (!scaled.isInteger()) {
        throw new Error("minimum CCTP fee exceeds supported precision");
    }

    return BigInt(scaled.toFixed(0));
};

const parseForwardFee = (value: number | string): bigint => {
    const bn = new BigNumber(value);
    if (!bn.isFinite() || bn.isNegative() || !bn.isInteger()) {
        throw new Error("invalid CCTP forward fee");
    }
    return BigInt(bn.toFixed(0));
};

const getCctpFeeApiUrl = (): string => {
    const { cctpApiUrl } = config;
    if (cctpApiUrl === undefined || cctpApiUrl === "") {
        throw new Error("missing CCTP fee API URL");
    }

    return cctpApiUrl.endsWith("/") ? cctpApiUrl.slice(0, -1) : cctpApiUrl;
};

const fetchCctpFeeUncached = async (
    sourceDomainId: number,
    destDomainId: number,
    transferMode: CctpTransferMode,
): Promise<CctpFee> => {
    const { opts, requestTimeout } = constructRequestOptions(
        {
            headers: {
                Accept: "application/json",
            },
        },
        requestTimeoutDuration,
    );

    try {
        // `forward=true` makes Circle return the Forwarding Service fee tiers
        // alongside the protocol fee. Without it `forwardFee` is omitted.
        const response = await fetch(
            `${getCctpFeeApiUrl()}/v2/burn/USDC/fees/${sourceDomainId}/${destDomainId}?forward=true`,
            opts,
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const entries = (await response.json()) as CctpFeeEntry[];
        if (!Array.isArray(entries)) {
            throw new Error("invalid CCTP fee response");
        }

        const finalityThreshold = cctpFinalityThresholds[transferMode];
        const match = entries.find(
            (entry) => entry.finalityThreshold === finalityThreshold,
        );

        if (match === undefined) {
            throw new Error(
                `missing CCTP fee for finality threshold ${finalityThreshold}`,
            );
        }

        if (
            typeof match.minimumFee !== "number" &&
            typeof match.minimumFee !== "string"
        ) {
            throw new Error("invalid minimum CCTP fee");
        }

        if (match.forwardFee === undefined) {
            throw new Error(
                `missing CCTP forward fee for finality threshold ${finalityThreshold}`,
            );
        }

        return {
            bpsUnits: parseScaledDecimal(match.minimumFee),
            forwardFee: parseForwardFee(
                match.forwardFee[defaultForwardFeeTier],
            ),
        };
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const cctpFeeBpsDenominator = 10_000n * cctpFeeScale;

export const getCctpFee = async (
    sourceDomainId: number,
    destDomainId: number,
    transferMode: CctpTransferMode,
): Promise<CctpFee> =>
    await getCachedValue(
        cctpFeePrefix,
        getFeeCacheKey(sourceDomainId, destDomainId, transferMode),
        () => fetchCctpFeeUncached(sourceDomainId, destDomainId, transferMode),
    );
