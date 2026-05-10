import type { AccountRole, ReadonlyUint8Array } from "@solana/kit";
import type {
    PublicKey,
    TransactionInstruction,
    TransactionInstructionCtorFields,
} from "@solana/web3.js";
import { Buffer } from "buffer";

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
        data: Buffer.from(instruction.data),
    });
