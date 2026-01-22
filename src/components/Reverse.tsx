import { ImArrowDown } from "solid-icons/im";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/pair";

const Reverse = () => {
    const { pairs } = useGlobalContext();
    const { pair, setPair, setOnchainAddress, setInvoice } = useCreateContext();

    const setDirection = () => {
        setOnchainAddress("");
        setInvoice("");
        setPair(new Pair(pairs(), pair().toAsset, pair().fromAsset));
    };

    return (
        <button id="flip-assets" onClick={() => setDirection()}>
            <ImArrowDown size={14} />
        </button>
    );
};

export default Reverse;
