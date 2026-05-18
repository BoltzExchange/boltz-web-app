import {
    BiRegularCopy,
    BiRegularDownload,
    BiRegularTrash,
} from "solid-icons/bi";
import { IoCheckmark, IoShareSocialOutline } from "solid-icons/io";
import { Show, createSignal } from "solid-js";

import { copyIconTimeout } from "../../consts/CopyContent";
import { useGlobalContext } from "../../context/Global";
import { isChatwootConfigured, postLogsToChatwoot } from "../../utils/chatwoot";
import { downloadJson } from "../../utils/download";
import { clipboard } from "../../utils/helper";
import LoadingSpinner from "../LoadingSpinner";

const Logs = () => {
    const iconSize = 16;
    const { getLogs, clearLogs, notify, setSettingsMenu, t } =
        useGlobalContext();

    const [copied, setCopied] = createSignal(false);
    const [posting, setPosting] = createSignal(false);

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

    const postToChatwoot = async (evt: MouseEvent) => {
        evt.stopPropagation();

        if (posting()) {
            return;
        }

        setPosting(true);
        try {
            await postLogsToChatwoot(await getLogs());
            setSettingsMenu(false);
        } catch (error) {
            notify(
                "error",
                error instanceof Error ? error.message : String(error),
            );
        } finally {
            setPosting(false);
        }
    };

    const download = async (evt: MouseEvent) => {
        evt.stopPropagation();
        downloadJson("boltz-logs", await getLogs(), true);
    };

    return (
        <div class="logs-actions">
            <Show
                when={isChatwootConfigured()}
                fallback={
                    <span
                        onClick={copy}
                        class="btn-small"
                        data-testid="logs-copy">
                        <Show
                            when={copied()}
                            fallback={<BiRegularCopy size={iconSize} />}>
                            <IoCheckmark size={iconSize} />
                        </Show>
                    </span>
                }>
                <span
                    onClick={postToChatwoot}
                    class="btn-small logs-share"
                    attr:data-loading={posting() ? "true" : undefined}
                    data-testid="logs-chatwoot">
                    <span class="logs-share-content">
                        <IoShareSocialOutline size={iconSize} />
                        {t("share_with_support")}
                    </span>
                    <Show when={posting()}>
                        <LoadingSpinner class="inner-spinner" />
                    </Show>
                </span>
            </Show>
            <div class="logs-actions-icons">
                <span
                    onClick={download}
                    class="btn-small"
                    data-testid="logs-download">
                    <BiRegularDownload size={iconSize} />
                </span>
                <span onClick={clear} class="btn-small btn-danger">
                    <BiRegularTrash size={iconSize} />
                </span>
            </div>
        </div>
    );
};

export default Logs;
