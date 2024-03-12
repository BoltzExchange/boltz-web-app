import discord from "../assets/discord.svg";
import envelope from "../assets/envelope.svg";
import github from "../assets/github.svg";
import nostr from "../assets/nostr.svg";
import twitter from "../assets/twitter.svg";
import youtube from "../assets/youtube.svg";
import {
    blogUrl,
    brandingUrl,
    discordUrl,
    email,
    githubUrl,
    nostrUrl,
    repoUrl,
    statusUrl,
    testnetUrl,
    twitterUrl,
    youtubeUrl,
} from "../config";
import { useGlobalContext } from "../context/Global";
import "../style/footer.scss";

const Footer = () => {
    const { t } = useGlobalContext();

    return (
        <footer>
            <h4>
                {t("feedback")}{" "}
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href={discordUrl}>
                    Discord
                </a>
            </h4>
            <div class="socials">
                <a
                    title="Github"
                    class="github"
                    target="_blank"
                    href={githubUrl}>
                    <img src={github} alt="Github Logo" />
                </a>
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href={discordUrl}>
                    <img src={discord} alt="Discord Logo" />
                </a>
                <a
                    title="Twitter"
                    class="twitter"
                    target="_blank"
                    href={twitterUrl}>
                    <img src={twitter} alt="Twitter Logo" />
                </a>
                <a title="Nostr" class="nostr" target="_blank" href={nostrUrl}>
                    <img src={nostr} alt="Nostr Logo" />
                </a>
                <a
                    title="Youtube"
                    class="youtube"
                    target="_blank"
                    href={youtubeUrl}>
                    <img src={youtube} alt="Youtube Logo" />
                </a>
                <a
                    title={t("email")}
                    class="email"
                    target="_blank"
                    href={"mailto:" + email}>
                    <img src={envelope} alt={t("email")} />
                </a>
            </div>
            <p class="footer-nav">
                <a target="_blank" href={blogUrl}>
                    {t("blog")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={brandingUrl}>
                    {t("branding")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={statusUrl}>
                    {t("status")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={testnetUrl}>
                    {t("testnet")}
                </a>
            </p>
            <p>{t("footer")}</p>
            <p class="version">
                {t("version")}:{" "}
                <a
                    target="_blank"
                    href={`${repoUrl}/releases/tag/v${__APP_VERSION__}`}>
                    {__APP_VERSION__}
                </a>
                , {t("commithash")}:{" "}
                <a target="_blank" href={`${repoUrl}/commit/${__GIT_COMMIT__}`}>
                    {__GIT_COMMIT__}
                </a>
            </p>
        </footer>
    );
};
export default Footer;
