import { useNavigate } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
import log from "loglevel";
import { Show, createEffect, createSignal, onMount } from "solid-js";

import bitcoin from "../assets/bitcoin-icon.svg";
import lightning from "../assets/lightning-icon.svg";
import liquid from "../assets/liquid-icon.svg";
import rbtc from "../assets/rootstock-icon.svg";
import { Denomination } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import Create from "../pages/Create";
import "../style/hero.scss";
import { getNodeStats } from "../utils/boltzClient";
import { formatAmountDenomination } from "../utils/denomination";

export const Hero = () => {
    const navigate = useNavigate();

    const [numChannel, setNumChannel] = createSignal(0);
    const [numPeers, setNumPeers] = createSignal(0);
    const [capacity, setCapacity] = createSignal(0);
    const [oldestChannel, setOldestChannel] = createSignal("0");

    const { hideHero, setHideHero, t, denomination, separator, backend } =
        useGlobalContext();

    const formatStatsAmount = (
        value: number,
        denom: Denomination = Denomination.Sat,
    ) => formatAmountDenomination(new BigNumber(value), denom, separator());

    const fetchNodeStats = async () => {
        try {
            const statsRes = await getNodeStats(backend());
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
    };

    // Reactively fetch node stats whenever backend() changes
    createEffect(() => {
        fetchNodeStats();
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
                                denomination:
                                    denomination() === Denomination.Sat
                                        ? "sats"
                                        : "BTC",
                            })}
                        </small>
                    </div>
                    <div class="number">
                        {t("oldest_channel_years", { years: oldestChannel() })}
                        <small>{t("oldest_channel")}</small>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default Hero;
