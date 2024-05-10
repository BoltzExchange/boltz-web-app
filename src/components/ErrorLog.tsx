import { BiRegularCopy, BiRegularTrash } from "solid-icons/bi";
import { Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { clipboard } from "../utils/helper";

const ErrorLog = () => {
    const { t, getReports, clearReports, settingsMenu } = useGlobalContext();

    const [count, setCount] = createSignal(0);

    // refresh errors count on settings menu open
    createEffect(async () => {
        if (settingsMenu()) {
            const reports = await getReports();
            setCount(Object.keys(reports).length);
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

    return (
        <Show when={count() > 0} fallback=<span>{t("no_errors")}</span>>
            <span onClick={clear} class="btn-small btn-danger">
                <BiRegularTrash size={14} />
            </span>
            &nbsp;
            <span onClick={copy} class="btn-small">
                <BiRegularCopy size={14} />
            </span>
        </Show>
    );
};

export default ErrorLog;
