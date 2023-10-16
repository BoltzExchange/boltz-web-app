// From: https://github.com/bitcoinerlab/secp256k1/blob/main/index.js
/*
 * Copyright (c) 2023 Jose-Luis Landabaso
 * Distributed under the MIT software license.
 *
 * This file includes code from the following sources:
 *  * Paul Miller's @noble/secp256k1 (specifically, the privateAdd,
 *    privateNegate, pointAddScalar, and pointMultiply functions).
 *  * Some pieces from tiny-secp256k1
 *    (https://github.com/bitcoinjs/tiny-secp256k1)
 *  * It also uses code from BitGo's BitGoJS library
 *    (https://github.com/BitGo/BitGoJS)
 *
 * This package's tests are based on modified versions of tests from
 * tiny-secp256k1 (https://github.com/bitcoinjs/tiny-secp256k1/tests).
 */

import * as necc from "@noble/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

necc.utils.hmacSha256Sync = (key, ...msgs) =>
    hmac(sha256, key, necc.utils.concatBytes(...msgs));
necc.utils.sha256Sync = (...msgs) => sha256(necc.utils.concatBytes(...msgs));

const normalizePrivateKey = necc.utils._normalizePrivateKey;

const HASH_SIZE = 32;
const TWEAK_SIZE = 32;
const BN32_N = new Uint8Array([
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    254, 186, 174, 220, 230, 175, 72, 160, 59, 191, 210, 94, 140, 208, 54, 65,
    65,
]);
const EXTRA_DATA_SIZE = 32;

function cmpBN32(data1, data2) {
    for (let i = 0; i < 32; ++i) {
        if (data1[i] !== data2[i]) {
            return data1[i] < data2[i] ? -1 : 1;
        }
    }
    return 0;
}

function isTweak(tweak) {
    // Check that the tweak is a Uint8Array of the correct length
    if (
        !(tweak instanceof Uint8Array) ||
        tweak.length !== TWEAK_SIZE ||
        cmpBN32(tweak, BN32_N) >= 0
    ) {
        return false;
    }
    return true;
}

function isSignature(signature) {
    return (
        signature instanceof Uint8Array &&
        signature.length === 64 &&
        cmpBN32(signature.subarray(0, 32), BN32_N) < 0 &&
        cmpBN32(signature.subarray(32, 64), BN32_N) < 0
    );
}

function isHash(h) {
    return h instanceof Uint8Array && h.length === HASH_SIZE;
}

function isExtraData(e) {
    return (
        e === undefined ||
        (e instanceof Uint8Array && e.length === EXTRA_DATA_SIZE)
    );
}

function hexToNumber(hex) {
    if (typeof hex !== "string") {
        throw new TypeError("hexToNumber: expected string, got " + typeof hex);
    }
    return BigInt(`0x${hex}`);
}

function bytesToNumber(bytes) {
    return hexToNumber(necc.utils.bytesToHex(bytes));
}

function normalizeScalar(scalar) {
    let num;
    if (typeof scalar === "bigint") {
        num = scalar;
    } else if (
        typeof scalar === "number" &&
        Number.isSafeInteger(scalar) &&
        scalar >= 0
    ) {
        num = BigInt(scalar);
    } else if (typeof scalar === "string") {
        if (scalar.length !== 64)
            throw new Error("Expected 32 bytes of private scalar");
        num = hexToNumber(scalar);
    } else if (scalar instanceof Uint8Array) {
        if (scalar.length !== 32)
            throw new Error("Expected 32 bytes of private scalar");
        num = bytesToNumber(scalar);
    } else {
        throw new TypeError("Expected valid private scalar");
    }
    if (num < 0) throw new Error("Expected private scalar >= 0");
    return num;
}

const _privateAdd = (privateKey, tweak) => {
    const p = normalizePrivateKey(privateKey);
    const t = normalizeScalar(tweak);
    const add = necc.utils._bigintTo32Bytes(
        necc.utils.mod(p + t, necc.CURVE.n),
    );
    if (necc.utils.isValidPrivateKey(add)) return add;
    else return null;
};

const _privateSub = (privateKey, tweak) => {
    const p = normalizePrivateKey(privateKey);
    const t = normalizeScalar(tweak);
    const sub = necc.utils._bigintTo32Bytes(
        necc.utils.mod(p - t, necc.CURVE.n),
    );
    if (necc.utils.isValidPrivateKey(sub)) return sub;
    else return null;
};

const _privateNegate = (privateKey) => {
    const p = normalizePrivateKey(privateKey);
    const not = necc.utils._bigintTo32Bytes(necc.CURVE.n - p);
    if (necc.utils.isValidPrivateKey(not)) return not;
    else return null;
};

const _pointAddScalar = (p, tweak, isCompressed) => {
    const P = necc.Point.fromHex(p);
    const t = normalizeScalar(tweak);
    const Q = necc.Point.BASE.multiplyAndAddUnsafe(P, t, 1n);
    if (!Q) throw new Error("Tweaked point at infinity");
    return Q.toRawBytes(isCompressed);
};

const _pointMultiply = (p, tweak, isCompressed) => {
    const P = necc.Point.fromHex(p);
    const h = typeof tweak === "string" ? tweak : necc.utils.bytesToHex(tweak);
    const t = BigInt(`0x${h}`);
    return P.multiply(t).toRawBytes(isCompressed);
};

function assumeCompression(compressed, p) {
    if (compressed === undefined) {
        return p !== undefined ? isPointCompressed(p) : true;
    }
    return compressed ? true : false;
}

