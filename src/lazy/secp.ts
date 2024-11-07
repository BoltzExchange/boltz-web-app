import { init } from "boltz-core/dist/lib/liquid";
import { confidential } from "liquidjs-lib";

import Loader from "./Loader";

export default new Loader("Secp256k1ZKP", async () => {
    const zkp = (await import("@vulpemventures/secp256k1-zkp")).default;
    const secp = await zkp();

    init(secp);
    return {
        secpZkp: secp,
        confidential: new confidential.Confidential(secp),
    };
});
