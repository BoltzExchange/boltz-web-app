import { useNavigate } from "@solidjs/router";

import satoshiDisappeared from "../assets/satoshi-disappeared.webp";
import { useGlobalContext } from "../context/Global";

const NotFound = () => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();

    return (
        <div id="notfound" class="inner-wrap">
            <h1>
                {t("not_found")}
                <small>{t("not_found_subline")}</small>
            </h1>

            <div class="satoshi-image-container">
                <img
                    src={satoshiDisappeared}
                    alt="Empty pedestal where Satoshi statue once stood in Lugano"
                    class="satoshi-image"
                    loading="lazy"
                />
            </div>

            <span class="btn btn-inline" onClick={() => navigate("/")}>
                {t("back_to_home")}
            </span>
        </div>
    );
};

export default NotFound;
