import log from "loglevel";

log.setLevel("error");

vi.mock("ethers", () => ({
    JsonRpcProvider: vi.fn(),
    FallbackProvider: vi.fn(),
}));
