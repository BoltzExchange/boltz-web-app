import { createSignal, createMemo } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import { nodeStats } from "./signals";
import { fetchNodeInfo } from "./helper";

import "./css/hero.css";
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

    fetchNodeInfo();

    return (
        <div id="hero" class="inner-wrap">
            <div id="create-overlay" onclick={() => navigate("swap")}>
                <Create />
            </div>
            <h1>
                Privacy first, account-free bitcoin exchange and lightning
                service provider
                <small>
                    Your money remains in your control, at all times. We don't
                    collect any data.
                </small>
            </h1>
            <span class="btn btn-inline" onclick={() => navigate("swap")}>
                Start Swapping
            </span>
            <div class="hero-boxes">
                <div class="hero-box">
                    <h2>We're fast</h2>
                    <h3>Built on Lightning</h3>
                    <hr />
                    <p>
                        Boltz focuses on the adoption of second layer scaling
                        technology
                    </p>
                </div>
                <div class="hero-box">
                    <h2>We're safe</h2>
                    <h3>We don't collect any data</h3>
                    <hr />
                    <p>
                        Boltz does not and will never collect any data that
                        could identify our users
                    </p>
                </div>
                <div class="hero-box">
                    <h2>Assets</h2>
                    <h3>Lightning / Bitcoin / Liquid</h3>
                    <hr />
                    <img src={lightning} alt="Lightning Bitcoin" />
                    <img src={bitcoin} alt="Bitcoin" />
                    <img src={liquid} alt="Liquid Bitcoin" />
                </div>
            </div>
            <div id="numbers">
                <div class="number">
                    {numChannel()} <small>Number of Channels</small>
                </div>
                <div class="number">
                    {numPeers()} <small>Number of Peers</small>
                </div>
                <div class="number">
                    {capacity()} <small>Capacity (sats)</small>
                </div>
                <div class="number">
                    {oldestChannel()} yrs<small>Oldest Channel</small>
                </div>
            </div>

            <div id="integrations">
                <div>
                    <h2 class="special">Integrations</h2>
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
                        href="https://github.com/Ride-The-Lightning/RTL"
                        target="_blank"
                        class="rtl"></a>
                </div>
                <div>
                    <a
                        href="https://thunderhub.io/"
                        target="_blank"
                        class="pornhub">
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
                    <h2 class="special">Partners</h2>
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
