import { config, asset } from "../signals.js";

export const feeChecker = (pairs) => {
    const oldCfg = config()[`${asset()}/BTC`];
    const minerFeesOld = oldCfg.fees.minerFees;
    const minerFees = pairs[`${asset()}/BTC`].fees.minerFees;
    if (minerFeesOld !== minerFees) {
        return false;
    }
    return true;
    // TODO: fix hashes in backend
    // const oldHash = config()[`${asset()}/BTC`]["hash"];
    // const hash = pairs[`${asset()}/BTC`]["hash"];
    // return oldHash === hash;
};
