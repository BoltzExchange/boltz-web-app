import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";

const Zeroconf = () => {
    const { zeroconf, setZeroconf } = useCreateContext();
    const { t } = useGlobalContext();

    const toggleZeroconf = () => {
        setZeroconf(!zeroconf());
    };

    return (
        <div
            title={t("zeroconf")}
            class={zeroconf() ? "toggler toggler-active" : "toggler"}
            onClick={() => toggleZeroconf()}>
            <span class="toggle-circle">0-conf</span>
        </div>
    );
};

export default Zeroconf;
