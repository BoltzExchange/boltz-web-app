// Mirrors the on-chain Router.CctpData struct (see Router.sol). Used for
// router-mediated flows (`executeCctp`, `claimERC20ExecuteCctp`, `hashCctpData`).
export type CctpData = {
    destinationDomain: number;
    // bytes32 — left-padded recipient address on the destination domain.
    mintRecipient: string;
    // bytes32 — zero = anyone may finalize (permissionless attest + mint).
    destinationCaller: string;
    // Maximum CCTP burn fee the signer is willing to tolerate, denominated in the burn token.
    maxFee: bigint;
    // Minimum block-finality threshold for the burn (1000 = Fast, 2000 = Standard).
    minFinalityThreshold: number;
    // Hook payload forwarded to the destination `depositForBurnWithHook` path (0x = none).
    hookData: string;
};

// Super-set of CctpData that carries the burn `amount` too. Direct sends to
// the TokenMessenger need `amount`; router paths project it out via
// `toCctpData`.
export type CctpSendParam = CctpData & {
    amount: bigint;
};
