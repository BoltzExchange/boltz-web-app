import BigNumber from "bignumber.js";
import { batch } from "solid-js";
import type { Accessor, Setter } from "solid-js";

import { Side } from "../consts/Enums";
import type { notifyFn, tFn } from "../context/Global";
import Pair from "./Pair";
import type { Pairs } from "./boltzClient";
import { getPairs } from "./boltzClient";
import { formatError } from "./errors";

export const handleCreateSwapError = async (
    err: unknown,
    notify: notifyFn,
    t: tFn,
    pair: Accessor<Pair>,
    regularPairs: Accessor<Pairs | undefined>,
    setPairs: Setter<Pairs | undefined>,
    setSendAmount: Setter<BigNumber>,
    setAmountChanged: Setter<Side>,
): Promise<boolean> => {
    const msg = formatError(err) ?? "";

    if (msg.includes("invalid pair hash")) {
        setPairs(await getPairs());
        notify("error", t("feecheck"));
        return true;
    }

    const tooLow = msg.includes("is less than minimal of");
    const tooHigh = msg.includes("exceeds maximal of");
    if (tooLow || tooHigh) {
        const fresh = await getPairs();
        const current = pair();
        const refreshed = new Pair(
            fresh,
            current.fromAsset,
            current.toAsset,
            regularPairs(),
        );
        const newAmount = tooLow
            ? await refreshed.getMinimum()
            : await refreshed.getMaximum();

        batch(() => {
            setPairs(fresh);
            setAmountChanged(Side.Send);
            setSendAmount(BigNumber(newAmount));
        });
        notify("error", t("amount_limits_changed"));
        return true;
    }

    return false;
};
