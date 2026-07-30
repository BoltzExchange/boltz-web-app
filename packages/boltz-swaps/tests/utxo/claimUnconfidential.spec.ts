import { secp256k1 } from "@noble/curves/secp256k1.js";
import { OutputType } from "boltz-core";
import { Buffer } from "buffer";
import {
    Blinder,
    Creator,
    CreatorInput,
    Extractor,
    Finalizer,
    type Transaction as LiquidTransaction,
    Pset,
    Updater,
    ZKPGenerator,
    ZKPValidator,
    confidential,
    networks,
    witnessStackToScriptWitness,
} from "liquidjs-lib";

import { liquidUnconfidentialClaimExtra } from "../../src/utxo/claim.ts";
import { utxoSecp } from "../../src/utxo/lazy.ts";
import { getConstructClaimTransaction } from "../../src/utxo/transaction.ts";

const network = networks.regtest;

const LOCKUP_VALUE = 100_000;

// Elements prices transactions at 0.1 sat/vbyte with truncating division
const minRelayFee = (vsize: number) => Math.floor((100 * vsize) / 1000);

const p2tr = (xOnlyPubkey: Uint8Array) =>
    Buffer.concat([Buffer.of(0x51, 0x20), Buffer.from(xOnlyPubkey)]);

const explicitValue = (value: number) => {
    const buf = Buffer.alloc(9);
    buf.writeUInt8(1, 0);
    buf.writeBigUInt64BE(BigInt(value), 1);
    return buf;
};

// Stands in for the server lockup; never broadcast, so its input can be fake
const buildBlindedLockup = (
    secp: unknown,
    script: Buffer,
    blindingPublicKey: Buffer,
) => {
    const pset = Creator.newPset();
    const updater = new Updater(pset);

    pset.addInput(
        new CreatorInput(
            Buffer.from(secp256k1.utils.randomSecretKey()).toString("hex"),
            0,
            0xffffffff,
        ).toPartialInput(),
    );
    updater.addInWitnessUtxo(0, {
        asset: Buffer.concat([
            Buffer.of(0x01),
            Buffer.from(network.assetHash, "hex").reverse(),
        ]),
        value: explicitValue(LOCKUP_VALUE + 1_000),
        nonce: Buffer.of(0x00),
        script,
    });
    updater.addInSighashType(0, 0);
    updater.addOutputs([
        {
            script,
            blindingPublicKey,
            asset: network.assetHash,
            amount: LOCKUP_VALUE,
            blinderIndex: 0,
        },
        { amount: 1_000, asset: network.assetHash },
    ]);

    const generator = new ZKPGenerator(
        secp as never,
        ZKPGenerator.WithBlindingKeysOfInputs([undefined as never]),
    );
    const outputBlindingArgs = generator.blindOutputs(
        pset,
        Pset.ECCKeysGenerator((secp as { ecc: never }).ecc),
    );
    new Blinder(
        pset,
        generator.unblindInputs(pset),
        new ZKPValidator(secp as never),
        generator,
    ).blindLast({ outputBlindingArgs });

    new Finalizer(pset).finalizeInput(0, () => ({
        finalScriptWitness: witnessStackToScriptWitness([Buffer.alloc(64)]),
    }));

    return Extractor.extract(pset);
};

const feeOutputValue = (tx: LiquidTransaction) => {
    const feeOutput = tx.outs.find((out) => out.script.length === 0);
    expect(feeOutput).toBeDefined();
    return confidential.confidentialValueToSatoshi(
        Buffer.from(feeOutput!.value),
    );
};

const explicitOutputValue = (tx: LiquidTransaction, script: Buffer) => {
    const out = tx.outs.find((o) => Buffer.from(o.script).equals(script));
    expect(out).toBeDefined();
    return confidential.confidentialValueToSatoshi(Buffer.from(out!.value));
};

