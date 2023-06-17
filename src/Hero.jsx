import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import "./css/hero.css";
import liquid from "./assets/liquid-icon.svg";
import bitcoin from "./assets/bitcoin-icon.svg";
import lightning from "./assets/lightning-icon.svg";

const Hero = () => {
    const [t] = useI18n();

    const navigate = useNavigate();

    return (
        <div class="inner-wrap">
            <h1>
                Privacy first, account-free crypto exchange
                <small>
                    Trading shouldn't require an account. Your money remains in
                    your control, at all times.
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
        </div>
    );
};

export default Hero;
