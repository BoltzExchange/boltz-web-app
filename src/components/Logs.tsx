import {
    BiRegularCopy,
    BiRegularDownload,
    BiRegularTrash,
} from "solid-icons/bi";
import { Show } from "solid-js/web";

import { useGlobalContext } from "../context/Global";
import { downloadJson } from "../utils/download";
import { clipboard, isIos } from "../utils/helper";

const Logs = () => {
    const { getLogs, clearLogs } = useGlobalContext();

    const clear = async (evt: MouseEvent) => {
        evt.stopPropagation();
        await clearLogs();
    };

    const copy = async (evt: MouseEvent) => {
        evt.stopPropagation();
        const logs = await getLogs();
        clipboard(JSON.stringify(logs));
    };

    const download = async (evt: MouseEvent) => {
        evt.stopPropagation();
        downloadJson("boltz-logs", await getLogs());
    };

    return (
        <div>
            <span onClick={copy} class="btn-small">
                <BiRegularCopy size={14} />
            </span>
            &nbsp;
            <Show when={!isIos()}>
                <span
                    onClick={download}
                    class="btn-small"
                    data-testid="logs-download">
                    <BiRegularDownload size={14} />
                </span>
                &nbsp;
            </Show>
            <span onClick={clear} class="btn-small btn-danger">
                <BiRegularTrash size={14} />
            </span>
        </div>
    );
};

export default Logs;
