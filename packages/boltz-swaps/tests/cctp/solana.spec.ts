import {
    address,
    createNoopSigner,
    isSignerRole,
    isWritableRole,
} from "@solana/kit";
import { PublicKey } from "@solana/web3.js";
import { addressToBytes32, cctpZeroBytes32 } from "boltz-swaps/cctp";
import { tryFetchSolburnAllocation } from "boltz-swaps/cctp";
import {
    getDepositForBurnInstruction,
    parseDepositForBurnInstruction,
} from "boltz-swaps/generated/solana-cctp";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
    solanaMessageTransmitterV2,
    solanaTokenMessengerMinterV2,
} from "../../src/cctp/protocol.ts";

const validAllocateBody = () => ({
    event_rent_payer: { secret: Array.from({ length: 64 }, (_, i) => i) },
    message_sent_event_data: {
        secret: Array.from({ length: 64 }, (_, i) => i + 64),
    },
});

const okResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
    });

describe("tryFetchSolburnAllocation", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    beforeEach(() => {
        fetchSpy.mockReset();
    });

    afterEach(() => {
        fetchSpy.mockReset();
    });

    test("returns parsed Uint8Array secrets on a successful response", async () => {
        fetchSpy.mockResolvedValueOnce(okResponse(validAllocateBody()));

        const allocation = await tryFetchSolburnAllocation(
            "https://solburn.example",
        );

        expect(allocation).not.toBeNull();
        expect(allocation?.eventRentPayerSecret).toBeInstanceOf(Uint8Array);
        expect(allocation?.eventRentPayerSecret).toHaveLength(64);
        expect(allocation?.eventRentPayerSecret[0]).toBe(0);
        expect(allocation?.messageSentEventDataSecret).toBeInstanceOf(
            Uint8Array,
        );
        expect(allocation?.messageSentEventDataSecret).toHaveLength(64);
        expect(allocation?.messageSentEventDataSecret[0]).toBe(64);
    });

    test("POSTs to the /allocate endpoint", async () => {
        fetchSpy.mockResolvedValueOnce(okResponse(validAllocateBody()));

        await tryFetchSolburnAllocation("https://solburn.example");

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0]!;
        expect(url).toBe("https://solburn.example/allocate");
        expect(init?.method).toBe("POST");
    });

    test.each([
        ["https://solburn.example/", "https://solburn.example/allocate"],
        ["https://solburn.example///", "https://solburn.example/allocate"],
        [
            "https://solburn.example/api/",
            "https://solburn.example/api/allocate",
        ],
    ])("strips trailing slashes from %s", async (input, expected) => {
        fetchSpy.mockResolvedValueOnce(okResponse(validAllocateBody()));

        await tryFetchSolburnAllocation(input);

        expect(fetchSpy.mock.calls[0]![0]).toBe(expected);
    });

    test("returns null when the server responds non-2xx", async () => {
        fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 503 }));

        const allocation = await tryFetchSolburnAllocation(
            "https://solburn.example",
        );

        expect(allocation).toBeNull();
    });

    test("returns null when fetch throws", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("network down"));

        const allocation = await tryFetchSolburnAllocation(
            "https://solburn.example",
        );

        expect(allocation).toBeNull();
    });
});

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
