import {
    type CctpSendParam,
    cctpEmptyHookData,
    cctpZeroBytes32,
    createSolanaCctpContract,
} from "boltz-swaps/cctp";
import { setBoltzSwapsConfig } from "boltz-swaps/config";
import {
    type Asset,
    AssetKind,
    BridgeKind,
    CctpTransferMode,
    NetworkTransport,
} from "boltz-swaps/types";
import log from "loglevel";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// vi.mock factories are hoisted above all imports/consts. Any state or
// constant they reference must live inside vi.hoisted().
const h = vi.hoisted(() => ({
    ASSET: "USDC.SOL",
    TOKEN_MINT: "TOKEN_MINT_ADDR",
    TOKEN_MESSENGER: "TOKEN_MESSENGER_PROGRAM",
    MESSAGE_TRANSMITTER: "MESSAGE_TRANSMITTER_PROGRAM",
    USER_ADDR: "USER_WALLET_ADDR",
    LOCAL_KP_ADDR: "LOCAL_MSG_KP_ADDR",
    ALLOCATED_MSG_ADDR: "ALLOCATED_MSG_KP_ADDR",
    ALLOCATED_RENT_PAYER_ADDR: "ALLOCATED_RENT_PAYER_ADDR",
    SOLBURN_URL: "https://solburn.example",
    getDepositForBurnSpy: undefined as ReturnType<typeof vi.fn> | undefined,
    lastBuiltInstructions: [] as unknown[],
    lastSignedWith: [] as unknown[],
}));

vi.mock("../../src/solana/lazy.ts", () => {
    type FakeKp = {
        publicKey: { toBase58: () => string };
        secretKey: Uint8Array;
    };

    const makeKp = (
        addr: string,
        secret: Uint8Array = new Uint8Array(),
    ): FakeKp => ({
        publicKey: { toBase58: () => addr },
        secretKey: secret,
    });

    const fakeWeb3 = {
        Keypair: {
            generate: vi.fn(() => makeKp(h.LOCAL_KP_ADDR)),
            fromSecretKey: vi.fn((secret: Uint8Array) => {
                // Tag by first byte: rent payer secret starts with 1,
                // message-sent-event-data secret starts with 2.
                if (secret[0] === 1) {
                    return makeKp(h.ALLOCATED_RENT_PAYER_ADDR, secret);
                }
                return makeKp(h.ALLOCATED_MSG_ADDR, secret);
            }),
        },
        ComputeBudgetProgram: {
            setComputeUnitLimit: ({ units }: { units: number }) => ({
                kind: "computeBudget",
                units,
            }),
        },
        SystemProgram: {
            transfer: (args: {
                fromPubkey: unknown;
                toPubkey: unknown;
                lamports: bigint;
            }) => ({ kind: "systemTransfer", ...args }),
        },
        PublicKey: class FakePublicKey {
            constructor(public input: string | Uint8Array) {}
            toBase58() {
                return typeof this.input === "string"
                    ? this.input
                    : "PK_FROM_BYTES";
            }
            toBytes() {
                return new Uint8Array(32);
            }
        },
        TransactionMessage: class FakeTransactionMessage {
            constructor(public args: { instructions: unknown[] }) {}
            compileToV0Message() {
                return this.args;
            }
        },
        VersionedTransaction: class FakeVersionedTransaction {
            constructor(public message: { instructions: unknown[] }) {
                h.lastBuiltInstructions = message.instructions;
            }
            sign(signers: unknown[]) {
                h.lastSignedWith = signers;
            }
        },
        SendTransactionError: class FakeSendTransactionError extends Error {},
    };

    h.getDepositForBurnSpy = vi.fn((accounts: unknown, options: unknown) => ({
        kind: "depositForBurn",
        accounts,
        options,
    }));

    const fakeSolanaKit = {
        address: (value: string) => value,
        createNoopSigner: (addr: string) => ({ address: addr }),
    };

    const fakeGenerated = {
        getDepositForBurnInstruction: h.getDepositForBurnSpy,
    };

    return {
        solanaCctp: {
            get: vi.fn().mockResolvedValue({
                web3: fakeWeb3,
                solanaKit: fakeSolanaKit,
                generated: fakeGenerated,
            }),
        },
        // Stubs so unrelated modules (e.g. solana/chain.ts) that touch
        // `solana`/`solanaOft` at import time don't crash. The functions in
        // those modules are never actually exercised by these tests.
        solana: { get: vi.fn() },
        solanaOft: { get: vi.fn() },
    };
});

