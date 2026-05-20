export type BridgeRoute<A extends string = string> = {
    sourceAsset: A;
    destinationAsset: A;
};
