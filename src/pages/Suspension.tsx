import { For } from "solid-js";

import ExternalLink from "../components/ExternalLink";
import { useGlobalContext } from "../context/Global";
import "../style/suspension.scss";

const tweetUrl = "https://x.com/Boltzhq/status/2084311537502630319";

const paragraphs = [
    "suspension_p1",
    "suspension_p2",
    "suspension_p3",
    "suspension_p4",
    "suspension_p5",
    "suspension_p6",
    "suspension_p7",
] as const;

export const Suspension = () => {
    const { t } = useGlobalContext();

    return (
        <div id="suspension">
            <span class="status">
                <span class="dot" />
                {t("suspension_status")}
            </span>

            <ExternalLink class="tweet" href={tweetUrl}>
                <div class="tweet-head">
                    <img src="/boltz-icon.svg" alt="" />
                    <div>
                        <div class="tweet-name">
                            Boltz — Non-Custodial Bitcoin Bridge
                        </div>
                        <div class="tweet-handle">@Boltzhq</div>
                    </div>
                </div>

                <For each={paragraphs}>{(key) => <p>{t(key)}</p>}</For>

                <div class="tweet-date">{t("suspension_date")}</div>
            </ExternalLink>
        </div>
    );
};

export default Suspension;
