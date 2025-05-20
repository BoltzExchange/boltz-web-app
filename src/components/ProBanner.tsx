import { OcLinkexternal2 } from "solid-icons/oc";

import { useGlobalContext } from "../context/Global";

const ProBanner = () => {
    const { t } = useGlobalContext();

    return (
        <div class="banner banner-yellow">
            <a
                href="https://docs.boltz.exchange/api/pro"
                target="_blank"
                rel="noopener noreferrer">
                {t("pro_banner").toUpperCase()}
                <OcLinkexternal2 size={18} />
            </a>
        </div>
    );
};

export default ProBanner;
