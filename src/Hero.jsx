import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import "./css/hero.css";
import liquid from "./assets/liquid-icon.svg";
import bitcoin from "./assets/bitcoin-icon.svg";
import lightning from "./assets/lightning-icon.svg";
import electrum from "./assets/electrum.png";
import breez from "./assets/logo-breez-header.svg";

const Hero = () => {
    const [t] = useI18n();

    const navigate = useNavigate();

    return (
        <div id="hero" class="inner-wrap">
            <h1>
                Privacy first, account-free bitcoin exchange and lightning
                service provider
                <small>
                    Trading shouldn't require an account. Your money remains in
                    your control, at all times.
                </small>
            </h1>
            <span class="btn btn-inline" onclick={() => navigate("swap")}>
                Start Swapping
            </span>
            <span class="btn btn-inline" onclick={() => navigate("swap")}>
                Manage Liquidity
            </span>
            <div class="hero-boxes">
                <div class="hero-box">
                    <h2>We're fast</h2>
                    <h3>Built on Lightning</h3>
                    <hr />
                    <p>
                        Boltz focuses on the adoption of second layer scaling
                        technology like the lightning network.
                    </p>
                </div>
                <div class="hero-box">
                    <h2>We're safe</h2>
                    <h3>We don't collect any data</h3>
                    <hr />
                    <p>
                        Boltz does not and will never collect any data that
                        could identify our users.
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
                    1840 <small>Number of Channels</small>
                </div>
                <div class="number">
                    1338 <small>Number of Peers</small>
                </div>
                <div class="number">
                    650.000.000<small>Capacity (sats)</small>
                </div>
                <div class="number">
                    4 years <small>Oldest Channel</small>
                </div>
            </div>
            <hr />

            <h2 class="special">Integrations</h2>
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
            <hr />
            <h2 class="special">Partners</h2>
            <div id="partners">
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
