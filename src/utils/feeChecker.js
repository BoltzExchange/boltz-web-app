import { config, asset } from "../signals.js";

export const feeChecker = (pairs) => {
    const oldHash = config()[`${asset()}/BTC`]["hash"];
    const hash = pairs[`${asset()}/BTC`]["hash"];
    console.log(`oldHash: ${oldHash}`);
    console.log(`hash: ${hash}`);
    if (oldHash === hash) {
        return true;
    }
    return false;
};
