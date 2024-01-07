import { BTC } from "../consts";
import { asset, config } from "../signals";

const relevantMinerFees = (fees: any) => {
    return asset() === BTC
        ? fees.minerFees.quoteAsset
        : fees.minerFees.baseAsset;
};

export const feeChecker = (pairs: any) => {
    const fees = pairs[`${asset()}/${BTC}`].fees;
    const feesOld = config()[`${asset()}/${BTC}`].fees;

    return (
        JSON.stringify(relevantMinerFees(feesOld)) ===
            JSON.stringify(relevantMinerFees(fees)) &&
        ["percentage", "percentageSwapIn"].every(
            (fee) => feesOld[fee] === fees[fee],
        )
    );
};
