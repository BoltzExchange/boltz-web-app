import { Match, Show, Switch } from "solid-js";

import discord from "../assets/discord.svg";
import github from "../assets/github.svg";
import nostr from "../assets/nostr.svg";
import twitter from "../assets/twitter.svg";
import youtube from "../assets/youtube.svg";
import { config } from "../config";
import { useClientContext } from "../context/Client";
import { useGlobalContext } from "../context/Global";
import "../style/footer.scss";
import { isBoltzClient } from "../utils/helper";

const ClientInfo = () => {
    const { info } = useClientContext();

    return (
        <Switch>
            <Match when={info.isLoading}>
                <div class="client-info">
                    <h3>Client Info</h3>
                    <p>Loading...</p>
                </div>
            </Match>
            <Match when={info.isError}>
                <div class="client-info">
                    <h3>Client Info</h3>
                    <p>Error: {info.error.message}</p>
                </div>
            </Match>
            <Match when={info.data}>
                <div class="client-info">
                    <h3>Client Info</h3>
                    <pre>{info.data.version}</pre>
                </div>
            </Match>
        </Switch>
    );
};

const Footer = () => {
    const { t } = useGlobalContext();

    return (
        <footer>
            <Show when={isBoltzClient()}>
                <ClientInfo />
            </Show>
            <h4>
                {t("feedback")}{" "}
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href={config().discordUrl}>
                    Discord
                </a>
            </h4>
            <div class="socials">
                <a
                    title="Github"
                    class="github"
                    target="_blank"
                    href={config().githubUrl}>
                    <img src={github} alt="Github Logo" />
                </a>
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href={config().discordUrl}>
                    <img src={discord} alt="Discord Logo" />
                </a>
                <a
                    title="Twitter"
                    class="twitter"
                    target="_blank"
                    href={config().twitterUrl}>
                    <img src={twitter} alt="Twitter Logo" />
                </a>
                <a
                    title="Nostr"
                    class="nostr"
                    target="_blank"
                    href={config().nostrUrl}>
                    <img src={nostr} alt="Nostr Logo" />
                </a>
                <a
                    title="Youtube"
                    class="youtube"
                    target="_blank"
                    href={config().youtubeUrl}>
                    <img src={youtube} alt="Youtube Logo" />
                </a>
            </div>
            <p class="footer-nav">
                <a target="_blank" href={config().blogUrl}>
                    {t("blog")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={config().brandingUrl}>
                    {t("branding")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={config().statusUrl}>
                    {t("status")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={config().testnetUrl}>
                    {t("testnet")}
                </a>
            </p>
            <p>{t("footer")}</p>
            <p class="version">
                {t("version")}:{" "}
                <a
                    target="_blank"
                    href={`${config().repoUrl}/releases/tag/v${__APP_VERSION__}`}>
                    {__APP_VERSION__}
                </a>
                , {t("commithash")}:{" "}
                <a
                    target="_blank"
                    href={`${config().repoUrl}/commit/${__GIT_COMMIT__}`}>
                    {__GIT_COMMIT__}
                </a>
            </p>
        </footer>
    );
};
export default Footer;