vi.mock("../../src/solana/index.ts", async () => {
    const actual = await vi.importActual<
        typeof import("../../src/solana/index.ts")
    >("../../src/solana/index.ts");

    const fakeConnection = {
        getLatestBlockhash: vi.fn().mockResolvedValue({
            blockhash: "BLOCKHASH",
            lastValidBlockHeight: 1,
        }),
        simulateTransaction: vi
            .fn()
            .mockResolvedValue({ value: { err: null, logs: [] } }),
    };

    return {
        ...actual,
        getConnectedSolanaWalletAddress: vi.fn().mockResolvedValue(h.USER_ADDR),
        getSolanaConnection: vi.fn().mockResolvedValue(fakeConnection),
        getSolanaRentExemptMinimumBalance: vi
            .fn()
            .mockResolvedValue(2_039_280n),
        getSolanaAssociatedTokenAddress: vi.fn().mockResolvedValue("ATA_ADDR"),
        derivePda: vi.fn().mockReturnValue("DERIVED_PDA"),
        toLegacyInstruction: vi.fn((_modules: unknown, ix: unknown) => ix),
        formatSolanaLogsMessage: vi.fn().mockReturnValue(""),
    };
});

const mintRecipient32 = `0x${"ab".repeat(32)}` as const;

const makeSendParam = (): CctpSendParam => ({
    amount: 1_000_000n,
    destinationDomain: 0,
    mintRecipient: mintRecipient32,
    destinationCaller: cctpZeroBytes32 as `0x${string}`,
    maxFee: 1n,
    minFinalityThreshold: 1000,
    hookData: cctpEmptyHookData as `0x${string}`,
});

const makeWalletProvider = () =>
    ({
        signAndSendTransaction: vi.fn().mockResolvedValue("TX_SIGNATURE"),
    }) as unknown as Parameters<
        typeof createSolanaCctpContract
    >[0]["walletProvider"];

const assets: Record<string, Asset> = {
    [h.ASSET]: {
        type: AssetKind.ERC20,
        network: {
            chainName: "Solana",
            symbol: "SOL",
            gasToken: "SOL",
            transport: NetworkTransport.Solana,
            rpcUrls: [],
        },
        bridge: {
            kind: BridgeKind.Cctp,
            canonicalAsset: h.ASSET,
            cctp: {
                domain: 5,
                tokenMessenger: h.TOKEN_MESSENGER,
                messageTransmitter: h.MESSAGE_TRANSMITTER,
                transferMode: CctpTransferMode.Fast,
            },
        },
    },
};

const allocateBody = () => ({
    event_rent_payer: {
        secret: [1, ...Array.from({ length: 63 }, (_, i) => i)],
    },
    message_sent_event_data: {
        secret: [2, ...Array.from({ length: 63 }, (_, i) => i)],
    },
});

const getDepositArgs = () =>
    h.getDepositForBurnSpy?.mock.calls[0]?.[0] as {
        eventRentPayer: { address: string };
        owner: { address: string };
    };

const signerAddresses = () =>
    (
        h.lastSignedWith as {
            publicKey: { toBase58: () => string };
        }[]
    ).map((kp) => kp.publicKey.toBase58());

