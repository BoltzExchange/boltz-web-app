import { Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { downloadJson } from "../utils/download";
import { clipboard } from "../utils/helper";

const ErrorLog = () => {
    const { t, getReports, clearReports, settingsMenu } = useGlobalContext();

    const [count, setCount] = createSignal(0);

    // refresh errors count on settings menu open
    createEffect(async () => {
        if (settingsMenu()) {
            const reports = await getReports();
            setCount(reports.length);
        }
    });

    const clear = async (evt: MouseEvent) => {
        evt.stopPropagation();
        await clearReports();
        setCount(0);
    };

    const copy = async (evt: MouseEvent) => {
        evt.stopPropagation();
        const reports = await getReports();
        clipboard(JSON.stringify(reports));
    };

    const download = async (evt: MouseEvent) => {
        evt.stopPropagation();
        downloadJson(
            `boltz-errors-${Math.floor(Date.now() / 1000)}`,
            await getReports(),
        );
    };

    return (
        <Show when={count() > 0} fallback=<span>{t("no_errors")}</span>>
            <span onClick={clear} class="btn-small btn-danger">
                {t("clear")}
            </span>
            &nbsp;
            <span onClick={download} class="btn-small">
                {t("download")}
            </span>
            &nbsp;
            <span onClick={copy} class="btn-small">
                {t("copy")}
            </span>
            &nbsp;
            <span class="btn-small btn-danger">{count()}</span>
        </Show>
    );
};

export default ErrorLog;
