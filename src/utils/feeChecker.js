import { config, asset } from "../signals.js";

export const feeChecker = (pairs) => {
    const oldCfg = config()[`${asset()}/BTC`];
    const minerFeesOld = oldCfg.fees.minerFees;
    const minerFees = pairs[`${asset()}/BTC`].fees.minerFees;
    if (minerFeesOld.baseAsset.normal !== minerFees.baseAsset.normal
        || minerFeesOld.baseAsset.reverse.claim !== minerFees.baseAsset.reverse.claim
        || minerFeesOld.baseAsset.reverse.lockup !== minerFees.baseAsset.reverse.lockup
        || minerFeesOld.quoteAsset.normal !== minerFees.quoteAsset.normal
        || minerFeesOld.quoteAsset.reverse.claim !== minerFees.quoteAsset.reverse.claim
        || minerFeesOld.quoteAsset.reverse.lockup !== minerFees.quoteAsset.reverse.lockup
    ) {
        return false
    }
    return true;
    // TODO: fix hashes in backend
    // const oldHash = config()[`${asset()}/BTC`]["hash"];
    // const hash = pairs[`${asset()}/BTC`]["hash"];
    // return oldHash === hash;
};
