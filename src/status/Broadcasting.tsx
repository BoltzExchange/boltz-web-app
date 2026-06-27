import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";

const Broadcasting = () => {
    const { t } = useGlobalContext();

    return (
        <div>
            <h2>{t("broadcasting_claim")}</h2>
            <LoadingSpinner />
        </div>
    );
};

export default Broadcasting;
