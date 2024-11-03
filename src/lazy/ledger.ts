import type Transport from "@ledgerhq/hw-transport";

import Loader from "./Loader";

export default new Loader("Ledger", async () => {
    const [eth, webhid] = await Promise.all([
        import("@ledgerhq/hw-app-eth"),
        import("@ledgerhq/hw-transport-webhid"),
    ]);

    return {
        eth: eth.default,
        webhid: webhid.default,
    };
});

export { Transport };
