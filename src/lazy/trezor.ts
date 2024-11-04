import type { Address, Unsuccessful } from "@trezor/connect-web";
import type {
    Response,
    SuccessWithDevice,
} from "@trezor/connect/lib/types/params";

import Loader from "./Loader";

export default new Loader("Trezor", async () => {
    return (await import("@trezor/connect-web")).default;
});

export { Address, Unsuccessful, Response, SuccessWithDevice };
