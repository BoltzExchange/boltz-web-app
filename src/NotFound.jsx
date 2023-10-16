import t from "./i18n";
import { useNavigate } from "@solidjs/router";

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div id="notfound" class="inner-wrap">
            <h1>
                {t("not_found")}
                <small>{t("not_found_subline")}</small>
            </h1>
            <span class="btn btn-inline" onclick={() => navigate("/")}>
                {t("back_to_home")}
            </span>
        </div>
    );
};

export default NotFound;
