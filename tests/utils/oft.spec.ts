const { getOftReceivedEventByGuid } = await import("../../src/utils/oft/oft");

describe("oft", () => {
    test("should fetch the received event by guid", async () => {
        const provider = {
            getLogs: vi.fn().mockResolvedValue([
                {
                    data: "0x1234",
                    topics: ["0xtopic", "0xguid"],
                    index: 5,
                },
            ]),
        };
        const contract = {
            interface: {
                encodeFilterTopics: vi
                    .fn()
                    .mockReturnValue(["0xtopic", "0xguid"]),
                parseLog: vi.fn().mockReturnValue({
                    name: "OFTReceived",
                    args: {
                        guid: "0xguid",
                        srcEid: 40161n,
                        toAddress: "0x5000000000000000000000000000000000000000",
                        amountReceivedLD: 42n,
                    },
                }),
            },
        };

        await expect(
            getOftReceivedEventByGuid(
                contract as never,
                provider as never,
                "0x1000000000000000000000000000000000000000",
                "0xguid",
            ),
        ).resolves.toEqual({
            guid: "0xguid",
            srcEid: 40161n,
            toAddress: "0x5000000000000000000000000000000000000000",
            amountReceivedLD: 42n,
            logIndex: 5,
        });

        expect(provider.getLogs).toHaveBeenCalledWith({
            address: "0x1000000000000000000000000000000000000000",
            fromBlock: 0,
            toBlock: "latest",
            topics: ["0xtopic", "0xguid"],
        });
    });
});

export {};
