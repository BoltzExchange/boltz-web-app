import type { Accessor } from "solid-js";
import { Show } from "solid-js";

import { config } from "../config";
import { arbitrumNetwork } from "../configs/base";
import { ETH } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { getNetworkName } from "../utils/blockchain";

const RefundEta = (props: {
    timeoutEta: Accessor<number>;
    timeoutBlockHeight: Accessor<number>;
    asset: string;
}) => {
    const { t } = useGlobalContext();
    const getDateString = (timestamp: number) =>
        new Date(timestamp * 1000).toLocaleString();
    return (
        <div data-testid="refund-eta">
            <h3>{t("refund_explainer")}</h3>
            <p class="frame-text">
                {t("pay_timeout_blockheight", {
                    network: getNetworkName(
                        config.assets?.[props.asset]?.network?.chainId ===
                            arbitrumNetwork.chainId
                            ? ETH
                            : props.asset,
                    ),
                })}
                : {props.timeoutBlockHeight()}
                <Show when={props.timeoutEta()}>
                    <br />
                    {t("timeout_eta")}: {getDateString(props.timeoutEta())}
                </Show>
            </p>
        </div>
    );
};

export default RefundEta;
