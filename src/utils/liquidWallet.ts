import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { Buffer } from "buffer";
import {
    Transaction as LiquidTransaction,
    address as LiquidAddress,
    confidential,
    networks as LiquidNetworks,
    payments,
} from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import { Pset, Signer } from "liquidjs-lib/src/psetv2";
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
            assetBlindingFactor: hex.encode(unblinded.assetBlindingFactor),
            valueBlindingFactor: hex.encode(unblinded.valueBlindingFactor),
            script: output.script.toString("hex"),
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
        ): boolean => {
            const sigOnly = signature.subarray(0, signature.length - 1);
            return secp256k1.verify(sigOnly, msghash, pubkey, {
                prehash: false,
                format: "der",
            });
        };

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

export const buildSweepTransaction = async (
    utxo: UnblindedUtxo,
    wallet: TempLiquidWallet,
    destinationAddress: string,
    feeRate: number,
): Promise<string> => {
    return buildMultiAssetSweepTransaction(
        [utxo],
        wallet,
        destinationAddress,
        feeRate,
    );
};

/**
 * Build a Liquid transaction sweeping multiple UTXOs (possibly different
 * assets) from the temp wallet to a single destination address. L-BTC
 * is used to pay the network fee; if no L-BTC UTXO is present, the call
 * throws.
 */
export const buildMultiAssetSweepTransaction = async (
    utxos: UnblindedUtxo[],
    wallet: TempLiquidWallet,
    destinationAddress: string,
    feeRate: number,
): Promise<string> => {
    const { Creator, Updater, Finalizer, Extractor } = await import(
        "liquidjs-lib/src/psetv2"
    );

    const network = getLiquidNetwork();
    const lbtcAssetId = network.assetHash;

    const estimatedVsize = 150 + utxos.length * 150;
    const fee = Math.ceil(feeRate * estimatedVsize);

    const destScript = LiquidAddress.toOutputScript(
        destinationAddress,
        network,
    );

    const pset = Creator.newPset();
    const updater = new Updater(pset);

    for (const utxo of utxos) {
        const assetPrefix = Buffer.concat([
            Buffer.from([0x01]),
            Buffer.from(hex.decode(utxo.asset)).reverse(),
        ]);
        const valueEncoded = confidential.satoshiToConfidentialValue(
            utxo.value,
        );

        updater.addInputs([
            {
                txid: utxo.txid,
                txIndex: utxo.vout,
                sighashType: 0x01,
                witnessUtxo: {
                    script: wallet.outputScript,
                    asset: assetPrefix,
                    value: valueEncoded,
                    nonce: Buffer.alloc(1),
                    rangeProof: Buffer.alloc(0),
                    surjectionProof: Buffer.alloc(0),
                },
            },
        ]);
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

    const outputs: { asset: string; amount: number; script?: Buffer }[] = [];
    for (const [assetId, total] of assetTotals) {
        let amount = total;
        if (assetId === lbtcAssetId) {
            amount -= fee;
            if (amount <= 0) continue;
        }
        outputs.push({ asset: assetId, amount, script: destScript });
    }

    outputs.push({ asset: lbtcAssetId, amount: fee });

    updater.addOutputs(outputs);

    const signed = await signPset(pset.toBase64(), wallet);
    const finalPset = Pset.fromBase64(signed);

    const finalizer = new Finalizer(finalPset);
    finalizer.finalize();

    return Extractor.extract(finalPset).toHex();
};
