import type { AccountRole, ReadonlyUint8Array } from "@solana/kit";
import type {
    PublicKey,
    TransactionInstruction,
    TransactionInstructionCtorFields,
} from "@solana/web3.js";

type SolanaInstructionModules = {
    solanaKit: {
        isSignerRole: (role: AccountRole) => boolean;
        isWritableRole: (role: AccountRole) => boolean;
    };
    web3: {
        PublicKey: new (value: string) => PublicKey;
        TransactionInstruction: new (
            opts: TransactionInstructionCtorFields,
        ) => TransactionInstruction;
    };
};

export type SolanaKitInstruction = {
    programAddress: string;
    accounts: ReadonlyArray<{
        address: string;
        role: AccountRole;
    }>;
    data: ReadonlyUint8Array;
};

export const toLegacyInstruction = (
    modules: SolanaInstructionModules,
    instruction: SolanaKitInstruction,
): TransactionInstruction =>
    new modules.web3.TransactionInstruction({
        programId: new modules.web3.PublicKey(instruction.programAddress),
        keys: instruction.accounts.map((account) => ({
            pubkey: new modules.web3.PublicKey(account.address),
            isSigner: modules.solanaKit.isSignerRole(account.role),
            isWritable: modules.solanaKit.isWritableRole(account.role),
        })),
        // @solana/web3.js types `data` as `Buffer`, but its implementation
        // only relies on Uint8Array semantics. Pass a plain Uint8Array so the
        // package does not need a `buffer` polyfill at runtime.
        data: new Uint8Array(instruction.data) as unknown as Buffer,
    });
