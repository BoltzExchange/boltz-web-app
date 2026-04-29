import {
    cctpForwardHookData,
    createCctpSolanaForwardHookData,
} from "../../src/utils/cctp/evm";

describe("cctp evm helpers", () => {
    test.each([
        {
            recipient: "11111111111111111111111111111111",
            expected:
                "0x636374702d666f72776172640000000000000000000000000000000000000021010000000000000000000000000000000000000000000000000000000000000000",
        },
        {
            recipient: "EwwMqF8sFZRBGLchFfq61g5U7mPB14EnXxLQDWb5VAe5",
            expected:
                "0x636374702d666f7277617264000000000000000000000000000000000000002101cf3ac201d92eadcae0cd69b431f4c0e6d96c06bdb2fa28271b00409b5f1622ca",
        },
    ])(
        "createCctpSolanaForwardHookData encodes Solana recipient $recipient",
        ({ recipient, expected }) => {
            expect(createCctpSolanaForwardHookData(recipient)).toBe(expected);
        },
    );

    test("keeps the EVM forwarding hook data unchanged", () => {
        expect(cctpForwardHookData).toBe(
            "0x636374702d666f72776172640000000000000000000000000000000000000000",
        );
    });
});
