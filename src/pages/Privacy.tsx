import type { Component } from "solid-js";

import "../style/legal.scss";

const Privacy: Component = () => {
    return (
        <div class="privacy-container">
            <h1>Privacy Policy</h1>

            <h2>1. Introduction</h2>
            <p>
                This Privacy Policy applies to all services provided by Boltz
                S.A. de C.V., an entity formed under the laws of El Salvador
                (collectively "we," "our," "Boltz," or the "Service") and
                describes how we collect, use, and disclose your information
                when you interact with our services, including through our
                website or any software interfacing with our API. If you
                disagree with any terms herein, you must refrain from using our
                Service.
            </p>

            <h2>2. Information We Collect</h2>
            <p>
                Below is a detailed overview of information collected during
                your use of our services:
            </p>
            <p>
                2.1 Swap Destination: We collect and store data related to
                transaction destinations, such as Bitcoin addresses or Lightning
                invoices.
            </p>
            <p>
                2.2 Swap Origin: We collect and store data related to
                transaction origins, including transaction identifiers or
                Lightning invoices.
            </p>
            <p>
                2.3 IP Address Handling: We do not permanently store your IP
                address but may temporarily process it for taxation compliance
                or geo-restriction enforcement.
            </p>
            <p>
                We do not rent, sell, or share any of the above mentioned data
                with third parties unless legally compelled by a verified law
                enforcement request, judicial order, or fraud investigation.
            </p>

            <h2>3. Information Third Parties May Collect</h2>
            <ul>
                <li>
                    Cloudflare Inc.: We utilize Cloudflare's services to deliver
                    the static assets of our{" "}
                    <a href="https://boltz.exchange">web app</a>. Review
                    Cloudflare's Privacy Policy{" "}
                    <a href="https://www.cloudflare.com/privacypolicy/">here</a>
                    . To avoid using Cloudflare's services, you can{" "}
                    <a href="https://docs.boltz.exchange/web-app">
                        run our web app locally
                    </a>
                    .
                </li>
                <li>
                    Racknation S.A.: We utilize Racknation's services to provide
                    our public API. For their privacy practices{" "}
                    <a href="https://www.racknation.cr/contact-us">
                        contact Racknation directly
                    </a>
                    . You can also access our API via{" "}
                    <a href="http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api/">
                        Tor
                    </a>
                    .
                </li>
            </ul>

            <h2>4. Data Protection Contact</h2>
            <p>
                For questions or concerns regarding this Policy, contact us at:{" "}
                <a href="mailto:legal@bol.tz">legal@bol.tz</a>.
            </p>

            <p class="last-updated">
                <strong>Last updated: June 9, 2025</strong>
            </p>
        </div>
    );
};

export default Privacy;
