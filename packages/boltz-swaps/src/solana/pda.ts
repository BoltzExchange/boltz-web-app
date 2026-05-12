import type * as web3 from "@solana/web3.js";

export const derivePda = (
    modules: { web3: typeof web3 },
    programId: string,
    ...seeds: Uint8Array[]
): string =>
    modules.web3.PublicKey.findProgramAddressSync(
        seeds,
        new modules.web3.PublicKey(programId),
    )[0].toBase58();
