import { BTC } from "../consts";
import { config } from "../signals";

const relevantMinerFees = (fees: any, asset: string) => {
    return asset === BTC ? fees.minerFees.quoteAsset : fees.minerFees.baseAsset;
};

export const feeChecker = (pairs: any, asset: string) => {
    const fees = pairs[`${asset}/${BTC}`].fees;
    const feesOld = config()[`${asset}/${BTC}`].fees;

    return (
        JSON.stringify(relevantMinerFees(feesOld, asset)) ===
            JSON.stringify(relevantMinerFees(fees, asset)) &&
        ["percentage", "percentageSwapIn"].every(
            (fee) => feesOld[fee] === fees[fee],
        )
    );
};
