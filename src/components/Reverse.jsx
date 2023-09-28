import log from "loglevel";
import arrow_svg from "../assets/arrow.svg";
import { reverse, setReverse, asset1, setAsset1, asset2, setAsset2 } from "../signals";

const Reverse = () => {

    const setDirection = () => {
        setReverse(!reverse());
        const asset1_old = asset1();
        setAsset1(asset2());
        setAsset2(asset1_old);
        log.debug('set direction to reverse: ', reverse());
    };

    return (
        <div id="flip-assets" onClick={() => setDirection()}>
            <img src={arrow_svg} alt="flip assets" />
        </div>
    );
};

export default Reverse;
