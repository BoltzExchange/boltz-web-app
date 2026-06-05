import { hex } from "@scure/base";
import { Transaction as BtcTransaction } from "@scure/btc-signer";
import type * as BoltzCore from "boltz-core";
import type * as BoltzCoreLiquid from "boltz-core/liquid";
import { Buffer } from "buffer";

import {
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    txToHex,
    txToId,
} from "../../src/utxo/transaction.ts";

const { btcCCT, liquidCCT, utxoSecpGet, unblindOutputWithKey } = vi.hoisted(
    () => ({
        btcCCT: vi.fn(() => ({ kind: "btc-tx" })),
        liquidCCT: vi.fn(() => ({ kind: "liquid-tx" })),
        utxoSecpGet: vi.fn(),
        unblindOutputWithKey: vi.fn(),
    }),
);

vi.mock("boltz-core", async (importActual) => ({
    ...(await importActual<typeof BoltzCore>()),
    constructClaimTransaction: btcCCT,
}));

vi.mock("boltz-core/liquid", async (importActual) => ({
    ...(await importActual<typeof BoltzCoreLiquid>()),
    constructClaimTransaction: liquidCCT,
}));

vi.mock("../../src/utxo/lazy.ts", () => ({
    utxoSecp: { get: utxoSecpGet },
}));

const LBTC = "L-BTC";

const REGTEST_ADDR = "bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080";
const REGTEST_SCRIPT_HEX = "0014751e76e8199196d454941c45d1b3a323f1433bd6";

const RAW_BTC_TX_HEX =
    "0200000001abababababababababababababababababababababababababababababababab" +
    "0000000000ffffffff010000000000000000016a00000000";
const RAW_BTC_TX_ID =
    "4da07ab29c283e1481b70fd0f182652543c34c1d5c4bb01d5624a09d7501af16";

beforeEach(() => {
    btcCCT.mockClear();
    liquidCCT.mockClear();
    utxoSecpGet.mockReset();
    unblindOutputWithKey.mockReset();
});

