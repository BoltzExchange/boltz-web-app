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
                Got Feedback? Join our{" "}
                <a
                    title="Discord"
                    class="discord"
                    target="_blank"
                    href="https://discord.gg/sYwnRBJxyD">
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
            <p>
                {t("footer")}
                <br />
                <a
                    target="_blank"
                    href="https://amboss.space/node/026165850492521f4ac8abd9bd8088123446d126f648ca35e60f88177dc149ceb2">
                    {t("view_amboss")}
                </a>
            </p>
        </footer>
    );
};
export default Footer;
