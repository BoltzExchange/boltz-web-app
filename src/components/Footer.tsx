import {
    BsDiscord,
    BsEnvelopeFill,
    BsGithub,
    BsTelegram,
} from "solid-icons/bs";

import nostr from "../assets/nostr.svg";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";
import "../style/footer.scss";

const Footer = () => {
    const { t, backend } = useGlobalContext();

    return (
        <footer>
            <h4>
                {t("contact", {
                    alias: config.backends[backend()].alias,
                })}{" "}
                <a
                    title="Contact"
                    target="_blank"
                    href={config.backends[backend()].contact}>
                    {config.backends[backend()].contact}
                </a>
            </h4>
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
                    title="Nostr"
                    class="nostr"
                    target="_blank"
                    href={config.nostrUrl}>
                    <img src={nostr} alt="Nostr Logo" />
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
                <a target="_blank" href={config.statusUrl}>
                    {t("status")}
                </a>{" "}
                |{" "}
                <a target="_blank" href={config.testnetUrl}>
                    {t("testnet")}
                </a>
            </p>
            <p class="version">
                {t("version")}:{" "}
                <a target="_blank" href={`${config.repoUrl}`}>
                    {__APP_VERSION__}
                </a>
                , {t("commithash")}:{" "}
                <a
                    target="_blank"
                    href={`${config.repoUrl}/attestations`}>
                    {__GIT_COMMIT__}
                </a>
            </p>
        </footer>
    );
};
export default Footer;
