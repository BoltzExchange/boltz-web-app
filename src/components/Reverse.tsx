import { ImArrowDown } from "solid-icons/im";

import { useCreateContext } from "../context/Create";

const Reverse = () => {
    const { assetReceive, assetSend, setAssetSend, setAssetReceive } =
        useCreateContext();
    const setDirection = () => {
        const sendOld = assetSend();
        setAssetSend(assetReceive());
        setAssetReceive(sendOld);
    };

    return (
        <div id="flip-assets" onClick={() => setDirection()}>
            <ImArrowDown size={14} />
        </div>
    );
};

export default Reverse;
