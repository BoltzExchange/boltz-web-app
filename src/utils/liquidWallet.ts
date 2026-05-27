import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { Buffer } from "buffer";
import {
    Finalizer,
    address as LiquidAddress,
    networks as LiquidNetworks,
    Transaction as LiquidTransaction,
    Pset,
    Signer,
    Updater,
    confidential,
    payments,
} from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { config } from "../config";
import secp from "../lazy/secp";
import { mnemonicToHDKey } from "./rescueDerivation";
import { type RescueFile, derivationPath } from "./rescueFile";

export type TempLiquidWallet = {
    keyIndex: number;
    spendPrivateKey: Uint8Array;
    spendPublicKey: Uint8Array;
    blindingPrivateKey: Buffer;
    blindingPublicKey: Buffer;
    address: string;
    outputScript: Buffer;
};

export type UnblindedUtxo = {
    txid: string;
    vout: number;
    asset: string;
    value: number;
    assetBlindingFactor: string;
    valueBlindingFactor: string;
    script: string;
    witnessUtxo?: {
        script: Buffer;
        asset: Buffer;
        value: Buffer;
        nonce: Buffer;
        rangeProof: Buffer;
        surjectionProof: Buffer;
    };
};

const getLiquidNetwork = (): LiquidNetwork => {
    const liquidNet = config.network === "mainnet" ? "liquid" : config.network;
    return LiquidNetworks[liquidNet] as LiquidNetwork;
};

export const deriveTempLiquidWallet = (
    rescueFile: RescueFile,
    keyIndex: number,
): TempLiquidWallet => {
    const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
    const spendKey = hdKey.derive(`${derivationPath}/${keyIndex}`);

    const spendPrivateKey = spendKey.privateKey;
    if (spendPrivateKey === null) {
        throw new Error("failed to derive temp Liquid private key");
    }
    const spendPublicKey = secp256k1.getPublicKey(spendPrivateKey, true);

    const blindingPrivateKey = Buffer.from(sha256(spendPrivateKey));
    const blindingPublicKey = Buffer.from(
        secp256k1.getPublicKey(blindingPrivateKey, true),
    );

    const network = getLiquidNetwork();
    const p2wpkh = payments.p2wpkh({
        pubkey: Buffer.from(spendPublicKey),
        network,
        blindkey: blindingPublicKey,
    });

    return {
        keyIndex,
        spendPrivateKey,
        spendPublicKey,
        blindingPrivateKey,
        blindingPublicKey,
        address: p2wpkh.confidentialAddress!,
        outputScript: p2wpkh.output!,
    };
};

export const unblindOutput = async (
    txHex: string,
    vout: number,
    blindingPrivateKey: Buffer,
): Promise<UnblindedUtxo> => {
    const tx = LiquidTransaction.fromHex(txHex);
    const txid = tx.getId();
    const output = tx.outs[vout];

    if (!output) {
        throw new Error(`Output ${vout} not found in transaction ${txid}`);
    }

    const { confidential: confidentialInstance } = await secp.get();

    const rawWitnessUtxo = {
        script: output.script,
        asset: output.asset,
        value: output.value,
        nonce: output.nonce ?? Buffer.alloc(1),
        rangeProof: output.rangeProof ?? Buffer.alloc(0),
        surjectionProof: output.surjectionProof ?? Buffer.alloc(0),
    };

    const rangeProof = output.rangeProof;
    if (rangeProof !== undefined && rangeProof.length > 0) {
        const unblinded = confidentialInstance.unblindOutputWithKey(
            output,
            blindingPrivateKey,
        );

        return {
            txid,
            vout,
            asset: hex.encode(Buffer.from(unblinded.asset).reverse()),
            value: parseInt(unblinded.value, 10),
            assetBlindingFactor: hex.encode(
                Buffer.from(unblinded.assetBlindingFactor).reverse(),
            ),
            valueBlindingFactor: hex.encode(
                Buffer.from(unblinded.valueBlindingFactor).reverse(),
            ),
            script: output.script.toString("hex"),
            witnessUtxo: rawWitnessUtxo,
        };
    }

    return {
        txid,
        vout,
        asset: hex.encode(Buffer.from(output.asset.subarray(1)).reverse()),
        value: confidential.confidentialValueToSatoshi(output.value),
        assetBlindingFactor:
            "0000000000000000000000000000000000000000000000000000000000000000",
        valueBlindingFactor:
            "0000000000000000000000000000000000000000000000000000000000000000",
        script: output.script.toString("hex"),
        witnessUtxo: rawWitnessUtxo,
    };
};

