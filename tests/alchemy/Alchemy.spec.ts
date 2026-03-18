import type { TransactionRequest } from "ethers";

import { toAlchemyCall } from "../../src/alchemy/Alchemy";

describe("Alchemy", () => {
    describe("toAlchemyCall", () => {
        test("should convert populated transaction fields to an Alchemy call", () => {
            const transaction: TransactionRequest = {
                to: "0x1000000000000000000000000000000000000000",
                data: "0x1234",
                value: 5n,
            };

            expect(toAlchemyCall(transaction)).toEqual({
                to: "0x1000000000000000000000000000000000000000",
                data: "0x1234",
                value: "5",
            });
        });

        test("should throw when the transaction destination address is missing", () => {
            const transaction: TransactionRequest = {
                data: "0x1234",
            };

            expect(() => toAlchemyCall(transaction)).toThrow(
                "transaction is missing destination address",
            );
        });
    });
});
