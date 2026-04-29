// @vitest-environment node
import {
    address,
    createNoopSigner,
    isSignerRole,
    isWritableRole,
} from "@solana/kit";
import { PublicKey } from "@solana/web3.js";

import {
    solanaMessageTransmitterV2,
    solanaTokenMessengerMinterV2,
} from "../../src/configs/cctp";
import {
    getDepositForBurnInstruction,
    parseDepositForBurnInstruction,
} from "../../src/generated/solana-cctp-token-messenger-minter/src/generated";
import { addressToBytes32, cctpZeroBytes32 } from "../../src/utils/cctp/evm";

const signer = (value: string) => createNoopSigner(address(value));
const pubkey = () => PublicKey.unique().toBase58();
const publicKeyFromHex = (value: string) =>
    new PublicKey(
        Uint8Array.from(Buffer.from(value.slice(2), "hex")),
    ).toBase58();

const evmRecipient = "0x1234567890123456789012345678901234567890";
const evmRecipientBytes32 = addressToBytes32(evmRecipient);
const evmRecipientAsSolanaAddress = publicKeyFromHex(evmRecipientBytes32);

describe("Solana CCTP Codama bindings", () => {
    test("construct depositForBurn with expected accounts and params", () => {
        const accounts = {
            owner: pubkey(),
            eventRentPayer: pubkey(),
            senderAuthorityPda: pubkey(),
            burnTokenAccount: pubkey(),
            denylistAccount: pubkey(),
            messageTransmitter: pubkey(),
            tokenMessenger: pubkey(),
            remoteTokenMessenger: pubkey(),
            tokenMinter: pubkey(),
            localToken: pubkey(),
            burnTokenMint: pubkey(),
            messageSentEventData: pubkey(),
            eventAuthority: pubkey(),
        };

        const instruction = getDepositForBurnInstruction({
            owner: signer(accounts.owner),
            eventRentPayer: signer(accounts.eventRentPayer),
            senderAuthorityPda: address(accounts.senderAuthorityPda),
            burnTokenAccount: address(accounts.burnTokenAccount),
            denylistAccount: address(accounts.denylistAccount),
            messageTransmitter: address(accounts.messageTransmitter),
            tokenMessenger: address(accounts.tokenMessenger),
            remoteTokenMessenger: address(accounts.remoteTokenMessenger),
            tokenMinter: address(accounts.tokenMinter),
            localToken: address(accounts.localToken),
            burnTokenMint: address(accounts.burnTokenMint),
            messageSentEventData: signer(accounts.messageSentEventData),
            eventAuthority: address(accounts.eventAuthority),
            program: address(solanaTokenMessengerMinterV2),
            amount: 1_000_000n,
            destinationDomain: 3,
            mintRecipient: address(evmRecipientAsSolanaAddress),
            destinationCaller: address(publicKeyFromHex(cctpZeroBytes32)),
            maxFee: 131n,
            minFinalityThreshold: 1000,
        });

        expect(instruction.programAddress).toBe(solanaTokenMessengerMinterV2);
        expect(instruction.accounts.map((account) => account.address)).toEqual([
            accounts.owner,
            accounts.eventRentPayer,
            accounts.senderAuthorityPda,
            accounts.burnTokenAccount,
            accounts.denylistAccount,
            accounts.messageTransmitter,
            accounts.tokenMessenger,
            accounts.remoteTokenMessenger,
            accounts.tokenMinter,
            accounts.localToken,
            accounts.burnTokenMint,
            accounts.messageSentEventData,
            solanaMessageTransmitterV2,
            solanaTokenMessengerMinterV2,
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            "11111111111111111111111111111111",
            accounts.eventAuthority,
            solanaTokenMessengerMinterV2,
        ]);

        const metas = instruction.accounts.map((account) => ({
            signer: isSignerRole(account.role),
            writable: isWritableRole(account.role),
        }));
        expect(metas).toEqual([
            { signer: true, writable: false },
            { signer: true, writable: true },
            { signer: false, writable: false },
            { signer: false, writable: true },
            { signer: false, writable: false },
            { signer: false, writable: true },
            { signer: false, writable: false },
            { signer: false, writable: false },
            { signer: false, writable: false },
            { signer: false, writable: true },
            { signer: false, writable: true },
            { signer: true, writable: true },
            { signer: false, writable: false },
            { signer: false, writable: false },
            { signer: false, writable: false },
            { signer: false, writable: false },
            { signer: false, writable: false },
            { signer: false, writable: false },
        ]);

        const parsed = parseDepositForBurnInstruction(instruction);
        expect(parsed.data).toMatchObject({
            amount: 1_000_000n,
            destinationDomain: 3,
            mintRecipient: evmRecipientAsSolanaAddress,
            maxFee: 131n,
            minFinalityThreshold: 1000,
        });
    });
});
