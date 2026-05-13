import { Show } from "solid-js";

import SettingsCog from "../../components/settings/SettingsCog";
import SettingsMenu from "../../components/settings/SettingsMenu";
import { useGlobalContext } from "../../context/Global";
import "../../style/asset.scss";
import "../../style/rescueExternal.scss";
import ErrorWasm from "../ErrorWasm";
import { MethodSelection } from "./MethodSelection";
import { Results } from "./Results";
import { useExternalRescueSearch } from "./useExternalRescueSearch";

const RescueExternal = () => {
    const { t, wasmSupported } = useGlobalContext();
    const { actions, results, selection, state } = useExternalRescueSearch();

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund" class="rescue-external">
                <div
                    class="frame rescue-external-frame"
                    data-testid="refundFrame">
                    <header>
                        <SettingsCog />
                        <h2 class="frame-title">{t("rescue_external_swap")}</h2>
                    </header>

                    <Show
                        when={!selection.showResultsPage()}
                        fallback={
                            <>
                                <Results state={state} results={results} />
                                <div class="btns rescue-external-actions">
                                    <button
                                        class="btn"
                                        type="button"
                                        onClick={actions.backToMethodSelection}>
                                        {t("back")}
                                    </button>
                                </div>
                            </>
                        }>
                        <MethodSelection
                            actions={actions}
                            selection={selection}
                        />
                    </Show>

                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default RescueExternal;
