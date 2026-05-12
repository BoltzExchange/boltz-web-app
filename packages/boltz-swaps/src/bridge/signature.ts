import type { Signature } from "viem";

export const vFromSignature = (signature: Signature): number =>
    signature.v !== undefined
        ? Number(signature.v)
        : (signature.yParity ?? 0) + 27;