describe("createSolanaCctpContract send()", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(log, "warn").mockImplementation(() => {});

    beforeEach(() => {
        fetchSpy.mockReset();
        h.lastBuiltInstructions = [];
        h.lastSignedWith = [];
        h.getDepositForBurnSpy?.mockClear();
        setBoltzSwapsConfig({ assets });
    });

    afterEach(() => {
        setBoltzSwapsConfig({});
        fetchSpy.mockReset();
    });

    test("empty solburnUrl: compute-budget + burn ix only, user pays rent, single signer", async () => {
        setBoltzSwapsConfig({ assets, solburnUrl: "" });

        const contract = createSolanaCctpContract({
            asset: h.ASSET,
            tokenMint: h.TOKEN_MINT,
            walletProvider: makeWalletProvider(),
        });

        const result = await contract.send(makeSendParam());

        expect(result.hash).toBe("TX_SIGNATURE");
        expect(fetchSpy).not.toHaveBeenCalled();

        expect(h.lastBuiltInstructions).toHaveLength(2);
        expect(h.lastBuiltInstructions[0]).toMatchObject({
            kind: "computeBudget",
        });
        expect(h.lastBuiltInstructions[1]).toMatchObject({
            kind: "depositForBurn",
        });

        expect(signerAddresses()).toEqual([h.LOCAL_KP_ADDR]);

        const accounts = getDepositArgs();
        expect(accounts.eventRentPayer.address).toBe(h.USER_ADDR);
        expect(accounts.owner.address).toBe(h.USER_ADDR);
    });

    test("solburnUrl + allocate 200: inserts rent prefund, two signers, allocated rent payer", async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response(JSON.stringify(allocateBody()), { status: 200 }),
        );
        setBoltzSwapsConfig({ assets, solburnUrl: h.SOLBURN_URL });

        const contract = createSolanaCctpContract({
            asset: h.ASSET,
            tokenMint: h.TOKEN_MINT,
            walletProvider: makeWalletProvider(),
        });

        await contract.send(makeSendParam());

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy.mock.calls[0]![0]).toBe(`${h.SOLBURN_URL}/allocate`);

        expect(h.lastBuiltInstructions).toHaveLength(3);
        expect(h.lastBuiltInstructions[0]).toMatchObject({
            kind: "computeBudget",
        });
        expect(h.lastBuiltInstructions[1]).toMatchObject({
            kind: "systemTransfer",
            lamports: 2_039_280n,
        });
        expect(h.lastBuiltInstructions[2]).toMatchObject({
            kind: "depositForBurn",
        });

        expect(signerAddresses()).toEqual([
            h.ALLOCATED_MSG_ADDR,
            h.ALLOCATED_RENT_PAYER_ADDR,
        ]);

        const accounts = getDepositArgs();
        expect(accounts.eventRentPayer.address).toBe(
            h.ALLOCATED_RENT_PAYER_ADDR,
        );
        expect(accounts.owner.address).toBe(h.USER_ADDR);
    });

    test("solburnUrl + allocate failure: falls back to legacy path", async () => {
        fetchSpy.mockResolvedValueOnce(new Response("bad", { status: 503 }));
        setBoltzSwapsConfig({ assets, solburnUrl: h.SOLBURN_URL });

        const contract = createSolanaCctpContract({
            asset: h.ASSET,
            tokenMint: h.TOKEN_MINT,
            walletProvider: makeWalletProvider(),
        });

        await contract.send(makeSendParam());

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(h.lastBuiltInstructions).toHaveLength(2);
        expect(signerAddresses()).toEqual([h.LOCAL_KP_ADDR]);
        expect(getDepositArgs().eventRentPayer.address).toBe(h.USER_ADDR);
    });

    test("missing wallet provider rejects", async () => {
        const contract = createSolanaCctpContract({
            asset: h.ASSET,
            tokenMint: h.TOKEN_MINT,
        });

        await expect(contract.send(makeSendParam())).rejects.toThrow(
            /Missing connected Solana wallet/,
        );
    });
});
