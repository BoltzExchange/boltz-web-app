import { ImArrowDown } from "solid-icons/im";

import { useCreateContext } from "../context/Create";

const Reverse = () => {
    const {
        assetReceive,
        assetSend,
        setAssetSend,
        setAssetReceive,
        setOnchainAddress,
        setInvoice,
    } = useCreateContext();
    const setDirection = () => {
        setOnchainAddress("");
        setInvoice("");
        const sendOld = assetSend();
        setAssetSend(assetReceive());
        setAssetReceive(sendOld);
    };

    return (
        <button id="flip-assets" onClick={() => setDirection()}>
            <ImArrowDown size={14} />
        </button>
    );
};

export default Reverse;
