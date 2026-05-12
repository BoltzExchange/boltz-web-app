export const yParityFromV = (v: bigint): 0 | 1 => {
    if (v === 0n || v === 1n) {
        return Number(v) as 0 | 1;
    }
    if (v === 27n || v === 28n) {
        return Number(v - 27n) as 0 | 1;
    }
    if (v >= 35n) {
        return Number((v - 35n) % 2n) as 0 | 1;
    }
    throw new Error(`unexpected signature v: ${v}`);
};
