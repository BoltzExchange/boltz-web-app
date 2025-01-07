import { config } from "../config";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";

const Backend = () => {
    const { backendSelect, setBackendSelect } = useCreateContext();
    const { backend, setBackend } = useGlobalContext();

    const openSelect = () => {
        setBackendSelect(!backendSelect());
    };

    // protection from bad persisted value
    if (backend() >= config.backends.length || backend() < 0) {
        setBackend(0);
    }

    return (
        <div class="backend-wrap" onClick={openSelect}>
            <div class="backend-selection">
                <h2>{config.backends[backend()].alias}</h2>
                <span class="arrow-down" />
            </div>
        </div>
    );
};

export default Backend;