describe("utxo/transaction", () => {
    describe("getNetwork", () => {
        test("BTC selects the boltz-core BTC network for regtest", async () => {
            const { Networks } = await import("boltz-core");
            expect(getNetwork("BTC", "regtest")).toBe(Networks.regtest);
            expect(getNetwork("BTC", "mainnet")).toBe(Networks.bitcoin);
            expect(getNetwork("BTC", "testnet")).toBe(Networks.testnet);
        });

        test("L-BTC selects the liquidjs network", async () => {
            const { networks } = await import("liquidjs-lib");
            expect(getNetwork(LBTC, "mainnet")).toBe(networks.liquid);
            expect(getNetwork(LBTC, "regtest")).toBe(networks.regtest);
            expect(getNetwork(LBTC, "testnet")).toBe(networks.testnet);
        });
    });

    describe("decodeAddress", () => {
        test("decodes a regtest BTC address to its output script", () => {
            const decoded = decodeAddress("BTC", REGTEST_ADDR, "regtest");
            expect(hex.encode(decoded.script)).toBe(REGTEST_SCRIPT_HEX);
            expect(decoded.blindingKey).toBeUndefined();
        });

        test("throws when the BTC address cannot be decoded", () => {
            expect(() =>
                decodeAddress("BTC", "not-a-valid-address", "regtest"),
            ).toThrow();
        });
    });

    describe("getTransaction", () => {
        test("BTC parses a raw hex tx and round-trips via txToHex/txToId", () => {
            const tx = getTransaction("BTC").fromHex(RAW_BTC_TX_HEX);
            expect(tx).toBeInstanceOf(BtcTransaction);
            expect(txToHex(tx)).toBe(RAW_BTC_TX_HEX);
            expect(txToId(tx)).toBe(RAW_BTC_TX_ID);
        });
    });

    describe("getConstructClaimTransaction dispatch", () => {
        const utxos = [{ marker: "utxo" }] as never;
        const destinationScript = hex.decode(REGTEST_SCRIPT_HEX);

        test("BTC dispatches to boltz-core constructClaimTransaction (fee 100n)", () => {
            const result = getConstructClaimTransaction("BTC")(
                utxos,
                destinationScript,
                100,
                true,
            );

            expect(btcCCT).toHaveBeenCalledTimes(1);
            expect(liquidCCT).not.toHaveBeenCalled();
            expect(btcCCT).toHaveBeenCalledWith(
                utxos,
                destinationScript,
                100n,
                true,
            );
            expect(btcCCT.mock.calls[0]).toHaveLength(4);
            expect(result).toEqual({ kind: "btc-tx" });
        });

        test("L-BTC dispatches to boltz-core/liquid constructClaimTransaction (fee 250n)", async () => {
            const { networks } = await import("liquidjs-lib");
            const liquidNetwork = networks.regtest;
            const blindingKey = Buffer.from("aa".repeat(32), "hex");

            const result = getConstructClaimTransaction(LBTC)(
                utxos,
                destinationScript,
                250,
                false,
                liquidNetwork,
                blindingKey,
            );

            expect(liquidCCT).toHaveBeenCalledTimes(1);
            expect(btcCCT).not.toHaveBeenCalled();
            expect(liquidCCT).toHaveBeenCalledWith(
                utxos,
                destinationScript,
                250n,
                false,
                liquidNetwork,
                blindingKey,
            );
            expect(liquidCCT.mock.calls[0]).toHaveLength(6);
            expect(result).toEqual({ kind: "liquid-tx" });
        });
    });

    describe("getOutputAmount", () => {
        test("BTC returns the numeric output amount", async () => {
            const output = { amount: 123_456n } as never;
            await expect(getOutputAmount("BTC", output)).resolves.toBe(123_456);
        });

        test("L-BTC unblinds a confidential output via utxoSecp", async () => {
            unblindOutputWithKey.mockReturnValue({ value: 77_000n });
            utxoSecpGet.mockResolvedValue({
                confidential: { unblindOutputWithKey },
            });

            const blindingPrivateKey = Buffer.from("bb".repeat(32), "hex");
            const output = {
                rangeProof: Buffer.from("cc".repeat(8), "hex"),
                blindingPrivateKey,
            } as never;

            await expect(getOutputAmount(LBTC, output)).resolves.toBe(77_000);

            expect(utxoSecpGet).toHaveBeenCalledTimes(1);
            expect(unblindOutputWithKey).toHaveBeenCalledTimes(1);
            expect(unblindOutputWithKey).toHaveBeenCalledWith(
                output,
                blindingPrivateKey,
            );
        });

        test("L-BTC throws when the confidential output has no blinding key", async () => {
            utxoSecpGet.mockResolvedValue({
                confidential: { unblindOutputWithKey },
            });

            const output = {
                rangeProof: Buffer.from("cc".repeat(8), "hex"),
            } as never;

            await expect(getOutputAmount(LBTC, output)).rejects.toThrow(
                "missing blinding private key for output",
            );
            expect(utxoSecpGet).toHaveBeenCalledTimes(1);
            expect(unblindOutputWithKey).not.toHaveBeenCalled();
        });

        test("L-BTC reads an explicit (unblinded) value without touching secp", async () => {
            const output = {
                value: Buffer.concat([
                    Buffer.from([0x01]),
                    Buffer.from("0000000000002710", "hex"),
                ]),
            } as never;

            await expect(getOutputAmount(LBTC, output)).resolves.toBe(10_000);
            expect(utxoSecpGet).not.toHaveBeenCalled();
        });

        test("L-BTC treats an empty rangeProof as a non-confidential value", async () => {
            const output = {
                rangeProof: Buffer.alloc(0),
                value: Buffer.concat([
                    Buffer.from([0x01]),
                    Buffer.from("0000000000000001", "hex"),
                ]),
            } as never;

            await expect(getOutputAmount(LBTC, output)).resolves.toBe(1);
            expect(utxoSecpGet).not.toHaveBeenCalled();
        });
    });
});
