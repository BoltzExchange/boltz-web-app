import { IoKey, IoWallet } from "solid-icons/io";
import { For, Match, Switch } from "solid-js";

import {
    BTC,
    LBTC,
    LN,
    RBTC,
    TBTC,
    USDC,
    USDT0,
    WBTC,
    getAssetDisplaySymbol,
} from "../../consts/Assets";
import type { tFn } from "../../context/Global";
import { RescueAction } from "../../utils/rescue";
import { RecoveryMethod, type RecoveryOption } from "./types";

export const recoveryOptions: RecoveryOption[] = [
    {
        asset: LN,
        className: "asset-LN",
        actions: [RescueAction.Refund, RescueAction.Claim],
        methods: [RecoveryMethod.Key],
    },
    {
        asset: BTC,
        className: "asset-BTC",
        actions: [RescueAction.Refund, RescueAction.Claim],
        methods: [RecoveryMethod.Key],
    },
    {
        asset: LBTC,
        className: "asset-LBTC",
        actions: [RescueAction.Refund, RescueAction.Claim],
        methods: [RecoveryMethod.Key],
    },
    {
        asset: TBTC,
        className: "asset-TBTC",
        actions: [RescueAction.Refund, RescueAction.Claim],
        methods: [RecoveryMethod.Key, RecoveryMethod.Wallet],
    },
    {
        asset: WBTC,
        className: "asset-WBTC",
        actions: [RescueAction.Refund, RescueAction.Claim],
        methods: [RecoveryMethod.Key],
    },
    {
        asset: USDT0,
        className: "asset-USDT",
        actions: [RescueAction.Refund, RescueAction.Claim],
        methods: [RecoveryMethod.Key],
    },
    {
        asset: USDC,
        className: "asset-USDC",
        actions: [RescueAction.Refund, RescueAction.Claim],
        methods: [RecoveryMethod.Key],
    },
    {
        asset: RBTC,
        className: "asset-RBTC",
        actions: [RescueAction.Refund],
        methods: [RecoveryMethod.Wallet],
    },
    {
        asset: RBTC,
        className: "asset-RBTC",
        actions: [RescueAction.Claim],
        methods: [RecoveryMethod.Key, RecoveryMethod.Wallet],
    },
];

export const missingMethodsTitle = (
    methods: RecoveryMethod[],
    activeMethods: RecoveryMethod[],
    t: tFn,
) => {
    const missing = methods.filter((method) => !activeMethods.includes(method));

    if (missing.length === 0) {
        return undefined;
    }

    if (
        methods.includes(RecoveryMethod.Key) &&
        methods.includes(RecoveryMethod.Wallet)
    ) {
        return t("rescue_external_requires_rescue_key_wallet");
    }

    return methods[0] === RecoveryMethod.Key
        ? t("rescue_external_requires_rescue_key")
        : t("rescue_external_requires_wallet");
};

const RequirementIcon = (props: {
    method: RecoveryMethod;
    active: boolean;
}) => (
    <Switch>
        <Match when={props.method === RecoveryMethod.Key}>
            <IoKey
                class="rescue-external-requirement-icon"
                data-active={props.active ? "true" : "false"}
                aria-label="Rescue key required"
            />
        </Match>
        <Match when={props.method === RecoveryMethod.Wallet}>
            <IoWallet
                class="rescue-external-requirement-icon"
                data-active={props.active ? "true" : "false"}
                aria-label="Wallet required"
            />
        </Match>
    </Switch>
);

const AssetIcon = (props: RecoveryOption) => (
    <span class={`asset ${props.className}`}>
        <span class="icon" />
    </span>
);

const assetDisplayLabel = (option: RecoveryOption, t: tFn) => {
    const symbol = getAssetDisplaySymbol(option.asset);
    if (option.asset === RBTC && option.actions.length === 1) {
        const action =
            option.actions[0] === RescueAction.Refund
                ? t("refund")
                : t("rescue_external_resume");
        return `${symbol} (${action})`;
    }
    return symbol;
};

export const RecoveryChip = (
    props: RecoveryOption & {
        active: boolean;
        activeMethods: RecoveryMethod[];
        tooltip?: string;
        t: tFn;
    },
) => (
    <div
        class="rescue-external-chip"
        data-active={props.active ? "true" : "false"}
        data-size={props.asset === RBTC ? "lg" : "sm"}
        data-tooltip={props.tooltip}>
        <AssetIcon {...props} />
        <strong>{assetDisplayLabel(props, props.t)}</strong>
        <span class="rescue-external-chip-requirements">
            <For each={props.methods}>
                {(method) => (
                    <RequirementIcon
                        method={method}
                        active={props.activeMethods.includes(method)}
                    />
                )}
            </For>
        </span>
    </div>
);
