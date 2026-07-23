import { type JSX, Match, Switch } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { formatError } from "../utils/errors";
import type { SignerNetworkCheck } from "../utils/signerNetwork";
import LoadingSpinner from "./LoadingSpinner";

// Renders a loader while the network of a signer is being checked and an
// error with a retry action when the check failed; the wrong-network case is
// left to the children, which know how to switch or reconnect
const SignerNetworkGuard = (props: {
    network: SignerNetworkCheck;
    children: JSX.Element;
}) => {
    const { t } = useGlobalContext();

    const checking = () =>
        props.network.signer() !== undefined &&
        props.network.valid() === undefined;

    return (
        <Switch fallback={props.children}>
            <Match when={checking() && props.network.chainId.loading}>
                <LoadingSpinner />
            </Match>
            <Match
                when={checking() && props.network.chainId.state === "errored"}>
                <h2>{t("error")}</h2>
                <h3>{formatError(props.network.chainId.error)}</h3>
                <button
                    class="btn"
                    onClick={() => void props.network.refetch()}>
                    {t("retry")}
                </button>
            </Match>
        </Switch>
    );
};

export default SignerNetworkGuard;
