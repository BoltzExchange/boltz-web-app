import { useGlobalContext } from "../context/Global";

const Pay = () => {
    const { backend } = useGlobalContext();
    const Component = backend()?.SwapHistory;
    return Component();
};

export default Pay;
