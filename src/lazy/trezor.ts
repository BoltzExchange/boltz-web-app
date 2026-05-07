import type TrezorConnect from "@trezor/connect-web";
import type {
    Address,
    Response,
    SuccessWithDevice,
    Unsuccessful,
} from "@trezor/connect/lib/types/params";

import Loader from "./Loader";

// `@trezor/connect-web`'s CJS module sets both `exports.default = TrezorConnect`
// and re-exports named members via `__exportStar`, which trips esbuild's
// CJS-to-ESM wrap into emitting `export default require_lib()` — i.e. the whole
// namespace, not the inner default. Unwrap when the inner default is the real
// singleton.
export default new Loader("Trezor", async () => {
    const mod = await import("@trezor/connect-web");
    const candidate = mod.default as
        | typeof TrezorConnect
        | { default: typeof TrezorConnect };
    return "ethereumGetAddress" in candidate ? candidate : candidate.default;
});

export { Address, Unsuccessful, Response, SuccessWithDevice };
