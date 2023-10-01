import arrowSvg from "../assets/arrow.svg";
import {
    assetSend,
    setAssetSend,
    assetReceive,
    setAssetReceive,
} from "../signals";

const Reverse = () => {
    const setDirection = () => {
        const sendOld = assetSend();
        setAssetSend(assetReceive());
        setAssetReceive(sendOld);
    };

    return (
        <div id="flip-assets" onClick={() => setDirection()}>
            <img src={arrowSvg} alt="flip assets" />
        </div>
    );
};

export default Reverse;
