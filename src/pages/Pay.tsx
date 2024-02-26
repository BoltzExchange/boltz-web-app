import { useParams } from "@solidjs/router";

import { useGlobalContext } from "../context/Global";

const Pay = () => {
    const params = useParams();
    const { backend } = useGlobalContext();
    const Component = backend()?.SwapStatusPage;
    return Component({ id: params.id });
};

export default Pay;
