import { crypto as bcrypto } from 'bitcoinjs-lib';
import { createHmac } from 'create-hmac';
import * as necc  from '@noble/secp256k1';
import { ECPairFactory } from 'ecpair';

necc.utils.sha256Sync = (...messages) => {
  return bcrypto.sha256(Buffer.concat(messages));
};
necc.utils.hmacSha256Sync = (key, ...messages) => {
  const hash = createHmac('sha256', Buffer.from(key));
  messages.forEach(m => hash.update(m));
  return Uint8Array.from(hash.digest());
};

const normalizePrivateKey = necc.utils._normalizePrivateKey;
function hexToNumber(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError('hexToNumber: expected string, got ' + typeof hex);
  }
  return BigInt(`0x${hex}`);
}
function bytesToNumber(bytes) {
  return hexToNumber(necc.utils.bytesToHex(bytes));
}
function normalizeScalar(scalar) {
  let num;
  if (typeof scalar === 'bigint') {
    num = scalar;
  } else if (
    typeof scalar === 'number' &&
    Number.isSafeInteger(scalar) &&
    scalar >= 0
  ) {
    num = BigInt(scalar);
  } else if (typeof scalar === 'string') {
    if (scalar.length !== 64)
      throw new Error('Expected 32 bytes of private scalar');
    num = hexToNumber(scalar);
  } else if (scalar instanceof Uint8Array) {
    if (scalar.length !== 32)
      throw new Error('Expected 32 bytes of private scalar');
    num = bytesToNumber(scalar);
  } else {
    throw new TypeError('Expected valid private scalar');
  }
  if (num < 0) throw new Error('Expected private scalar >= 0');
  return num;
}
const privateAdd = (privateKey, tweak) => {
  const p = normalizePrivateKey(privateKey);
  const t = normalizeScalar(tweak);
  const add = necc.utils._bigintTo32Bytes(necc.utils.mod(p + t, necc.CURVE.n));
  if (necc.utils.isValidPrivateKey(add)) return add;
  else return null;
};
const privateNegate = privateKey => {
  const p = normalizePrivateKey(privateKey);
  const not = necc.utils._bigintTo32Bytes(necc.CURVE.n - p);
  if (necc.utils.isValidPrivateKey(not)) return not;
  else return null;
};
const pointAddScalar = (p, tweak, isCompressed) => {
  const P = necc.Point.fromHex(p);
  const t = normalizeScalar(tweak);
  const Q = necc.Point.BASE.multiplyAndAddUnsafe(P, t, 1n);
  if (!Q) throw new Error('Tweaked point at infinity');
  return Q.toRawBytes(isCompressed);
};
const pointMultiply = (p, tweak, isCompressed) => {
  const P = necc.Point.fromHex(p);
  const h = typeof tweak === 'string' ? tweak : necc.utils.bytesToHex(tweak);
  const t = BigInt(`0x${h}`);
  return P.multiply(t).toRawBytes(isCompressed);
};

const defaultTrue = param => param !== false;
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
const ecc = {
  isPoint: p => _isPoint(p, false),
  isPrivate: d => necc.utils.isValidPrivateKey(d),
  isXOnlyPoint: p => _isPoint(p, true),
  xOnlyPointAddTweak: (p, tweak) =>
    throwToNull(() => {
      const P = pointAddScalar(p, tweak, true);
      const parity = P[0] % 2 === 1 ? 1 : 0;
      return { parity, xOnlyPubkey: P.slice(1) };
    }),
  pointFromScalar: (sk, compressed) =>
    throwToNull(() => necc.getPublicKey(sk, defaultTrue(compressed))),
  pointCompress: (p, compressed) => {
    return necc.Point.fromHex(p).toRawBytes(defaultTrue(compressed));
  },
  pointMultiply: (a, tweak, compressed) =>
    throwToNull(() => pointMultiply(a, tweak, defaultTrue(compressed))),
  pointAdd: (a, b, compressed) =>
    throwToNull(() => {
      const A = necc.Point.fromHex(a);
      const B = necc.Point.fromHex(b);
      return A.add(B).toRawBytes(defaultTrue(compressed));
    }),
  pointAddScalar: (p, tweak, compressed) =>
    throwToNull(() => pointAddScalar(p, tweak, defaultTrue(compressed))),
  privateAdd: (d, tweak) => throwToNull(() => privateAdd(d, tweak)),
  privateNegate: d => privateNegate(d),
  sign: (h, d, e) => {
    return necc.signSync(h, d, { der: false, extraEntropy: e });
  },
  signSchnorr: (h, d, e = Buffer.alloc(32, 0x00)) => {
    return necc.schnorr.signSync(h, d, e);
  },
  verify: (h, Q, signature, strict) => {
    return necc.verify(signature, h, Q, { strict });
  },
  verifySchnorr: (h, Q, signature) => {
    return necc.schnorr.verifySync(signature, h, Q);
  }
};

export const ECPair = ECPairFactory(ecc);
