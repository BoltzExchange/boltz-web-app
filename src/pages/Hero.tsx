import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createEffect, createSignal } from "solid-js";

import bitcoin from "../assets/bitcoin-icon.svg";
import lightning from "../assets/lightning-icon.svg";
import liquid from "../assets/liquid-icon.svg";
import { config } from "../config";
import { BTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import Create from "../pages/Create";
import "../style/hero.scss";
import { getNodeStats, getNodes } from "../utils/boltzApi";

export const Hero = () => {
    const navigate = useNavigate();

    const [nodePubkey, setNodePubkey] = createSignal<string | null>(null);
    const [numChannel, setNumChannel] = createSignal("0");
    const [numPeers, setNumPeers] = createSignal("0");
    const [capacity, setCapacity] = createSignal("0");
    const [oldestChannel, setOldestChannel] = createSignal("0");

    const { hideHero, setHideHero, t } = useGlobalContext();

    const openNodeInfo = async () => {
        window.open(
            `${config().lightningExplorerUrl}/${nodePubkey()}`,
            "_blank",
        );
    };

    createEffect(async () => {
        if (config().apiUrl) {
            try {
                const [nodesRes, statsRes] = await Promise.all([
                    getNodes(BTC),
                    getNodeStats(BTC),
                ]);
                log.debug("node", nodesRes);
                setNodePubkey(nodesRes.BTC.LND.publicKey);

                log.debug("node stats", statsRes);
                const stats = statsRes.BTC.total;

                setNumChannel(Number(stats.channels).toLocaleString());
                setNumPeers(Number(stats.peers).toLocaleString());
                setCapacity(Number(stats.capacity).toLocaleString());

                const difference = Date.now() - stats.oldestChannel * 1000;
                const years = (difference / 1000 / 60 / 60 / 24 / 365).toFixed(
                    2,
                );
                setOldestChannel(years);
            } catch (error) {
                log.error("nodestats error", error);
            }
        }
    });

    return (
        <div id="hero" class="inner-wrap">
            <div
                id="create-overlay"
                class={hideHero() ? "" : "glow"}
                onclick={() => setHideHero(true)}>
                <Create />
            </div>
            <Show when={!hideHero()}>
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
                <h2 class="headline pointer" onclick={openNodeInfo}>
                    {t("node")}
                </h2>
                <div id="numbers">
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

                <h2 class="headline">{t("integrations")}</h2>
                <div id="integrations">
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
                    <div>
                        <a
                            href="https://aquawallet.io/"
                            target="_blank"
                            class="aqua"></a>
                    </div>
                    <div>
                        <a
                            href="https://vulpem.com/marina.html"
                            target="_blank"
                            class="marina"></a>
                    </div>
                </div>
                <h2 class="special headline">{t("partners")}</h2>
                <div id="partners">
                    <div>
                        <a
                            href="https://blockstream.com/"
                            target="_blank"
                            class="blockstream"></a>
                    </div>
                    <div>
                        <a
                            href="https://www.diamondhands.community/"
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
            </Show>
        </div>
    );
};

export default Hero;
