import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { SwapTreeSerializer } from "boltz-core";
import { reverseSwapTree } from "boltz-core/liquid";
import { Buffer } from "buffer";
import {
    Blinder,
    Creator,
    CreatorInput,
    Extractor,
    Finalizer,
    address as LiquidAddress,
    type Transaction as LiquidTransaction,
    Pset,
    Updater,
    ZKPGenerator,
    ZKPValidator,
    confidential,
    networks,
    witnessStackToScriptWitness,
} from "liquidjs-lib";

import {
    claimReverseUtxo,
    liquidUnconfidentialClaimExtra,
} from "../../src/utxo/claim.ts";
import { utxoSecp } from "../../src/utxo/lazy.ts";
import { createMusig, tweakMusig } from "../../src/utxo/musig.ts";
import { getTransaction } from "../../src/utxo/transaction.ts";

const network = networks.regtest;

const LOCKUP_VALUE = 100_000;
const RECEIVE_AMOUNT = 99_970;
const INTENDED_FEE = LOCKUP_VALUE - RECEIVE_AMOUNT;

const keyPair = () => {
    const privateKey = secp256k1.utils.randomSecretKey();
    return { privateKey, publicKey: secp256k1.getPublicKey(privateKey, true) };
};

const explicitValue = (value: number) => {
    const buf = Buffer.alloc(9);
    buf.writeUInt8(1, 0);
    buf.writeBigUInt64BE(BigInt(value), 1);
    return buf;
};

const sat = (value: Uint8Array) =>
    confidential.confidentialValueToSatoshi(Buffer.from(value));

// Pays the tweaked musig key so `detectSwap` finds it; never broadcast
const buildBlindedLockup = (
    secp: unknown,
    lockupScript: Buffer,
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
        script: lockupScript,
    });
    updater.addInSighashType(0, 0);
    updater.addOutputs([
        {
            script: lockupScript,
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

describe("claimReverseUtxo to an unconfidential Liquid address", () => {
    let claimTo: (confidentialDestination: boolean) => Promise<{
        tx: LiquidTransaction;
        claimedAmount: number;
        destinationScript: Buffer;
    }>;

    beforeAll(async () => {
        const { secpZkp } = await utxoSecp.get();

        const claimKeys = keyPair();
        const serverKeys = keyPair();
        const preimage = Buffer.alloc(32, 9);
        const lockupBlindingKey = secp256k1.utils.randomSecretKey();

        const tree = reverseSwapTree(
            sha256(preimage),
            claimKeys.publicKey,
            serverKeys.publicKey,
            1_000,
        );
        const tweaked = tweakMusig(
            "L-BTC",
            createMusig(claimKeys, serverKeys.publicKey),
            tree.tree,
        );
        const lockupScript = Buffer.concat([
            Buffer.of(0x51, 0x20),
            Buffer.from(tweaked.aggPubkey),
        ]);

        const lockupTx = buildBlindedLockup(
            secpZkp,
            lockupScript,
            Buffer.from(secp256k1.getPublicKey(lockupBlindingKey, true)),
        );

        const destinationScript = Buffer.concat([
            Buffer.of(0x00, 0x14),
            Buffer.alloc(20, 3),
        ]);
        const unconfidentialAddress = LiquidAddress.fromOutputScript(
            destinationScript,
            network,
        );
        const confidentialAddress = LiquidAddress.toConfidential(
            unconfidentialAddress,
            Buffer.from(
                secp256k1.getPublicKey(secp256k1.utils.randomSecretKey(), true),
            ),
        );

        claimTo = async (confidentialDestination: boolean) => {
            const result = await claimReverseUtxo({
                id: "e2e",
                asset: "L-BTC",
                network: "regtest",
                serverPublicKey: hex.encode(serverKeys.publicKey),
                swapTree: SwapTreeSerializer.serializeSwapTree(tree) as never,
                blindingKey: hex.encode(lockupBlindingKey),
                claimKeys,
                preimage,
                claimAddress: confidentialDestination
                    ? confidentialAddress
                    : unconfidentialAddress,
                receiveAmount: RECEIVE_AMOUNT,
                lockupTxHex: lockupTx.toHex(),
                // Skips the server round trip; the fee arithmetic is the same
                cooperative: false,
            });

            return {
                tx: getTransaction("L-BTC").fromHex(
                    result.transactionHex,
                ) as LiquidTransaction,
                claimedAmount: result.claimedAmount,
                destinationScript,
            };
        };
    });

    test("leaves a confidential claim untouched", async () => {
        const { tx, claimedAmount } = await claimTo(true);

        expect(tx.outs).toHaveLength(2);
        expect(sat(tx.outs.find((o) => o.script.length === 0)!.value)).toEqual(
            INTENDED_FEE,
        );
        expect(claimedAmount).toEqual(RECEIVE_AMOUNT);
    });

    test("reserves the surcharge out of the claim output", async () => {
        const { tx, claimedAmount, destinationScript } = await claimTo(false);

        expect(tx.outs).toHaveLength(3);

        const claimOutput = tx.outs.find((o) =>
            Buffer.from(o.script).equals(destinationScript),
        );
        const opReturn = tx.outs.find(
            (o) => o.script.length === 1 && o.script[0] === 0x6a,
        );
        const feeOutput = tx.outs.find((o) => o.script.length === 0);

        expect(claimOutput).toBeDefined();
        expect(opReturn).toBeDefined();

        expect(sat(claimOutput!.value)).toEqual(
            RECEIVE_AMOUNT - liquidUnconfidentialClaimExtra,
        );
        expect(claimedAmount).toEqual(sat(claimOutput!.value));
        expect(sat(feeOutput!.value)).toEqual(
            INTENDED_FEE + liquidUnconfidentialClaimExtra - 1,
        );
    });

    // Only checkable unconfidential: a confidential claim output is blinded
    test("conserves the lockup value", async () => {
        const { tx } = await claimTo(false);

        const explicitTotal = tx.outs
            .filter((out) => out.value[0] === 1)
            .reduce((sum, out) => sum + sat(out.value), 0);
        // boltz-core hardcodes the blinded OP_RETURN at 1 sat
        expect(explicitTotal + 1).toEqual(LOCKUP_VALUE);
    });
});
