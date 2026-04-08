// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { OftDirectSendTarget } from "../../src/utils/oft/directSend";

type MockOftContract = {
    name: string;
    address: string;
    explorer: string;
};

type MockOftChain = {
    contracts: MockOftContract[];
};

type MockTokenConfig = {
    address: string;
};

type MockTransaction = {
    hash: string;
    wait: ReturnType<typeof vi.fn>;
};

type MockOftContractInstance = {
    approvalRequired: () => Promise<boolean>;
    send: (...args: unknown[]) => Promise<MockTransaction>;
};

const {
    mockSendOFT,
    mockCreateEvmOftContract,
    mockRequireTokenConfig,
    mockGetOftContract,
    mockGetOftChain,
    mockFindOftChainContract,
    mockEthersContract,
} = vi.hoisted(() => {
    const mockSendOFT =
        vi.fn<(...args: unknown[]) => Promise<MockTransaction>>();

    return {
        mockSendOFT,
        mockCreateEvmOftContract:
            vi.fn<(...args: unknown[]) => MockOftContractInstance>(),
        mockRequireTokenConfig: vi.fn<(asset: string) => MockTokenConfig>(),
        mockGetOftContract:
            vi.fn<(...args: unknown[]) => Promise<MockOftContract>>(),
        mockGetOftChain: vi.fn<(...args: unknown[]) => Promise<MockOftChain>>(),
        mockFindOftChainContract:
            vi.fn<(...args: unknown[]) => MockOftContract | undefined>(),
        mockEthersContract: vi.fn(function MockContract() {
            return {
                sendOFT: (...args: unknown[]) => mockSendOFT(...args),
            };
        }),
    };
});

vi.mock("ethers", () => ({
    Contract: mockEthersContract,
}));

vi.mock("../../src/config", () => ({
    config: {
        assets: {
            "USDT0-ETH": {
                network: {
                    chainName: "Ethereum",
                },
            },
            "USDT0-TEMPO": {
                network: {
                    chainName: "Tempo",
                },
            },
        },
    },
}));

vi.mock("../../src/consts/Assets", () => ({
    requireTokenConfig: (asset: string) => mockRequireTokenConfig(asset),
}));

vi.mock("../../src/utils/oft/evm", () => ({
    createEvmOftContract: (...args: unknown[]) =>
        mockCreateEvmOftContract(...args),
}));

vi.mock("../../src/utils/oft/oft", () => ({
    getBufferedOftNativeFee: (nativeFee: bigint) => (nativeFee * 110n) / 100n,
}));

vi.mock("../../src/utils/oft/registry", () => ({
    defaultOftName: "usdt0",
    findOftChainContract: (...args: unknown[]) =>
        mockFindOftChainContract(...args),
    getOftChain: (...args: unknown[]) => mockGetOftChain(...args),
    getOftContract: (...args: unknown[]) => mockGetOftContract(...args),
}));

const {
    OftDirectSendTargetKind,
    getOftDirectRequiredNativeBalance,
    getOftDirectRequiredTokenAmount,
    getOftDirectSendTarget,
    requiresOftDirectUserApproval,
    sendOftDirect,
} = await import("../../src/utils/oft/directSend");

const oftContract = {
    name: "OFT",
    address: "0x1000000000000000000000000000000000000001",
    explorer: "",
};
const tempoWrapperContract = {
    name: "TempoOFTWrapper",
    address: "0x2000000000000000000000000000000000000002",
    explorer: "",
};
const mockRunner = { runner: "mock" };
const sendParam: [number, string, bigint, bigint, string, string, string] = [
    30410,
    "0x3000000000000000000000000000000000000000",
    123n,
    120n,
    "0x",
    "0x",
    "0x",
];
const msgFee: [bigint, bigint] = [7n, 0n];

const createMockTransaction = (hash: string): MockTransaction => ({
    hash,
    wait: vi.fn(),
});

const getOftTarget = (): OftDirectSendTarget => ({
    kind: OftDirectSendTargetKind.Oft,
    oftContract,
    executionContract: oftContract,
});

const getTempoWrapperTarget = (): OftDirectSendTarget => ({
    kind: OftDirectSendTargetKind.TempoWrapper,
    oftContract,
    executionContract: tempoWrapperContract,
    feeTokenAddress: "0x4000000000000000000000000000000000000004",
});

