import betterstack from "../assets/betterstack.svg";
import discord from "../assets/discord.svg";
import github from "../assets/github.svg";
import nostr from "../assets/nostr.svg";
import substack from "../assets/substack.svg";
import twitter from "../assets/twitter.svg";
import {
    blogUrl,
    discordUrl,
    githubUrl,
    nostrUrl,
    repoUrl,
    statusUrl,
    twitterUrl,
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
            <h2 class="special">{t("socialmedia")}</h2>
            <div class="socials">
                <a
                    title="Github"
                    class="github"
                    target="_blank"
                    href={githubUrl}>
                    <img src={github} alt="Github Logo" />
                </a>
                <a
                    title="Substack"
                    class="substack"
                    target="_blank"
                    href={blogUrl}>
                    <img src={substack} alt="Substack Logo" />
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
                    title="Boltz API Status"
                    class="betterstack"
                    target="_blank"
                    href={statusUrl}>
                    <img src={betterstack} alt="Better Stack Logo" />
                </a>
            </div>
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
