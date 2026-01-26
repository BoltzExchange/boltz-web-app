import {
    BiRegularCopy,
    BiRegularDownload,
    BiRegularTrash,
} from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import { Show, createSignal } from "solid-js";

import { copyIconTimeout } from "../../consts/CopyContent";
import { useGlobalContext } from "../../context/Global";
import { downloadJson } from "../../utils/download";
import { clipboard } from "../../utils/helper";

const Logs = () => {
    const iconSize = 16;
    const { getLogs, clearLogs, t } = useGlobalContext();

    const [copied, setCopied] = createSignal(false);

    const clear = async (evt: MouseEvent) => {
        if (confirm(t("delete_logs"))) {
            evt.stopPropagation();
            await clearLogs();
        }
    };

    const copy = async (evt: MouseEvent) => {
        evt.stopPropagation();
        const logs = await getLogs();
        clipboard(JSON.stringify(logs, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), copyIconTimeout);
    };

    const download = async (evt: MouseEvent) => {
        evt.stopPropagation();
        downloadJson("boltz-logs", await getLogs(), true);
    };

    return (
        <div class="flex">
            <span onClick={copy} class="btn-small">
                <Show
                    when={copied()}
                    fallback={<BiRegularCopy size={iconSize} />}>
                    <IoCheckmark size={iconSize} />
                </Show>
            </span>
            &nbsp;
            <span
                onClick={download}
                class="btn-small"
                data-testid="logs-download">
                <BiRegularDownload size={iconSize} />
            </span>
            &nbsp;
            <span onClick={clear} class="btn-small btn-danger">
                <BiRegularTrash size={iconSize} />
            </span>
        </div>
    );
};

export default Logs;
