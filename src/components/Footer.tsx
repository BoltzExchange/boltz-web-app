import {
    BsDiscord,
    BsEnvelopeFill,
    BsGithub,
    BsTelegram,
    BsTwitter,
    BsYoutube,
} from "solid-icons/bs";
import { Show } from "solid-js";

import nostr from "../assets/nostr.svg";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";
import "../style/footer.scss";
import ExternalLink from "./ExternalLink";

const Footer = () => {
    const { t } = useGlobalContext();

    return (
        <footer>
            <div class="socials">
                <ExternalLink
                    title="Github"
                    class="github"
                    href={config.githubUrl}>
                    <BsGithub size={22} color="#22374F" />
                </ExternalLink>
                <ExternalLink
                    title="Discord"
                    class="discord"
                    href={config.discordUrl}>
                    <BsDiscord size={22} color="#22374F" />
                </ExternalLink>
                <ExternalLink
                    title="Telegram"
                    class="telegram"
                    href={config.telegramUrl}>
                    <BsTelegram size={22} color="#22374F" />
                </ExternalLink>
                <ExternalLink
                    title="Twitter"
                    class="twitter"
                    href={config.twitterUrl}>
                    <BsTwitter size={22} color="#22374F" />
                </ExternalLink>
                <ExternalLink
                    title="Nostr"
                    class="nostr"
                    href={config.nostrUrl}>
                    <img src={nostr} alt="Nostr Logo" />
                </ExternalLink>
                <ExternalLink
                    title="Youtube"
                    class="youtube"
                    href={config.youtubeUrl}>
                    <BsYoutube size={22} color="#22374F" />
                </ExternalLink>
                <ExternalLink
                    title={t("email")}
                    class="email"
                    href={"mailto:" + config.email}>
                    <BsEnvelopeFill size={22} color="#22374F" />
                </ExternalLink>
            </div>
            <p class="footer-nav">
                <ExternalLink href={config.blogUrl}>{t("blog")}</ExternalLink> |{" "}
                <ExternalLink href={config.brandingUrl}>
                    {t("branding")}
                </ExternalLink>{" "}
                |{" "}
                <ExternalLink href={config.statusUrl}>
                    {t("status")}
                </ExternalLink>{" "}
                |{" "}
                <ExternalLink href={config.regtestUrl}>
                    {t("regtest")}
                </ExternalLink>
                <Show when={config.torUrl}>
                    |{" "}
                    <ExternalLink href={config.torUrl}>
                        {t("onion")}
                    </ExternalLink>
                </Show>
            </p>
            <p class="legal-nav">
                <a href="/terms">{t("terms")}</a>
                <a href="/privacy">{t("privacy")}</a>
            </p>
            <p class="version">
                {t("version")}:{" "}
                <ExternalLink
                    href={`${config.repoUrl}/releases/tag/v${__APP_VERSION__}`}>
                    {__APP_VERSION__}
                </ExternalLink>
                , {t("commithash")}:{" "}
                <ExternalLink
                    href={`${config.repoUrl}/commit/${__GIT_COMMIT__}`}>
                    {__GIT_COMMIT__}
                </ExternalLink>
            </p>
            <p>{t("footer")}</p>
        </footer>
    );
};
export default Footer;
