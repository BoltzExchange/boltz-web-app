import arrowSvg from "../assets/arrow.svg";
import { useCreateContext } from "../context/Create";

const Reverse = () => {
    const { assetSend, assetReceive, setAssetSend, setAssetReceive } =
        useCreateContext();

    const setDirection = () => {
        const sendOld = assetSend();
        setAssetSend(assetReceive());
        setAssetReceive(sendOld);
    };

    return (
        <div data-testid="flip" id="flip-assets" onClick={() => setDirection()}>
            <img src={arrowSvg} alt="flip assets" />
        </div>
    );
};

export default Reverse;
