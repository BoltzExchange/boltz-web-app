import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { Buffer } from "buffer";
import {
    Transaction as LiquidTransaction,
    Pset,
    Signer,
    address as LiquidAddress,
    confidential,
    networks as LiquidNetworks,
    payments,
} from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { config } from "../config";
import secp from "../lazy/secp";
import type { RescueFile } from "./rescueFile";
import { derivationPath, mnemonicToHDKey } from "./rescueFile";

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
    const liquidNet =
        config.network === "mainnet" ? "liquid" : config.network;
    return LiquidNetworks[liquidNet] as LiquidNetwork;
};

/**
 * Derives a temporary Liquid P2WPKH wallet using the same key path as
 * the Boltz claim key (m/44/0/0/0/{index}). The blinding key is derived
 * deterministically as SHA256(spend_private_key), which allows reconstruction
 * from just the rescue mnemonic + key index.
 */
export const deriveTempLiquidWallet = (
    rescueFile: RescueFile,
    keyIndex: number,
): TempLiquidWallet => {
    const hdKey = mnemonicToHDKey(rescueFile.mnemonic);
    const spendKey = hdKey.derive(`${derivationPath}/${keyIndex}`);

    const spendPrivateKey = spendKey.privateKey;
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

    if (output.rangeProof?.length > 0) {
        const unblinded = confidentialInstance.unblindOutputWithKey(
            output,
            blindingPrivateKey,
        );

        return {
            txid,
            vout,
            asset: hex.encode(
                Buffer.from(unblinded.asset).reverse(),
            ),
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

    const value = confidential.confidentialValueToSatoshi(output.value);

    return {
        txid,
        vout,
        asset: hex.encode(
            Buffer.from(output.asset.subarray(1)).reverse(),
        ),
        value,
        assetBlindingFactor:
            "0000000000000000000000000000000000000000000000000000000000000000",
        valueBlindingFactor:
            "0000000000000000000000000000000000000000000000000000000000000000",
        witnessUtxo: rawWitnessUtxo,
        script: output.script.toString("hex"),
    };
};

export const findOutputForScript = async (
    txHex: string,
    targetScript: Buffer,
): Promise<number | undefined> => {
    const tx = LiquidTransaction.fromHex(txHex);

    for (let i = 0; i < tx.outs.length; i++) {
        if (tx.outs[i].script && targetScript.equals(tx.outs[i].script)) {
            return i;
        }
    }

    return undefined;
};

export const signPset = async (
    psetBase64: string,
    wallet: TempLiquidWallet,
): Promise<string> => {
    log.info("Signing SideSwap PSET with temp Liquid wallet");

    const pset = Pset.fromBase64(psetBase64);
    const signer = new Signer(pset);

    const pubkeyBuf = Buffer.from(wallet.spendPublicKey);

    for (let i = 0; i < pset.inputs.length; i++) {
        const input = pset.inputs[i];

        const witUtxo = input.witnessUtxo;
        if (!witUtxo) continue;

        if (!wallet.outputScript.equals(witUtxo.script)) continue;

        const preimage = pset.getInputPreimage(i, 0x01);
        const derBytes = secp256k1.sign(preimage, wallet.spendPrivateKey, {
            prehash: false,
            format: "der",
        });
        const sigWithHashType = Buffer.concat([
            Buffer.from(derBytes),
            Buffer.from([0x01]),
        ]);

        const validator = (
            pubkey: Buffer,
            msghash: Buffer,
            signature: Buffer,
        ): boolean =>
            secp256k1.verify(signature, msghash, pubkey, {
                prehash: false,
            });

        signer.addSignature(
            i,
            {
                partialSig: {
                    pubkey: pubkeyBuf,
                    signature: sigWithHashType,
                },
            },
            validator,
        );

        log.debug(`Signed PSET input ${i}`);
    }

    return pset.toBase64();
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
            const unblinded = await unblindOutput(txHex, i, blindingPrivateKey);
            utxos.push(unblinded);
        } catch (e) {
            log.warn(`Could not unblind output ${i}:`, e);
        }
    }

    return utxos;
};

/**
 * Build a Liquid transaction sweeping UTXOs from the temp wallet to a
 * destination address. Follows the same PSET construction + blinding
 * pattern as boltz-core's constructClaimTransaction for Liquid.
 *
 * TODO: This duplicates boltz-core's Liquid tx building logic and should
 * ideally be upstreamed as a generic P2WPKH sweep helper in boltz-core.
 */
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
        const decoded = LiquidAddress.fromConfidential(destinationAddress);
        destBlindingKey = decoded.blindingKey;
    } catch {
        // non-confidential address
    }

    const pset = Creator.newPset();
    const updater = new Updater(pset);

    const inputsAreConfidential = utxos.some(
        (u) => u.witnessUtxo?.rangeProof?.length > 0,
    );

    for (const [i, utxo] of utxos.entries()) {
        pset.addInput(
            new CreatorInput(utxo.txid, utxo.vout, 0xffffffff).toPartialInput(),
        );
        updater.addInSighashType(i, LiquidTransaction.SIGHASH_ALL);

        const witUtxo = utxo.witnessUtxo ?? {
            script: wallet.outputScript,
            asset: Buffer.concat([
                Buffer.from([0x01]),
                Buffer.from(hex.decode(utxo.asset)).reverse(),
            ]),
            value: confidential.satoshiToConfidentialValue(utxo.value),
            nonce: Buffer.alloc(1),
            rangeProof: Buffer.alloc(0),
            surjectionProof: Buffer.alloc(0),
        };
        updater.addInWitnessUtxo(i, witUtxo);
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
                blinderIndex:
                    destBlindingKey !== undefined ? 0 : undefined,
            },
        ]);
    }

    if (inputsAreConfidential && !destBlindingKey) {
        const OP_RETURN = 0x6a;
        const randomPubKey = Buffer.from(
            secp256k1.getPublicKey(secp256k1.utils.randomSecretKey()),
        );
        pset.addOutput(
            new CreatorOutput(
                lbtcAssetId,
                1,
                Buffer.of(OP_RETURN),
                randomPubKey,
                0,
            ).toPartialOutput(),
        );
        updater.addOutputs([{ amount: fee - 1, asset: lbtcAssetId }]);
    } else {
        updater.addOutputs([{ amount: fee, asset: lbtcAssetId }]);
    }

    if (inputsAreConfidential || destBlindingKey) {
        const blindingKeys = utxos.map(() =>
            inputsAreConfidential ? wallet.blindingPrivateKey : undefined,
        );
        const zkpGenerator = new ZKPGenerator(
            zkp.secpZkp,
            ZKPGenerator.WithBlindingKeysOfInputs(blindingKeys),
        );
        const zkpValidator = new ZKPValidator(zkp.secpZkp);
        const outputBlindingArgs = zkpGenerator.blindOutputs(
            pset,
            Pset.ECCKeysGenerator(zkp.secpZkp.ecc),
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
            Pset.ECDSASigValidator(zkp.secpZkp.ecc),
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