function throwToNull(fn) {
    try {
        return fn();
    } catch (e) {
        return null;
    }
}

function _isPoint(p, xOnly) {
    if ((p.length === 32) !== xOnly) return false;
    try {
        return !!necc.Point.fromHex(p);
    } catch (e) {
        return false;
    }
}

export function isPoint(p) {
    return _isPoint(p, false);
}

export function isPointCompressed(p) {
    const PUBLIC_KEY_COMPRESSED_SIZE = 33;
    return _isPoint(p, false) && p.length === PUBLIC_KEY_COMPRESSED_SIZE;
}

export function isPrivate(d) {
    return necc.utils.isValidPrivateKey(d);
}

export function isXOnlyPoint(p) {
    return _isPoint(p, true);
}

export function xOnlyPointAddTweak(p, tweak) {
    if (!isXOnlyPoint(p)) {
        throw new Error("Expected Point");
    }
    if (!isTweak(tweak)) {
        throw new Error("Expected Tweak");
    }
    return throwToNull(() => {
        const P = _pointAddScalar(p, tweak, true);
        const parity = P[0] % 2 === 1 ? 1 : 0;
        return { parity, xOnlyPubkey: P.slice(1) };
    });
}

export function xOnlyPointFromPoint(p) {
    if (!isPoint(p)) {
        throw new Error("Expected Point");
    }
    return p.slice(1, 33);
}

export function pointFromScalar(sk, compressed) {
    if (!isPrivate(sk)) {
        throw new Error("Expected Private");
    }
    return throwToNull(() =>
        necc.getPublicKey(sk, assumeCompression(compressed)),
    );
}

export function xOnlyPointFromScalar(d) {
    if (!isPrivate(d)) {
        throw new Error("Expected Private");
    }
    return xOnlyPointFromPoint(pointFromScalar(d));
}

export function pointCompress(p, compressed) {
    if (!isPoint(p)) {
        throw new Error("Expected Point");
    }
    return necc.Point.fromHex(p).toRawBytes(assumeCompression(compressed, p));
}

export function pointMultiply(a, tweak, compressed) {
    if (!isPoint(a)) {
        throw new Error("Expected Point");
    }
    if (!isTweak(tweak)) {
        throw new Error("Expected Tweak");
    }
    return throwToNull(() =>
        _pointMultiply(a, tweak, assumeCompression(compressed, a)),
    );
}

export function pointAdd(a, b, compressed) {
    if (!isPoint(a) || !isPoint(b)) {
        throw new Error("Expected Point");
    }
    return throwToNull(() => {
        const A = necc.Point.fromHex(a);
        const B = necc.Point.fromHex(b);
        if (A.equals(B.negate())) {
            //https://github.com/paulmillr/noble-secp256k1/issues/91
            return null;
        } else {
            return A.add(B).toRawBytes(assumeCompression(compressed, a));
        }
    });
}
export function pointAddScalar(p, tweak, compressed) {
    if (!isPoint(p)) {
        throw new Error("Expected Point");
    }
    if (!isTweak(tweak)) {
        throw new Error("Expected Tweak");
    }
    return throwToNull(() =>
        _pointAddScalar(p, tweak, assumeCompression(compressed, p)),
    );
}

export function privateAdd(d, tweak) {
    if (isPrivate(d) === false) {
        throw new Error("Expected Private");
    }
    if (isTweak(tweak) === false) {
        throw new Error("Expected Tweak");
    }
    return throwToNull(() => _privateAdd(d, tweak));
}

export function privateSub(d, tweak) {
    if (isPrivate(d) === false) {
        throw new Error("Expected Private");
    }
    if (isTweak(tweak) === false) {
        throw new Error("Expected Tweak");
    }
    return throwToNull(() => _privateSub(d, tweak));
}

export function privateNegate(d) {
    if (isPrivate(d) === false) {
        throw new Error("Expected Private");
    }
    return _privateNegate(d);
}

export function sign(h, d, e) {
    if (!isPrivate(d)) {
        throw new Error("Expected Private");
    }
    if (!isHash(h)) {
        throw new Error("Expected Scalar");
    }
    if (!isExtraData(e)) {
        throw new Error("Expected Extra Data (32 bytes)");
    }
    return necc.signSync(h, d, { der: false, extraEntropy: e });
}

export function signSchnorr(h, d, e = Buffer.alloc(32, 0x00)) {
    if (!isPrivate(d)) {
        throw new Error("Expected Private");
    }
    if (!isHash(h)) {
        throw new Error("Expected Scalar");
    }
    if (!isExtraData(e)) {
        throw new Error("Expected Extra Data (32 bytes)");
    }
    return necc.schnorr.signSync(h, d, e);
}

export function verify(h, Q, signature, strict) {
    if (!isPoint(Q)) {
        throw new Error("Expected Point");
    }
    if (!isSignature(signature)) {
        throw new Error("Expected Signature");
    }
    if (!isHash(h)) {
        throw new Error("Expected Scalar");
    }
    return necc.verify(signature, h, Q, { strict });
}

export function verifySchnorr(h, Q, signature) {
    if (!isXOnlyPoint(Q)) {
        throw new Error("Expected Point");
    }
    if (!isSignature(signature)) {
        throw new Error("Expected Signature");
    }
    if (!isHash(h)) {
        throw new Error("Expected Scalar");
    }
    return necc.schnorr.verifySync(signature, h, Q);
}