export const findOutputForScript = (
    txHex: string,
    targetScript: Buffer,
): number | undefined => {
    const tx = LiquidTransaction.fromHex(txHex);

    for (let i = 0; i < tx.outs.length; i++) {
        if (tx.outs[i].script && targetScript.equals(tx.outs[i].script)) {
            return i;
        }
    }

    return undefined;
};

export const findAllOutputsForScript = async (
    txHex: string,
    targetScript: Buffer,
    blindingPrivateKey: Buffer,
): Promise<UnblindedUtxo[]> => {
    const tx = LiquidTransaction.fromHex(txHex);
    const utxos: UnblindedUtxo[] = [];

    for (let i = 0; i < tx.outs.length; i++) {
        if (!tx.outs[i].script || !targetScript.equals(tx.outs[i].script)) {
            continue;
        }

        try {
            utxos.push(await unblindOutput(txHex, i, blindingPrivateKey));
        } catch (e) {
            log.warn(`Could not unblind Liquid output ${i}:`, e);
        }
    }

    return utxos;
};

export const signPset = (
    psetBase64: string,
    wallet: TempLiquidWallet,
): string => {
    log.info("Signing SideSwap PSET with temp Liquid wallet");

    const pset = Pset.fromBase64(psetBase64);
    const updater = new Updater(pset);
    const signer = new Signer(pset);
    const finalizer = new Finalizer(pset);
    const pubkeyBuf = Buffer.from(wallet.spendPublicKey);

    for (let i = 0; i < pset.inputs.length; i++) {
        const input = pset.inputs[i];
        const witUtxo = input.witnessUtxo;
        if (!witUtxo || !wallet.outputScript.equals(witUtxo.script)) {
            continue;
        }

        const sighashType = input.sighashType ?? LiquidTransaction.SIGHASH_ALL;
        if (input.sighashType === undefined) {
            updater.addInSighashType(i, sighashType);
        }

        const preimage = pset.getInputPreimage(i, sighashType);
        const derBytes = secp256k1.sign(preimage, wallet.spendPrivateKey, {
            prehash: false,
            format: "der",
        });
        const sigWithHashType = Buffer.concat([
            Buffer.from(derBytes),
            Buffer.from([sighashType]),
        ]);

        signer.addSignature(
            i,
            {
                partialSig: {
                    pubkey: pubkeyBuf,
                    signature: sigWithHashType,
                },
            },
            (pubkey: Buffer, msghash: Buffer, signature: Buffer): boolean =>
                secp256k1.verify(signature, msghash, pubkey, {
                    prehash: false,
                }),
        );
        finalizer.finalizeInput(i);
    }

    return pset.toBase64();
};

