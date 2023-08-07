import { createSignal, createMemo } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import { nodeStats } from "./signals";
import { fetchNodeInfo } from "./helper";

import "./style/hero.scss";
import liquid from "./assets/liquid-icon.svg";
import bitcoin from "./assets/bitcoin-icon.svg";
import lightning from "./assets/lightning-icon.svg";
import Create from "./Create";

const Hero = () => {
    const [t] = useI18n();

    const navigate = useNavigate();
    const [numChannel, setNumChannel] = createSignal(0);
    const [numPeers, setNumPeers] = createSignal(0);
    const [capacity, setCapacity] = createSignal(0);
    const [oldestChannel, setOldestChannel] = createSignal(0);

    createMemo(() => {
        const stats = nodeStats();
        if (!stats) return;
        setNumChannel(Number(stats.channels).toLocaleString());
        setNumPeers(Number(stats.peers).toLocaleString());
        setCapacity(Number(stats.capacity).toLocaleString());
        const difference = Date.now() - stats.oldestChannel * 1000;
        const years = (difference / 1000 / 60 / 60 / 24 / 365).toFixed(2);
        setOldestChannel(years);
    });

    const openNodeInfo = async () => {
        window.open(
            "https://amboss.space/node/026165850492521f4ac8abd9bd8088123446d126f648ca35e60f88177dc149ceb2",
            "_blank"
        );
    };

    fetchNodeInfo();

    return (
        <div id="hero" class="inner-wrap">
            <div id="create-overlay" onclick={() => navigate("swap")}>
                <Create />
            </div>
            <h1>
                {t("headline")}
                <small>{t("subline")}</small>
            </h1>
            <span class="btn btn-inline" onclick={() => navigate("swap")}>
                {t("start_swapping")}
            </span>
            <div class="hero-boxes">
                <div class="hero-box">
                    <h2>{t("fast")}</h2>
                    <h3>{t("l2")}</h3>
                    <hr />
                    <p>{t("l2_sub")}</p>
                </div>
                <div class="hero-box">
                    <h2>{t("safe")}</h2>
                    <h3>{t("non_custodial")}</h3>
                    <hr />
                    <p>{t("non_custodial_sub")}</p>
                </div>
                <div class="hero-box">
                    <h2>{t("assets")}</h2>
                    <h3>{t("assets_sub")}</h3>
                    <hr />
                    <img src={lightning} alt="Lightning Bitcoin" />
                    <img src={bitcoin} alt="Bitcoin" />
                    <img src={liquid} alt="Liquid Bitcoin" />
                </div>
            </div>
            <div id="numbers">
                <div class="number number-label">
                    <h2 onclick={openNodeInfo} class="special">
                        {t("node")}
                    </h2>
                </div>
                <div class="number">
                    {numChannel()} <small>{t("num_channels")}</small>
                </div>
                <div class="number">
                    {numPeers()} <small>{t("peers")}</small>
                </div>
                <div class="number">
                    {capacity()} <small>{t("capacity")}</small>
                </div>
                <div class="number">
                    {t("oldest_channel_years", { years: oldestChannel() })}
                    <small>{t("oldest_channel")}</small>
                </div>
            </div>

            <div id="integrations">
                <div>
                    <h2 class="special">{t("integrations")}</h2>
                </div>
                <div>
                    <a
                        href="https://corelightning.org/"
                        target="_blank"
                        class="cln"></a>
                </div>
                <div>
                    <a
                        href="https://breez.technology/"
                        target="_blank"
                        class="breez"></a>
                </div>
                <div>
                    <a
                        href="https://electrum.org/"
                        target="_blank"
                        class="electrum"></a>
                </div>
                <div>
                    <a
                        href="https://lnbits.com/"
                        target="_blank"
                        class="lnbits"></a>
                </div>
                <div>
                    <a
                        href="https://www.ridethelightning.info/"
                        target="_blank"
                        class="rtl"></a>
                </div>
                <div>
                    <a
                        href="https://thunderhub.io/"
                        target="_blank"
                        class="thunderhub">
                        Thunderhub
                    </a>
                </div>
                <div>
                    <a
                        href="https://bolt.observer/"
                        target="_blank"
                        class="boltobserver">
                        bolt.observer
                    </a>
                </div>
                <div>
                    <a
                        href="https://fuji.money/"
                        target="_blank"
                        class="fuji"></a>
                </div>
            </div>
            <div id="partners">
                <div>
                    <h2 class="special">{t("partners")}</h2>
                </div>
                <div>
                    <a
                        href="https://blockstream.com/"
                        target="_blank"
                        class="blockstream"></a>
                </div>
                <div>
                    <a
                        href="https://www.diamondhandsnode.com/"
                        target="_blank"
                        class="diamondhands"></a>
                </div>
                <div>
                    <a
                        href="https://vulpem.com/"
                        target="_blank"
                        class="vulpem"></a>
                </div>
            </div>
        </div>
    );
};

export default Hero;
