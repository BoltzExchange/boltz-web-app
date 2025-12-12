import { useNavigate } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
import log from "loglevel";
import { Show, createSignal, onMount } from "solid-js";

import bitcoin from "../assets/bitcoin-icon.svg";
import lightning from "../assets/lightning-icon.svg";
import liquid from "../assets/liquid-icon.svg";
import rbtc from "../assets/rootstock-icon.svg";
import ExternalLink from "../components/ExternalLink";
import { config } from "../config";
import { BTC } from "../consts/Assets";
import { Denomination } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import Create from "../pages/Create";
import "../style/hero.scss";
import { getNodeStats } from "../utils/boltzClient";
import {
    formatAmountDenomination,
    formatDenomination,
} from "../utils/denomination";
import FeeComparison from "./FeeComparison";

export const Hero = () => {
    const navigate = useNavigate();

    const [numChannel, setNumChannel] = createSignal(0);
    const [numPeers, setNumPeers] = createSignal(0);
    const [capacity, setCapacity] = createSignal(0);
    const [oldestChannel, setOldestChannel] = createSignal("0");

    const { hideHero, setHideHero, t, denomination, separator } =
        useGlobalContext();

    const formatStatsAmount = (
        value: number,
        denom: Denomination = Denomination.Sat,
    ) => formatAmountDenomination(new BigNumber(value), denom, separator());

    onMount(async () => {
        try {
            const statsRes = await getNodeStats();

            log.debug("node stats", statsRes);
            const stats = statsRes.BTC.total;

            setNumChannel(stats.channels);
            setNumPeers(stats.peers);
            setCapacity(stats.capacity);

            const difference = Date.now() - stats.oldestChannel * 1000;
            const years = (difference / 1000 / 60 / 60 / 24 / 365).toFixed(2);
            setOldestChannel(years);
        } catch (error) {
            log.error("nodestats error", error);
        }
    });

    return (
        <div id="hero" class="inner-wrap">
            <div
                id="create-overlay"
                class={hideHero() ? "" : "glow"}
                onClick={() => setHideHero(true)}>
                {config.isPro ? <FeeComparison /> : <Create />}
            </div>
            <Show when={!hideHero()}>
                <h1>
                    {config.isPro ? t("headline_pro") : t("headline")}
                    <small>
                        {config.isPro ? t("subline_pro") : t("subline")}
                    </small>
                </h1>
                <span class="btn btn-inline" onClick={() => navigate("swap")}>
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
                        <img src={rbtc} alt="Rootstock Bitcoin" />
                    </div>
                </div>
                <h2 class="headline">{t("node")}</h2>
                <div id="numbers">
                    <div class="number">
                        {formatStatsAmount(numChannel())}{" "}
                        <small>{t("num_channels")}</small>
                    </div>
                    <div class="number">
                        {formatStatsAmount(numPeers())}{" "}
                        <small>{t("peers")}</small>
                    </div>
                    <div class="number">
                        {formatStatsAmount(capacity(), denomination())}{" "}
                        <small>
                            {t("capacity", {
                                denomination: formatDenomination(
                                    denomination(),
                                    BTC,
                                ),
                            })}
                        </small>
                    </div>
                    <div class="number">
                        {t("oldest_channel_years", { years: oldestChannel() })}
                        <small>{t("oldest_channel")}</small>
                    </div>
                </div>
                <h2 class="headline">{t("integrations")}</h2>
                <div id="integrations">
                    <div>
                        <ExternalLink
                            href="https://getalby.com/"
                            class="alby"
                        />
                    </div>
                    <div>
                        <ExternalLink href="https://aqua.net" class="aqua" />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://bancolibre.com/"
                            class="bancoLibre"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://blockstream.com/app/"
                            class="blockstreamApp">
                            Blockstream
                            <br />
                            <span>App</span>
                        </ExternalLink>
                    </div>
                    <div>
                        <ExternalLink
                            href="https://breez.technology/"
                            class="breez"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://www.bullbitcoin.com/"
                            class="bull-bitcoin"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://www.cakepay.com/"
                            class="cakepay"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://www.fedi.xyz/"
                            class="fedi"
                        />
                    </div>
                    <div>
                        <ExternalLink href="https://fuji.money/" class="fuji" />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://geyser.fund/"
                            class="geyser"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://helm-wallet.com/"
                            class="helm"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://lnbits.com/"
                            class="lnbits"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://www.ridethelightning.info/"
                            class="rtl"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://www.tryspeed.com/"
                            class="speed"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://stashpay.me"
                            class="stashPay"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://thunderhub.io/"
                            class="thunderhub">
                            Thunderhub
                        </ExternalLink>
                    </div>
                    <div>
                        <ExternalLink
                            href="https://tropykus.com"
                            class="tropykus"
                        />
                    </div>
                </div>
                <h2 class="special headline">{t("partners")}</h2>
                <div id="partners">
                    <div>
                        <ExternalLink
                            href="https://arklabs.xyz"
                            class="arklabs"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://blockstream.com/"
                            class="blockstream"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://www.diamondhands.community/"
                            class="diamondhands"
                        />
                    </div>
                    <div>
                        <ExternalLink
                            href="https://rootstocklabs.com/"
                            class="rootstocklabs"
                        />
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default Hero;
