import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import log from "loglevel";
import { vi } from "vitest";

import { BackupDone } from "../../src/components/CreateButton";
import { SwapType } from "../../src/consts/Enums";
import BackupVerify from "../../src/pages/BackupVerify";
import type { RestorableSwap } from "../../src/utils/boltzClient";
import { getRestorableSwaps } from "../../src/utils/boltzClient";
import { TestComponent, contextWrapper } from "../helper";

const navigate = vi.fn();

const existingRescueFile = {
    mnemonic:
        "horse olympic laundry marriage material private arch civil theory crew alone thank",
};

const invalidRescueFile = {
    mnemonic: "invalid mnemonic",
};

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual("@solidjs/router");
    return {
        ...actual,
        useParams: vi.fn(() => ({ type: "existing" })),
        useSearchParams: vi.fn(() => [{ mode: undefined }, vi.fn()]),
        useNavigate: () => navigate,
    };
});

vi.mock("../../src/utils/boltzClient", () => ({
    getRestorableSwaps: vi.fn(),
}));
const mockGetRestorableSwaps = vi.mocked(getRestorableSwaps);

const submarineSwapMock = {
    id: "someId",
    type: SwapType.Submarine,
    status: "transaction.claimed",
    createdAt: 1754409243,
    from: "BTC",
    to: "BTC",
    refundDetails: {
        tree: {
            claimLeaf: {
                version: 192,
                output: "a914aa856454ae0e8e8e0bf3e625421e13e168bd9d5d8820395d9749b27c5908e2e8e95237cf8d1c704c48b19e51f915c9986a1973925567ac",
            },
            refundLeaf: {
                version: 192,
                output: "208f7d52e62a440dec6c17cf929889df5abdbe85158834cf5d67e0f957b7ccee53ad02ca04b1",
            },
        },
        keyIndex: 1,
        lockupAddress:
            "bcrt1ptwl8vqkgrxz9ydyv5zx8qluv2mpjkg58qry2xvf2qeek7l9uxpusm4tlgf",
        serverPublicKey:
            "02395d9749b27c5908e2e8e95237cf8d1c704c48b19e51f915c9986a1973925567",
        timeoutBlockHeight: 1226,
    },
};

const chainSwapMock = {
    id: "someId",
    type: SwapType.Chain,
    status: "transaction.claimed",
    createdAt: 1754393223,
    from: "BTC",
    to: "L-BTC",
    claimDetails: {
        tree: {
            claimLeaf: {
                version: 196,
                output: "82012088a9146e09edd46f70b8d0035a9195f7e4fb4a0af1a16b8820c6de498c13cc2a717bcb7114c58539ff9fa608e764357d9c0838ad279248c481ac",
            },
            refundLeaf: {
                version: 196,
                output: "20c4b06805b2103b001673228719c7605d12072d2eaee379b7403f4cd81c2202fbad023806b1",
            },
        },
        keyIndex: 2,
        lockupAddress:
            "el1pqf2u5t5sfge2xtnpwqknlcdpkg0284eeq9hfdm4jpt77g5ps8lfx8sne6x2kzn9hg5x095ycd32wrfwqa0jr0qhjjdx80v6phcnhlvqr9lj09vwxz8fu",
        serverPublicKey:
            "02c4b06805b2103b001673228719c7605d12072d2eaee379b7403f4cd81c2202fb",
        timeoutBlockHeight: 1592,
        blindingKey:
            "1b902bad78087d70da1bbf8ab3f3ef3f4cb5db1e0053d93cdd851433413cd04c",
        preimageHash:
            "645b96d60cfe22db83dccff27877fe54347da9ba1bb77ad8df2d23ae5c26dba7",
    },
    refundDetails: {
        tree: {
            claimLeaf: {
                version: 192,
                output: "82012088a9146e09edd46f70b8d0035a9195f7e4fb4a0af1a16b8820611b80e6aa832718caae89c59f16576888db6f911f88c2d1fc3533bee7efc61fac",
            },
            refundLeaf: {
                version: 192,
                output: "20a1ca4a8dbc2e6854a748bc46725b311949f69c5a489448790a5a91dcff1d46ccad029a01b1",
            },
        },
        keyIndex: 3,
        lockupAddress:
            "bcrt1p65uysd60whv5qs3q38u3jhg0sz3rcujhzty7wf3gfeuawqxpunusqf4pty",
        serverPublicKey:
            "03611b80e6aa832718caae89c59f16576888db6f911f88c2d1fc3533bee7efc61f",
        timeoutBlockHeight: 410,
    },
};

