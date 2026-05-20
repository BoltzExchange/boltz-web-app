import { type Usdt0VariantAsset, usdt0Variants } from "boltz-swaps/oft";

export type { Usdt0VariantAsset };

export const usdt0EnvByAsset: Record<Usdt0VariantAsset, string | undefined> = {
    "USDT0-BERA": import.meta.env.VITE_USDT0_BERA_OFT_ETA_SECONDS,
    "USDT0-CFX": import.meta.env.VITE_USDT0_CFX_OFT_ETA_SECONDS,
    "USDT0-ETH": import.meta.env.VITE_USDT0_ETH_OFT_ETA_SECONDS,
    "USDT0-FLR": import.meta.env.VITE_USDT0_FLR_OFT_ETA_SECONDS,
    "USDT0-HBAR": import.meta.env.VITE_USDT0_HBAR_OFT_ETA_SECONDS,
    "USDT0-HYPE": import.meta.env.VITE_USDT0_HYPE_OFT_ETA_SECONDS,
    "USDT0-INK": import.meta.env.VITE_USDT0_INK_OFT_ETA_SECONDS,
    "USDT0-MEGAETH": import.meta.env.VITE_USDT0_MEGAETH_OFT_ETA_SECONDS,
    "USDT0-MNT": import.meta.env.VITE_USDT0_MNT_OFT_ETA_SECONDS,
    "USDT0-MON": import.meta.env.VITE_USDT0_MON_OFT_ETA_SECONDS,
    "USDT0-MORPH": import.meta.env.VITE_USDT0_MORPH_OFT_ETA_SECONDS,
    "USDT0-OP": import.meta.env.VITE_USDT0_OP_OFT_ETA_SECONDS,
    "USDT0-PLASMA": import.meta.env.VITE_USDT0_PLASMA_OFT_ETA_SECONDS,
    "USDT0-POL": import.meta.env.VITE_USDT0_POL_OFT_ETA_SECONDS,
    "USDT0-RBTC": import.meta.env.VITE_USDT0_RBTC_OFT_ETA_SECONDS,
    "USDT0-SEI": import.meta.env.VITE_USDT0_SEI_OFT_ETA_SECONDS,
    "USDT0-SOL": import.meta.env.VITE_USDT0_SOL_OFT_ETA_SECONDS,
    "USDT0-STABLE": import.meta.env.VITE_USDT0_STABLE_OFT_ETA_SECONDS,
    "USDT0-TEMPO": import.meta.env.VITE_USDT0_TEMPO_OFT_ETA_SECONDS,
    "USDT0-TRON": import.meta.env.VITE_USDT0_TRON_OFT_ETA_SECONDS,
    "USDT0-UNI": import.meta.env.VITE_USDT0_UNI_OFT_ETA_SECONDS,
    "USDT0-XLAYER": import.meta.env.VITE_USDT0_XLAYER_OFT_ETA_SECONDS,
};

const usdt0CanSendEnvByAsset: Record<Usdt0VariantAsset, string | undefined> = {
    "USDT0-BERA": import.meta.env.VITE_USDT0_BERA_CAN_SEND,
    "USDT0-CFX": import.meta.env.VITE_USDT0_CFX_CAN_SEND,
    "USDT0-ETH": import.meta.env.VITE_USDT0_ETH_CAN_SEND,
    "USDT0-FLR": import.meta.env.VITE_USDT0_FLR_CAN_SEND,
    "USDT0-HBAR": import.meta.env.VITE_USDT0_HBAR_CAN_SEND,
    "USDT0-HYPE": import.meta.env.VITE_USDT0_HYPE_CAN_SEND,
    "USDT0-INK": import.meta.env.VITE_USDT0_INK_CAN_SEND,
    "USDT0-MEGAETH": import.meta.env.VITE_USDT0_MEGAETH_CAN_SEND,
    "USDT0-MNT": import.meta.env.VITE_USDT0_MNT_CAN_SEND,
    "USDT0-MON": import.meta.env.VITE_USDT0_MON_CAN_SEND,
    "USDT0-MORPH": import.meta.env.VITE_USDT0_MORPH_CAN_SEND,
    "USDT0-OP": import.meta.env.VITE_USDT0_OP_CAN_SEND,
    "USDT0-PLASMA": import.meta.env.VITE_USDT0_PLASMA_CAN_SEND,
    "USDT0-POL": import.meta.env.VITE_USDT0_POL_CAN_SEND,
    "USDT0-RBTC": import.meta.env.VITE_USDT0_RBTC_CAN_SEND,
    "USDT0-SEI": import.meta.env.VITE_USDT0_SEI_CAN_SEND,
    "USDT0-SOL": import.meta.env.VITE_USDT0_SOL_CAN_SEND,
    "USDT0-STABLE": import.meta.env.VITE_USDT0_STABLE_CAN_SEND,
    "USDT0-TEMPO": import.meta.env.VITE_USDT0_TEMPO_CAN_SEND,
    "USDT0-TRON": import.meta.env.VITE_USDT0_TRON_CAN_SEND,
    "USDT0-UNI": import.meta.env.VITE_USDT0_UNI_CAN_SEND,
    "USDT0-XLAYER": import.meta.env.VITE_USDT0_XLAYER_CAN_SEND,
};

export const envCanSend = (
    envValue: string | undefined,
    fallback: boolean,
): boolean => {
    const normalizedEnvValue = envValue?.trim().toLowerCase();

    if (normalizedEnvValue === undefined || normalizedEnvValue === "") {
        return fallback;
    }

    if (normalizedEnvValue === "true") {
        return true;
    }

    if (normalizedEnvValue === "false") {
        return false;
    }

    throw new Error(
        `Invalid USDT0 canSend flag; expected true or false, got "${envValue}"`,
    );
};

export const usdt0CanSendOverrides: Partial<
    Record<Usdt0VariantAsset, boolean>
> = Object.fromEntries(
    usdt0Variants.map((variant) => [
        variant.asset,
        envCanSend(
            usdt0CanSendEnvByAsset[variant.asset as Usdt0VariantAsset],
            variant.canSend,
        ),
    ]),
);
