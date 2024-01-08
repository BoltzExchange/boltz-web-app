import arrowSvg from "../assets/arrow.svg";
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
            <img src={arrowSvg} alt="flip assets" />
        </div>
    );
};

export default Reverse;