const reverseSwapMock = {
    id: "someId",
    type: SwapType.Reverse,
    status: "swap.created",
    createdAt: 1754401653,
    from: "BTC",
    to: "BTC",
    claimDetails: {
        tree: {
            claimLeaf: {
                version: 192,
                output: "82012088a9145a1cb00f37e1bfd7b02fdd000df48a76ae05b45f882039e7203dd04e7f516a86ebe1986694daa0e7d43282da3e8098160700a5ae1c53ac",
            },
            refundLeaf: {
                version: 192,
                output: "203bc84f2d2fc8bf404d3c145bff65e6c77202a94042f926ecd53c735cbf27697cad026901b1",
            },
        },
        keyIndex: 4,
        lockupAddress:
            "bcrt1pczasza47rnzyy7h08qxj94p2uxvcv9nfdvnmm7x8few5k868g0lq484tzq",
        serverPublicKey:
            "033bc84f2d2fc8bf404d3c145bff65e6c77202a94042f926ecd53c735cbf27697c",
        timeoutBlockHeight: 361,
    },
};

const restorableSwapsMock: RestorableSwap[] = [
    submarineSwapMock,
    chainSwapMock,
    reverseSwapMock,
];

describe("BackupVerify", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        log.disableAll();
    });

    test("should verify existing rescue file", async () => {
        const user = userEvent.setup();
        mockGetRestorableSwaps.mockResolvedValue(restorableSwapsMock);

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerify />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const fileInput = screen.getByTestId("rescueFileUpload");

        File.prototype.text = vi
            .fn()
            .mockResolvedValue(JSON.stringify(existingRescueFile));

        await user.upload(
            fileInput,
            new File([], "rescueFile.json", {
                type: "application/json",
            }),
        );

        await waitFor(() => {
            expect(navigate).toHaveBeenCalledWith("/swap", {
                state: {
                    backupDone: BackupDone.True,
                },
            });
        });
    });

    test("should not verify invalid rescue file", async () => {
        const user = userEvent.setup();
        mockGetRestorableSwaps.mockResolvedValue(restorableSwapsMock);

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerify />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const fileInput = screen.getByTestId("rescueFileUpload");

        File.prototype.text = vi
            .fn()
            .mockResolvedValue(JSON.stringify(invalidRescueFile));

        await user.upload(
            fileInput,
            new File([], "rescueFile.json", {
                type: "application/json",
            }),
        );

        await waitFor(() => {
            expect(navigate).not.toHaveBeenCalled();
        });
    });

    test("should prefer refundDetails' keyIndex over claimDetails' keyIndex", async () => {
        const user = userEvent.setup();
        const refundDetailsIndex = 11;
        mockGetRestorableSwaps.mockResolvedValue([
            ...restorableSwapsMock,
            {
                ...chainSwapMock,
                claimDetails: {
                    ...chainSwapMock.claimDetails,
                    keyIndex: 10,
                },
                refundDetails: {
                    ...chainSwapMock.refundDetails,
                    keyIndex: refundDetailsIndex,
                },
            },
        ]);

        render(
            () => (
                <>
                    <TestComponent />
                    <BackupVerify />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const fileInput = screen.getByTestId("rescueFileUpload");

        File.prototype.text = vi
            .fn()
            .mockResolvedValue(JSON.stringify(existingRescueFile));

        await user.upload(
            fileInput,
            new File([], "rescueFile.json", {
                type: "application/json",
            }),
        );

        await waitFor(() => {
            const storedKey = localStorage.getItem("lastUsedKey");
            expect(storedKey).toBe((refundDetailsIndex + 1).toString());
            expect(navigate).toHaveBeenCalledWith("/swap", {
                state: {
                    backupDone: BackupDone.True,
                },
            });
        });
    });
});
