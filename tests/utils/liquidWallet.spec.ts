import { Buffer } from "buffer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { type TempLiquidWallet, signPset } from "../../src/utils/liquidWallet";

const liquidJsMock = vi.hoisted(() => ({
    addInSighashType: vi.fn(),
    finalizeInput: vi.fn(),
    addSignature: vi.fn(),
    pset: undefined as unknown,
}));

vi.mock("liquidjs-lib", () => {
    class MockUpdater {
        private readonly pset: {
            inputs: Array<{ sighashType?: number }>;
        };

        constructor(pset: { inputs: Array<{ sighashType?: number }> }) {
            this.pset = pset;
        }

        addInSighashType(index: number, sighashType: number) {
            liquidJsMock.addInSighashType(index, sighashType);
            this.pset.inputs[index].sighashType = sighashType;
            return this;
        }
    }

    class MockSigner {
        private readonly pset: {
            inputs: Array<{ sighashType?: number }>;
        };

        constructor(pset: { inputs: Array<{ sighashType?: number }> }) {
            this.pset = pset;
        }

        addSignature(index: number, data: unknown) {
            if (this.pset.inputs[index].sighashType === undefined) {
                throw new Error("Missing input sighash type");
            }
            liquidJsMock.addSignature(index, data);
            return this;
        }
    }

    class MockFinalizer {
        finalizeInput(index: number) {
            liquidJsMock.finalizeInput(index);
            return this;
        }
    }

    return {
        Finalizer: MockFinalizer,
        Pset: {
            fromBase64: vi.fn(() => liquidJsMock.pset),
        },
        Signer: MockSigner,
        Updater: MockUpdater,
        Transaction: {
            SIGHASH_ALL: 0x01,
        },
        address: {},
        confidential: {},
        networks: {},
        payments: {},
    };
});

type MockPset = {
    inputs: Array<{
        sighashType?: number;
        witnessUtxo?: { script: Buffer };
    }>;
    getInputPreimage: ReturnType<typeof vi.fn>;
    toBase64: ReturnType<typeof vi.fn>;
};

const outputScript = Buffer.from("0014" + "11".repeat(20), "hex");

const wallet: TempLiquidWallet = {
    keyIndex: 0,
    spendPrivateKey: Uint8Array.from([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 1,
    ]),
    spendPublicKey: Buffer.from(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        "hex",
    ),
    blindingPrivateKey: Buffer.alloc(32),
    blindingPublicKey: Buffer.alloc(33),
    address: "liquid-address",
    outputScript,
};

const mockPset = (sighashType?: number): MockPset => ({
    inputs: [
        {
            sighashType,
            witnessUtxo: { script: outputScript },
        },
    ],
    getInputPreimage: vi.fn(() => Buffer.alloc(32, 1)),
    toBase64: vi.fn(() => "signed-pset"),
});

describe("liquidWallet", () => {
    beforeEach(() => {
        liquidJsMock.addInSighashType.mockClear();
        liquidJsMock.finalizeInput.mockClear();
        liquidJsMock.addSignature.mockClear();
    });

    test("defaults missing SideSwap PSET input sighash type to SIGHASH_ALL", () => {
        const pset = mockPset();
        liquidJsMock.pset = pset;

        expect(signPset("unsigned-pset", wallet)).toBe("signed-pset");

        expect(liquidJsMock.addInSighashType).toHaveBeenCalledWith(0, 0x01);
        expect(pset.getInputPreimage).toHaveBeenCalledWith(0, 0x01);
        const signature = liquidJsMock.addSignature.mock.calls[0][1] as {
            partialSig: { signature: Buffer };
        };
        expect(signature.partialSig.signature.at(-1)).toBe(0x01);
        expect(liquidJsMock.finalizeInput).toHaveBeenCalledWith(0);
    });

    test("preserves an explicit SideSwap PSET input sighash type", () => {
        const pset = mockPset(0x81);
        liquidJsMock.pset = pset;

        expect(signPset("unsigned-pset", wallet)).toBe("signed-pset");

        expect(liquidJsMock.addInSighashType).not.toHaveBeenCalled();
        expect(pset.getInputPreimage).toHaveBeenCalledWith(0, 0x81);
        const signature = liquidJsMock.addSignature.mock.calls[0][1] as {
            partialSig: { signature: Buffer };
        };
        expect(signature.partialSig.signature.at(-1)).toBe(0x81);
    });
});
