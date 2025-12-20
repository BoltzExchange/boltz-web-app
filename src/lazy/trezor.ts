import type {
    Address,
    Response,
    SuccessWithDevice,
    Unsuccessful,
} from "@trezor/connect/lib/types/params";

import Loader from "./Loader";

export default new Loader("Trezor", async () => {
    return (await import("@trezor/connect-web")).default;
});

export { Address, Unsuccessful, Response, SuccessWithDevice };
