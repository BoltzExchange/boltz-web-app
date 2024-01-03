import { BTC } from "../consts";

const relevantMinerFees = (fees: any, asset: string) => {
    return asset === BTC ? fees.minerFees.quoteAsset : fees.minerFees.baseAsset;
};

export const feeChecker = (config: any, configNew: any, asset: string) => {
    const fees = config[`${asset}/${BTC}`].fees;
    const feesNew = configNew[`${asset}/${BTC}`].fees;

    return (
        JSON.stringify(relevantMinerFees(fees, asset)) ===
            JSON.stringify(relevantMinerFees(feesNew, asset)) &&
        ["percentage", "percentageSwapIn"].every(
            (fee) => fees[fee] === feesNew[fee],
        )
    );
};
