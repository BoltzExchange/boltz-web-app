import { getBoltzSwapsConfig } from "../config.ts";
import { constructRequestOptions } from "../helper.ts";
import { CctpReceiveMode, CctpTransferMode } from "../types.ts";
import { parseScaledBigInt } from "../util/decimal.ts";

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

const parseScaledDecimal = (value: number | string): bigint => {
    try {
        return parseScaledBigInt(value, cctpFeeScaleDigits);
    } catch {
        throw new Error("invalid minimum CCTP fee");
    }
};

const parseForwardFee = (value: number | string): bigint => {
    try {
        return parseScaledBigInt(value, 0);
    } catch {
        throw new Error("invalid CCTP forward fee");
    }
};

const getCctpFeeApiUrl = (): string => {
    const { cctpApiUrl } = getBoltzSwapsConfig();
    if (cctpApiUrl === undefined || cctpApiUrl === "") {
        throw new Error("missing CCTP fee API URL");
    }

    return cctpApiUrl.endsWith("/") ? cctpApiUrl.slice(0, -1) : cctpApiUrl;
};

export const getCctpFee = async (
    sourceDomainId: number,
    destDomainId: number,
    transferMode: CctpTransferMode,
    receiveMode: CctpReceiveMode = CctpReceiveMode.Forwarded,
    includeRecipientSetup = false,
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
        // alongside the protocol fee. Manual receives omit it because we submit
        // the destination mint ourselves.
        const params = new URLSearchParams();
        if (receiveMode === CctpReceiveMode.Forwarded) {
            params.set("forward", "true");
            if (includeRecipientSetup) {
                params.set("includeRecipientSetup", "true");
            }
        }
        const query = params.size === 0 ? "" : `?${params.toString()}`;
        const response = await fetch(
            `${getCctpFeeApiUrl()}/v2/burn/USDC/fees/${sourceDomainId}/${destDomainId}${query}`,
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

        if (receiveMode === CctpReceiveMode.Manual) {
            return {
                bpsUnits: parseScaledDecimal(match.minimumFee),
                forwardFee: 0n,
            };
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
