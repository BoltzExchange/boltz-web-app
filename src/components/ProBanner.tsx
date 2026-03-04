import { OcLinkexternal2 } from "solid-icons/oc";

import { useGlobalContext } from "../context/Global";
import ExternalLink from "./ExternalLink";

const ProBanner = () => {
    const { t } = useGlobalContext();

    return (
        <div class="banner banner-yellow">
            <ExternalLink href="https://client.docs.boltz.exchange/boltz-pro">
                {t("pro_banner").toUpperCase()}
                <OcLinkexternal2 size={18} />
            </ExternalLink>
        </div>
    );
};

export default ProBanner;