describe("unconfidential Liquid claims", () => {
    let claimToConfidential: LiquidTransaction;
    let claimToUnconfidential: LiquidTransaction;
    let claimToUnconfidentialWithExtra: LiquidTransaction;
    let destinationScript: Buffer;
    let feeBudget: number;
    let receiveAmount: number;

    beforeAll(async () => {
        const { secpZkp } = await utxoSecp.get();

        const swapKey = secp256k1.utils.randomSecretKey();
        const swapPublicKey = secp256k1.getPublicKey(swapKey, true).slice(1);
        const swapScript = p2tr(swapPublicKey);

        const lockupBlindingKey = secp256k1.utils.randomSecretKey();
        const lockupTx = buildBlindedLockup(
            secpZkp,
            swapScript,
            Buffer.from(secp256k1.getPublicKey(lockupBlindingKey, true)),
        );

        destinationScript = p2tr(
            secp256k1
                .getPublicKey(secp256k1.utils.randomSecretKey(), true)
                .slice(1),
        );
        const destinationBlindingKey = Buffer.from(
            secp256k1.getPublicKey(secp256k1.utils.randomSecretKey(), true),
        );

        // A fresh copy per construction: boltz-core mutates what it is given
        const details = () => [
            {
                ...lockupTx.outs[0],
                vout: 0,
                transactionId: lockupTx.getId(),
                type: OutputType.Taproot,
                cooperative: true,
                privateKey: swapKey,
                internalKey: swapPublicKey,
                blindingPrivateKey: Buffer.from(lockupBlindingKey),
                preimage: Buffer.alloc(32),
            },
        ];

        const constructClaim = getConstructClaimTransaction("L-BTC");
        const construct = (fee: number, blindingKey?: Buffer) =>
            constructClaim(
                details() as never,
                destinationScript,
                fee,
                true,
                network,
                blindingKey,
            ) as LiquidTransaction;

        // Size does not depend on the fee, so measure first, then budget what
        // the server would quote for the confidential shape: the bare minimum
        feeBudget = minRelayFee(
            construct(1_000, destinationBlindingKey).virtualSize(true),
        );
        receiveAmount = LOCKUP_VALUE - feeBudget;

        claimToConfidential = construct(feeBudget, destinationBlindingKey);
        claimToUnconfidential = construct(feeBudget);
        claimToUnconfidentialWithExtra = construct(
            feeBudget + liquidUnconfidentialClaimExtra,
        );
    });

    test("pays the full fee to a confidential destination", () => {
        expect(claimToConfidential.outs).toHaveLength(2);
        expect(feeOutputValue(claimToConfidential)).toEqual(feeBudget);
    });

    test("silently pays one sat less to an unconfidential destination", () => {
        expect(claimToUnconfidential.outs).toHaveLength(3);
        expect(feeOutputValue(claimToUnconfidential)).toEqual(feeBudget - 1);
    });

    test("the surcharge covers the OP_RETURN at every vsize alignment", () => {
        const sizeDelta =
            claimToUnconfidential.virtualSize(true) -
            claimToConfidential.virtualSize(true);

        // Truncation makes the required-fee delta depend on vsize % 10, and
        // this fixture only measures one alignment
        const worstCase = Math.max(
            ...Array.from(
                { length: 10 },
                (_, remainder) =>
                    minRelayFee(1_000 + remainder + sizeDelta) -
                    minRelayFee(1_000 + remainder),
            ),
        );

        expect(liquidUnconfidentialClaimExtra).toEqual(worstCase + 1);
    });

    test("takes the surcharge out of the claim output, not the fee", () => {
        expect(feeOutputValue(claimToUnconfidentialWithExtra)).toEqual(
            feeBudget + liquidUnconfidentialClaimExtra - 1,
        );
        expect(
            explicitOutputValue(
                claimToUnconfidentialWithExtra,
                destinationScript,
            ),
        ).toEqual(receiveAmount - liquidUnconfidentialClaimExtra);
    });

    test("meets the min relay fee, which it would not without the surcharge", () => {
        const required = minRelayFee(
            claimToUnconfidentialWithExtra.virtualSize(true),
        );

        expect(feeOutputValue(claimToUnconfidential)).toBeLessThan(required);
        expect(
            feeOutputValue(claimToUnconfidentialWithExtra),
        ).toBeGreaterThanOrEqual(required);
    });
});
