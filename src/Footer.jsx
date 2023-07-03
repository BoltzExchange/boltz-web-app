import { useI18n } from "@solid-primitives/i18n";

import substack from "./assets/substack.svg";
import twitter from "./assets/twitter.svg";
import nostr from "./assets/nostr.svg";
import discord from "./assets/discord.svg";

import "./css/footer.css";

const Footer = () => {
    const [t] = useI18n();
    return (
        <footer>
            <h4>
                {t("feedback")}{" "}
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href="https://discord.gg/QBvZGcW">
                    Discord
                </a>
            </h4>
            <h2 class="special">{t("socialmedia")}</h2>
            <div class="socials">
                <a
                    title="Substack"
                    class="stubstack"
                    target="_blank"
                    href="https://blog.boltz.exchange/">
                    <img src={substack} alt="Substack Logo" />
                </a>
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href="https://discord.gg/QBvZGcW">
                    <img src={discord} alt="Discord Logo" />
                </a>
                <a
                    title="Twitter"
                    class="twitter"
                    target="_blank"
                    href="https://twitter.com/boltzhq">
                    <img src={twitter} alt="Twitter Logo" />
                </a>
                <a
                    title="Nostr"
                    class="nostr"
                    target="_blank"
                    href="https://snort.social/p/npub1psm37hke2pmxzdzraqe3cjmqs28dv77da74pdx8mtn5a0vegtlas9q8970">
                    <img src={nostr} alt="Nostr Logo" />
                </a>
            </div>
            <p>{t("footer")}</p>
        </footer>
    );
};
export default Footer;
