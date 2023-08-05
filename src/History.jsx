import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { swaps, setSwaps } from "./signals";
import SwapList from "./components/SwapList";
import "./style/history.scss";

const History = () => {
    let importRef;
    const navigate = useNavigate();
    const [t] = useI18n();

    const deleteLocalStorage = () => {
        if (confirm(t("delete_localstorage"))) {
            setSwaps([]);
        }
    };

    const backupLocalStorage = () => {
        const enc = encodeURI(JSON.stringify(swaps()));
        let hiddenElement = document.createElement("a");
        hiddenElement.href = `data:application/json;charset=utf-8,${enc}`;
        hiddenElement.download = "boltz-backup-localstorage.json";
        hiddenElement.target = "_blank";
        hiddenElement.click();
    };

    const importLocalStorage = (e) => {
        const input = e.currentTarget;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        new Response(inputFile)
            .json()
            .then((result) => {
                // check at least if json has id field
                result.forEach((swap) => {
                    if (Object.keys(swap).indexOf("id") === -1) {
                        log.error("invalid file upload", e);
                        input.setCustomValidity("invalid file upload");
                        return;
                    }
                });
                setSwaps(result);
            })
            .catch((e) => {
                log.error("invalid file upload", e);
                input.setCustomValidity(invalidFileError);
            });
    };

    return (
        <div id="history">
            <div class="frame">
                <h2>{t("refund_past_swaps")}</h2>
                <p>{t("refund_past_swaps_subline")}</p>
                <hr />
                <Show
                    when={swaps().length > 0}
                    fallback={
                        <div>
                            <p>{t("history_no_swaps")}</p>
                            <button
                                class="btn"
                                onClick={() => navigate("/swap")}>
                                {t("new_swap")}
                            </button>
                            <button
                                onClick={() => importRef.click()}
                                class="btn btn-success">
                                {t("refund_import")}
                                <input
                                    ref={importRef}
                                    required
                                    type="file"
                                    style="display: none"
                                    accept="application/json"
                                    onChange={(e) => importLocalStorage(e)}
                                />
                            </button>
                        </div>
                    }>
                    <SwapList
                        swapsSignal={swaps}
                        setSwapSignal={setSwaps}
                        deleteButton={true}
                    />
                    <div class="btns">
                        <Show when={swaps().length > 0}>
                            <button
                                class="btn btn-danger"
                                onClick={deleteLocalStorage}>
                                {t("refund_clear")}
                            </button>
                            <button
                                class="btn btn-success"
                                onClick={backupLocalStorage}>
                                {t("refund_backup")}
                            </button>
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default History;
