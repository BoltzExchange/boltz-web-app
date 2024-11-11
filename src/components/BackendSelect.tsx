import { BigNumber } from "bignumber.js";
import { IoClose } from "solid-icons/io";

import { config } from "../config";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { formatAmount } from "../utils/denomination";
import { getPair } from "../utils/helper";

const BackendSelect = () => {
    const { backend, setBackend, allPairs, t, denomination, separator } =
        useGlobalContext();
    const {
        backendSelect,
        setBackendSelect,
        swapType,
        assetSend,
        assetReceive,
    } = useCreateContext();

    // Handle backend change
    const changeBackend = (index: number) => {
        const pairs = allPairs()[index]; // Get pairs for the current backend
        const cfg = pairs
            ? getPair(
                    pairs,
                    swapType(),
                    assetSend(),
                    assetReceive(),
                )
            : null;
        if (cfg) {
            // only switch the backend if the pair is tradeable
            setBackend(index); 
        }
        setBackendSelect(false);
    };

    return (
        <div
            class="frame assets-select"
            onClick={() => setBackendSelect(false)}
            style={backendSelect() ? "display: block;" : "display: none;"}>
            <span class="close" onClick={() => setBackendSelect(false)}>
                <IoClose />
            </span>
            <h2>{t("select_backend")}</h2>
            <table class="backend-table">
                <thead>
                    <tr>
                        <th>{t("status")}</th>
                        <th>{t("alias")}</th>
                        <th>{t("fee_short")}</th>
                        <th>
                            {t("max")} {t("swap")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {/* eslint-disable-next-line solid/prefer-for */}
                    {config.backends.map((b, index) => {
                        const pairs = allPairs()[index]; // Get pairs for the current backend
                        const cfg = pairs
                            ? getPair(
                                  pairs,
                                  swapType(),
                                  assetSend(),
                                  assetReceive(),
                              )
                            : null;

                        const status =
                            pairs === undefined
                                ? "🔵"
                                : pairs === null
                                  ? "🔴"
                                  : "🟢";

                        // Conditional class based on whether cfg is defined or not
                        const rowClass =
                            backend() === index
                                ? "selected hoverable" // Add hoverable class if selected
                                : cfg
                                  ? "hoverable" // Add hover effect if cfg exists
                                  : "";

                        return (
                            <tr
                                // Only clickable if pairs is defined
                                onClick={() => pairs && changeBackend(index)}
                                class={rowClass}>
                                <td>{status}</td>
                                <td>{b.alias}</td>
                                <td>{cfg ? cfg.fees.percentage + "%" : "-"}</td>
                                <td>
                                    {cfg
                                        ? formatAmount(
                                              BigNumber(cfg.limits.maximal),
                                              denomination(),
                                              separator(),
                                          )
                                        : "-"}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default BackendSelect;
