import { Buffer } from "buffer";

Uint8Array.prototype.writeBigUInt64BE = function (int64, offset) {
    if (typeof int64 !== "number") {
        int64 = Number(int64);
    }

    const MAX_UINT32 = 0xffffffff; // 64 bits / 8 bytes.
    // write
    const big = ~~(int64 / MAX_UINT32); // ~~ is equivalent to Math.floor()
    const low = (int64 % MAX_UINT32) - big;

    if (!offset) {
        this.writeUInt32BE(big, 0);
        this.writeUInt32BE(low, 4);
        return this;
    } else {
        this.writeUInt32BE(big, offset);
        this.writeUInt32BE(low, offset + 4);
        return this;
    }
};

Buffer.isBuffer = function (b) {
    return (
        b != null &&
        (b._isBuffer === true || b instanceof Uint8Array) &&
        b !== Buffer.prototype
    );
};
