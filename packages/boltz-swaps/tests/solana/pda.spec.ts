import * as web3 from "@solana/web3.js";
import { derivePda } from "boltz-swaps/solana";

import {
    solanaMessageTransmitterV2,
    solanaTokenMessengerMinterV2,
} from "../fixtures/cctp.ts";

const modules = { web3 };
const encoder = new TextEncoder();
const seed = (value: string) => encoder.encode(value);
const pubkeyBytes = (value: string) =>
    new web3.PublicKey(value).toBytes() as Uint8Array;

describe("derivePda", () => {
    test.each`
        label                 | programId                       | seeds                                                                                      | expected
        ${"sender_authority"} | ${solanaTokenMessengerMinterV2} | ${[seed("sender_authority")]}                                                              | ${"45hzrGLQ2EGo1Ln7QpXjDwb589GDQ9H2aEXXw6ds6BFE"}
        ${"token_messenger"}  | ${solanaTokenMessengerMinterV2} | ${[seed("token_messenger")]}                                                               | ${"AawthJCGRmggpfv9MMWV6Jmo9cue4gL9wUZgRBShg58W"}
        ${"event_authority"}  | ${solanaTokenMessengerMinterV2} | ${[seed("__event_authority")]}                                                             | ${"6TCCnJ9R1m1RXFzyoH7GYH2J6NJDtZaUvfipPuLWxHNd"}
        ${"message_transmit"} | ${solanaMessageTransmitterV2}   | ${[seed("message_transmitter")]}                                                           | ${"W1k5ijkaSTo5iA5zChNpfzcy796fLhkBxfmJuR8W8HU"}
        ${"denylist_account"} | ${solanaTokenMessengerMinterV2} | ${[seed("denylist_account"), pubkeyBytes("6bGbFocpK9tzyDsZEWrQkixm6WCGsnqvYPcXpAR7Pc9t")]} | ${"2axUP37CCqYsdUhrC2DiScBmHGfFQQPcZicg7bDtYQCy"}
        ${"local_token"}      | ${solanaTokenMessengerMinterV2} | ${[seed("local_token"), pubkeyBytes("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")]}      | ${"CRBBbuLCyrkQy4dCTHxqstSmDQv4ajBeUVb9qUdMVaP1"}
        ${"remote_messenger"} | ${solanaTokenMessengerMinterV2} | ${[seed("remote_token_messenger"), seed("3")]}                                             | ${"53NSDvEXmUixWSsCQF5rnTxcKdihq19WXNaZFXrX3ojf"}
    `(
        "derives PDA for $label",
        ({
            programId,
            seeds,
            expected,
        }: {
            programId: string;
            seeds: Uint8Array[];
            expected: string;
        }) => {
            expect(derivePda(modules, programId, ...seeds)).toBe(expected);
        },
    );

    test("is deterministic across repeated calls", () => {
        const first = derivePda(
            modules,
            solanaTokenMessengerMinterV2,
            seed("sender_authority"),
        );
        const second = derivePda(
            modules,
            solanaTokenMessengerMinterV2,
            seed("sender_authority"),
        );
        expect(first).toBe(second);
    });

    test("returns different PDAs for different programs with the same seed", () => {
        const fromMinter = derivePda(
            modules,
            solanaTokenMessengerMinterV2,
            seed("message_transmitter"),
        );
        const fromTransmitter = derivePda(
            modules,
            solanaMessageTransmitterV2,
            seed("message_transmitter"),
        );
        expect(fromMinter).not.toBe(fromTransmitter);
    });

    test("returns different PDAs when an additional seed is appended", () => {
        const base = derivePda(
            modules,
            solanaTokenMessengerMinterV2,
            seed("local_token"),
        );
        const withMint = derivePda(
            modules,
            solanaTokenMessengerMinterV2,
            seed("local_token"),
            pubkeyBytes("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        );
        expect(base).not.toBe(withMint);
    });

    test("throws on a malformed program id", () => {
        expect(() =>
            derivePda(modules, "not-a-real-pubkey", seed("anything")),
        ).toThrow();
    });
});
