import dict from "../../src/i18n/i18n";
import { formatError } from "../../src/utils/errors";

const walletRequestRejected = dict.en.wallet_request_rejected;

describe("errors", () => {
    test.each`
        error                                                                                                                                                                                                                                                                                                                      | expected
        ${"test"}                                                                                                                                                                                                                                                                                                                  | ${"test"}
        ${21}                                                                                                                                                                                                                                                                                                                      | ${"21"}
        ${{ toString: () => "message" }}                                                                                                                                                                                                                                                                                           | ${"message"}
        ${{ some: "data" }}                                                                                                                                                                                                                                                                                                        | ${'{"some":"data"}'}
        ${{ message: "data" }}                                                                                                                                                                                                                                                                                                     | ${"data"}
        ${{ error: "more data" }}                                                                                                                                                                                                                                                                                                  | ${"more data"}
        ${"User denied transaction signature."}                                                                                                                                                                                                                                                                                    | ${walletRequestRejected}
        ${{ code: "ACTION_REJECTED", message: 'user rejected action (action="sendTransaction")' }}                                                                                                                                                                                                                                 | ${walletRequestRejected}
        ${{ info: { error: { code: 4001, message: "ethers-user-denied: MetaMask Tx Signature: User denied transaction signature." } } }}                                                                                                                                                                                           | ${walletRequestRejected}
        ${{ info: { error: { code: 4001, data: { cause: "rejectAllApprovals" }, message: 'user rejected action (action="sendTransaction", reason="rejected")' } }, message: 'user rejected action (action="sendTransaction", reason="rejected", info={ "error": { "code": 4001, "data": { "cause": "rejectAllApprovals" } } })' }} | ${walletRequestRejected}
    `("should format error to readable string", ({ error, expected }) => {
        expect(formatError(error)).toEqual(expected);
    });
});
