import {
    BsDiscord,
    BsEnvelopeFill,
    BsGithub,
    BsTelegram,
    BsTwitter,
    BsYoutube,
} from "solid-icons/bs";

import nostr from "../assets/nostr.svg";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";
import "../style/footer.scss";

const Footer = () => {
    const { t } = useGlobalContext();

    return (
        <footer>
            <div class="socials">
                <a
                    title="Github"
                    class="github"
                    target="_blank"
                    href={config.githubUrl}>
                    <BsGithub size={22} color="#22374F" />
                </a>
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href={config.discordUrl}>
                    <BsDiscord size={22} color="#22374F" />
                </a>
                <a
                    title="Telegram"
                    class="telegram"
                    target="_blank"
                    href={config.telegramUrl}>
                    <BsTelegram size={22} color="#22374F" />
                </a>
                <a
                    title="Twitter"
                    class="twitter"
                    target="_blank"
                    href={config.twitterUrl}>
                    <BsTwitter size={22} color="#22374F" />
                </a>
                <a
                    title="Nostr"
                    class="nostr"
                    target="_blank"
                    href={config.nostrUrl}>
                    <img src={nostr} alt="Nostr Logo" />
                </a>
                <a
                    title="Youtube"
                    class="youtube"
                    target="_blank"
                    href={config.youtubeUrl}>
                    <BsYoutube size={22} color="#22374F" />
                </a>
                <a
                    title={t("email")}
                    class="email"
                    target="_blank"
                    href={"mailto:" + config.email}>
                    <BsEnvelopeFill size={22} color="#22374F" />
                </a>
            </div>
            <p class="footer-nav">
                <a target="_blank" href={config.blogUrl}>
                    {t("blog")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={config.brandingUrl}>
                    {t("branding")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={config.statusUrl}>
                    {t("status")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={config.testnetUrl}>
                    {t("testnet")}
                </a>
            </p>
            <p class="legal-nav">
                <a href="/terms">{t("terms")}</a>
                <a href="/privacy">{t("privacy")}</a>
            </p>
            <p class="version">
                {t("version")}:{" "}
                <a
                    target="_blank"
                    href={`${config.repoUrl}/releases/tag/v${__APP_VERSION__}`}>
                    {__APP_VERSION__}
                </a>
                , {t("commithash")}:{" "}
                <a
                    target="_blank"
                    href={`${config.repoUrl}/commit/${__GIT_COMMIT__}`}>
                    {__GIT_COMMIT__}
                </a>
            </p>
            <p>{t("footer")}</p>
        </footer>
    );
};
export default Footer;