describe("directSend", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockRequireTokenConfig.mockReturnValue({
            address: "0x4000000000000000000000000000000000000004",
        });
        mockGetOftContract.mockResolvedValue(oftContract);
        mockGetOftChain.mockResolvedValue({
            contracts: [tempoWrapperContract],
        });
        mockFindOftChainContract.mockReturnValue(tempoWrapperContract);
        mockCreateEvmOftContract.mockReturnValue({
            approvalRequired: vi.fn().mockResolvedValue(false),
            send: vi.fn().mockResolvedValue(createMockTransaction("0xsend")),
        });
        mockSendOFT.mockResolvedValue(createMockTransaction("0xwrapper"));
    });

    test("returns the primary OFT target for non-Tempo assets", async () => {
        await expect(
            getOftDirectSendTarget({
                from: "USDT0-ETH",
                to: "USDT0-ETH",
            }),
        ).resolves.toEqual(getOftTarget());

        expect(mockGetOftChain).not.toHaveBeenCalled();
        expect(mockFindOftChainContract).not.toHaveBeenCalled();
    });

    test("returns the Tempo wrapper target for Tempo assets", async () => {
        await expect(
            getOftDirectSendTarget({
                from: "USDT0-TEMPO",
                to: "USDT0-ETH",
            }),
        ).resolves.toEqual(getTempoWrapperTarget());

        expect(mockGetOftChain).toHaveBeenCalledWith(
            "USDT0-TEMPO",
            {
                from: "USDT0-TEMPO",
                to: "USDT0-ETH",
            },
            "usdt0",
        );
        expect(mockFindOftChainContract).toHaveBeenCalledWith(
            { contracts: [tempoWrapperContract] },
            ["TempoOFTWrapper"],
        );
    });

    test("throws when the Tempo wrapper is missing", async () => {
        mockFindOftChainContract.mockReturnValue(undefined);

        await expect(
            getOftDirectSendTarget({
                from: "USDT0-TEMPO",
                to: "USDT0-ETH",
            }),
        ).rejects.toThrow(
            "Missing Tempo OFT wrapper for route USDT0-TEMPO -> USDT0-ETH",
        );
    });

    test("calculates required token and native balances per target kind", () => {
        expect(
            getOftDirectRequiredTokenAmount(getOftTarget(), 123n, msgFee),
        ).toBe(123n);
        expect(getOftDirectRequiredNativeBalance(getOftTarget(), msgFee)).toBe(
            7n,
        );

        expect(
            getOftDirectRequiredTokenAmount(
                getTempoWrapperTarget(),
                123n,
                msgFee,
            ),
        ).toBe(130n);
        expect(
            getOftDirectRequiredNativeBalance(getTempoWrapperTarget(), msgFee),
        ).toBe(0n);
    });

    test("delegates approval checks to the OFT contract when needed", async () => {
        const approvalRequired = vi.fn().mockResolvedValue(true);
        mockCreateEvmOftContract.mockReturnValue({
            approvalRequired,
            send: vi.fn(),
        });

        await expect(
            requiresOftDirectUserApproval(getOftTarget(), mockRunner as never),
        ).resolves.toBe(true);

        expect(mockCreateEvmOftContract).toHaveBeenCalledWith(
            oftContract.address,
            mockRunner,
        );
        expect(approvalRequired).toHaveBeenCalledTimes(1);
    });

    test("always requires direct user approval for Tempo wrapper sends", async () => {
        await expect(
            requiresOftDirectUserApproval(
                getTempoWrapperTarget(),
                mockRunner as never,
            ),
        ).resolves.toBe(true);

        expect(mockCreateEvmOftContract).not.toHaveBeenCalled();
    });

    test("sends directly through the OFT contract for standard targets", async () => {
        const send = vi.fn().mockResolvedValue(createMockTransaction("0xsend"));
        mockCreateEvmOftContract.mockReturnValue({
            approvalRequired: vi.fn(),
            send,
        });

        await expect(
            sendOftDirect({
                target: getOftTarget(),
                runner: mockRunner as never,
                sendParam,
                msgFee,
                refundAddress: "0x5000000000000000000000000000000000000005",
            }),
        ).resolves.toMatchObject({
            hash: "0xsend",
        });

        expect(send).toHaveBeenCalledWith(
            sendParam,
            msgFee,
            "0x5000000000000000000000000000000000000005",
            {
                value: msgFee[0],
            },
        );
    });

    test("sends through the Tempo wrapper when the target requires it", async () => {
        await expect(
            sendOftDirect({
                target: getTempoWrapperTarget(),
                runner: mockRunner as never,
                sendParam,
                msgFee,
                refundAddress: "0x5000000000000000000000000000000000000005",
            }),
        ).resolves.toMatchObject({
            hash: "0xwrapper",
        });

        expect(mockEthersContract).toHaveBeenCalledWith(
            tempoWrapperContract.address,
            expect.any(Array),
            mockRunner,
        );
        expect(mockSendOFT).toHaveBeenCalledWith(
            oftContract.address,
            "0x4000000000000000000000000000000000000004",
            sendParam,
            msgFee[0],
        );
    });
});
