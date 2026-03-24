import { ImArrowDown } from "solid-icons/im";

import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import Pair from "../utils/Pair";
import { getDecimals } from "../utils/denomination";

const Reverse = () => {
    const { pairs, regularPairs } = useGlobalContext();
    const {
        pair,
        setPair,
        setOnchainAddress,
        setInvoice,
        sendAmount,
        setSendAmount,
        receiveAmount,
        setReceiveAmount,
        amountChanged,
        setAmountChanged,
    } = useCreateContext();

    const setDirection = () => {
        const fromErc20 = getDecimals(pair().fromAsset).isErc20;
        const toErc20 = getDecimals(pair().toAsset).isErc20;

        if (fromErc20 || toErc20) {
            const prevSend = sendAmount();
            const prevReceive = receiveAmount();
            setSendAmount(prevReceive);
            setReceiveAmount(prevSend);
            setAmountChanged(
                amountChanged() === Side.Send ? Side.Receive : Side.Send,
            );
        }

        setOnchainAddress("");
        setInvoice("");
        setPair(
            new Pair(pairs(), pair().toAsset, pair().fromAsset, regularPairs()),
        );
    };

    return (
        <button id="flip-assets" onClick={() => setDirection()}>
            <ImArrowDown size={14} />
        </button>
    );
};

export default Reverse;
