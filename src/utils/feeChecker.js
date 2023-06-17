import { config, asset } from "../signals.js";

export const feeChecker = (pairs) => {
    const oldHash = config()[`${asset()}/BTC`]["hash"];
    const hash = pairs[`${asset()}/BTC`]["hash"];
    return oldHash === hash;
};