export const buildMultiAssetSweepTransaction = async (
    utxos: UnblindedUtxo[],
    wallet: TempLiquidWallet,
    destinationAddress: string,
    feeRate: number,
): Promise<string> => {
    const {
        Blinder,
        Creator,
        CreatorInput,
        CreatorOutput,
        Extractor,
        Finalizer,
        Signer: PsetSigner,
        Updater,
        ZKPGenerator,
        ZKPValidator,
        witnessStackToScriptWitness,
    } = await import("liquidjs-lib");

    const zkp = await secp.get();
    const network = getLiquidNetwork();
    const lbtcAssetId = network.assetHash;
    const estimatedVsize = 150 + utxos.length * 150;
    const fee = Math.ceil(feeRate * estimatedVsize);

    const destScript = LiquidAddress.toOutputScript(
        destinationAddress,
        network,
    );
    let destBlindingKey: Buffer | undefined;
    try {
        destBlindingKey =
            LiquidAddress.fromConfidential(destinationAddress).blindingKey;
    } catch {
        // non-confidential destination
    }

    const pset = Creator.newPset();
    const updater = new Updater(pset);
    const inputsAreConfidential = utxos.some((u) => {
        const rangeProof = u.witnessUtxo?.rangeProof;
        return rangeProof !== undefined && rangeProof.length > 0;
    });

    for (const [i, utxo] of utxos.entries()) {
        pset.addInput(
            new CreatorInput(utxo.txid, utxo.vout, 0xffffffff).toPartialInput(),
        );
        updater.addInSighashType(i, LiquidTransaction.SIGHASH_ALL);

        updater.addInWitnessUtxo(
            i,
            utxo.witnessUtxo ?? {
                script: wallet.outputScript,
                asset: Buffer.concat([
                    Buffer.from([0x01]),
                    Buffer.from(hex.decode(utxo.asset)).reverse(),
                ]),
                value: confidential.satoshiToConfidentialValue(utxo.value),
                nonce: Buffer.alloc(1),
                rangeProof: Buffer.alloc(0),
                surjectionProof: Buffer.alloc(0),
            },
        );
    }

    const assetTotals = new Map<string, number>();
    for (const utxo of utxos) {
        assetTotals.set(
            utxo.asset,
            (assetTotals.get(utxo.asset) ?? 0) + utxo.value,
        );
    }

    const lbtcTotal = assetTotals.get(lbtcAssetId) ?? 0;
    if (lbtcTotal < fee) {
        throw new Error("Insufficient L-BTC for transaction fee");
    }

    for (const [assetId, total] of assetTotals) {
        let amount = total;
        if (assetId === lbtcAssetId) {
            amount -= fee;
            if (amount <= 0) continue;
        }
        updater.addOutputs([
            {
                script: destScript,
                blindingPublicKey: destBlindingKey,
                asset: assetId,
                amount,
                blinderIndex: destBlindingKey !== undefined ? 0 : undefined,
            },
        ]);
    }

    if (inputsAreConfidential && !destBlindingKey) {
        const randomPubKey = Buffer.from(
            secp256k1.getPublicKey(secp256k1.utils.randomSecretKey()),
        );
        pset.addOutput(
            new CreatorOutput(
                lbtcAssetId,
                1,
                Buffer.of(0x6a),
                randomPubKey,
                0,
            ).toPartialOutput(),
        );
        updater.addOutputs([{ amount: fee - 1, asset: lbtcAssetId }]);
    } else {
        updater.addOutputs([{ amount: fee, asset: lbtcAssetId }]);
    }

    if (inputsAreConfidential || destBlindingKey) {
        const zkpGenerator = new ZKPGenerator(
            zkp.secpZkp as never,
            ZKPGenerator.WithBlindingKeysOfInputs(
                utxos.map(() =>
                    inputsAreConfidential
                        ? wallet.blindingPrivateKey
                        : undefined,
                ) as Buffer[],
            ),
        );
        const zkpValidator = new ZKPValidator(zkp.secpZkp as never);
        const outputBlindingArgs = zkpGenerator.blindOutputs(
            pset,
            Pset.ECCKeysGenerator(zkp.secpZkp.ecc as never),
        );
        const blinder = new Blinder(
            pset,
            zkpGenerator.unblindInputs(pset),
            zkpValidator,
            zkpGenerator,
        );
        blinder.blindLast({ outputBlindingArgs });
    }

    const signer = new PsetSigner(pset);
    const pubkeyBuf = Buffer.from(wallet.spendPublicKey);
    const signatures: Buffer[] = [];

    for (let i = 0; i < utxos.length; i++) {
        const preimage = pset.getInputPreimage(
            i,
            LiquidTransaction.SIGHASH_ALL,
        );
        const derBytes = secp256k1.sign(preimage, wallet.spendPrivateKey, {
            prehash: false,
            format: "der",
        });
        const sigWithHashType = Buffer.concat([
            Buffer.from(derBytes),
            Buffer.from([0x01]),
        ]);
        signatures.push(sigWithHashType);

        signer.addSignature(
            i,
            {
                partialSig: {
                    pubkey: pubkeyBuf,
                    signature: sigWithHashType,
                },
            },
            Pset.ECDSASigValidator(zkp.secpZkp.ecc as never),
        );
    }

    const finalizer = new Finalizer(pset);
    for (let i = 0; i < utxos.length; i++) {
        finalizer.finalizeInput(i, () => ({
            finalScriptWitness: witnessStackToScriptWitness([
                signatures[i],
                pubkeyBuf,
            ]),
        }));
    }

    return Extractor.extract(pset).toHex();
};
