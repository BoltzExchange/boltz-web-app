import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const NotFound = () => {
    const [t] = useI18n();

    const navigate = useNavigate();

    return (
        <div id="notfound" class="inner-wrap">
            <h1>
                {t("not_found")}
                <small>{t("not_found_subline")}</small>
            </h1>
            <span class="btn btn-inline" onclick={() => navigate("/swap")}>
                {t("back_to_home")}
            </span>
        </div>
    );
};

export default NotFound;
