import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { createBoltzClient, getPairs } from "boltz-swaps";
import { SwapStatus, isFinalStatus } from "boltz-swaps/status";
import {
    type SwapUpdate,
    createPollingStatusSource,
    createWebSocketStatusSource,
} from "boltz-swaps/statusSource";
import { SwapType } from "boltz-swaps/types";

import {
    BOLTZ_API_URL,
    generateBitcoinBlock,
    getBitcoinAddress,
    payInvoiceInBackground,
    sleep,
} from "./regtest.ts";

const makeKeys = () => {
    const privateKey = secp256k1.utils.randomSecretKey();
    return { privateKey, publicKey: secp256k1.getPublicKey(privateKey, true) };
};

describe("status source integration (regtest)", () => {
    const boltz = createBoltzClient({
        boltzApiUrl: BOLTZ_API_URL,
        network: "regtest",
    });

    const createReverseSwap = async (): Promise<{
        id: string;
        invoice: string;
    }> => {
        const pairs = await getPairs();
        const pair = pairs[SwapType.Reverse]["BTC"]?.["BTC"];
        if (pair?.hash === undefined) {
            throw new Error("no reverse BTC -> BTC pair");
        }
        const claimKeys = makeKeys();
        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const created = await boltz.swap.reverse.create({
            from: "BTC",
            to: "BTC",
            invoiceAmount: 100_000,
            preimageHash: hex.encode(sha256(preimage)),
            pairHash: pair.hash,
            claimPublicKey: hex.encode(claimKeys.publicKey),
            claimAddress: await getBitcoinAddress(),
        });
        return { id: created.id, invoice: created.invoice };
    };

    test("swap.statuses returns a single id (the backend accepts one ?ids=)", async () => {
        const { id } = await createReverseSwap();

        const statuses = await boltz.swap.statuses([id]);
        const single = await boltz.swap.status(id);

        expect(Object.keys(statuses)).toEqual([id]);
        expect(statuses[id].status).toBe(single.status);
        expect(statuses[id].status).toBe(SwapStatus.SwapCreated);
    }, 60_000);

    test("swap.statuses fetches multiple ids in one bulk request", async () => {
        const [a, b] = await Promise.all([
            createReverseSwap(),
            createReverseSwap(),
        ]);

        const statuses = await boltz.swap.statuses([a.id, b.id]);

        expect(new Set(Object.keys(statuses))).toEqual(new Set([a.id, b.id]));
        expect(statuses[a.id].status).toBe(SwapStatus.SwapCreated);
        expect(statuses[b.id].status).toBe(SwapStatus.SwapCreated);
    }, 60_000);

    test("swap.statuses rejects the whole call when an id is unknown (all-or-nothing)", async () => {
        const { id } = await createReverseSwap();
        await expect(
            boltz.swap.statuses([id, "doesnotexist"]),
        ).rejects.toBeDefined();
    }, 60_000);

    test("polling source emits once for an unchanged status and ignores a re-subscribe", async () => {
        const { id } = await createReverseSwap();

        const source = createPollingStatusSource({ intervalMs: 500 });
        const seen: SwapUpdate[] = [];
        const handler = (u: SwapUpdate): void => {
            seen.push(u);
        };
        try {
            source.subscribe(id, handler);

            await sleep(3_000);
            expect(seen).toHaveLength(1);
            expect(seen[0].status).toBe(SwapStatus.SwapCreated);

            source.subscribe(id, handler);
            await sleep(1_000);
            expect(seen).toHaveLength(1);
        } finally {
            source.close?.();
        }
    }, 60_000);

    test("websocket source pushes the current status on subscribe", async () => {
        const { id } = await createReverseSwap();

        const source = createWebSocketStatusSource();
        try {
            const update = await new Promise<SwapUpdate>((resolve, reject) => {
                const timer = setTimeout(
                    () => reject(new Error("timed out waiting for WS push")),
                    30_000,
                );
                source.subscribe(id, (u) => {
                    clearTimeout(timer);
                    resolve(u);
                });
            });
            expect(update.id).toBe(id);
            expect(update.status).toBe(SwapStatus.SwapCreated);
        } finally {
            source.close?.();
        }
    }, 60_000);

    test("swap.watch streams the reverse-swap status progression over the default (WS) source", async () => {
        const { id, invoice } = await createReverseSwap();

        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 90_000);
        const seen: string[] = [];
        try {
            for await (const update of boltz.swap.watch(id, {
                signal: controller.signal,
            })) {
                seen.push(update.status);
                if (update.status === SwapStatus.SwapCreated) {
                    payInvoiceInBackground(invoice);
                }
                if (update.status === SwapStatus.TransactionMempool) {
                    await generateBitcoinBlock();
                }
                if (update.status === SwapStatus.TransactionConfirmed) {
                    break;
                }
                if (isFinalStatus(update.status)) {
                    throw new Error(`reverse swap failed: ${update.status}`);
                }
            }
        } finally {
            clearTimeout(abortTimer);
        }

        expect(seen[0]).toBe(SwapStatus.SwapCreated);
        expect(seen).toContain(SwapStatus.TransactionMempool);
        expect(seen[seen.length - 1]).toBe(SwapStatus.TransactionConfirmed);
    }, 120_000);
});
