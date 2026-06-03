import { describe, expect, test, vi } from "vitest";

import { useParentNotifier } from "../../src/utils/notifyParent";

const { embeddedModeMock, parentOriginMock } = vi.hoisted(() => ({
    embeddedModeMock: vi.fn(),
    parentOriginMock: vi.fn(),
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        embeddedMode: embeddedModeMock,
        parentOrigin: parentOriginMock,
    }),
}));

describe("useParentNotifier", () => {
    const postMessageMock = vi.fn();
    const mockParent = { postMessage: postMessageMock } as unknown as Window;

    beforeEach(() => {
        embeddedModeMock.mockReturnValue(true);
        parentOriginMock.mockReturnValue("https://example.com");
        Object.defineProperty(window, "parent", {
            value: mockParent,
            writable: true,
            configurable: true,
        });
        postMessageMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("sends postMessage when embedded mode is active with a parent origin", () => {
        const { notifyParent } = useParentNotifier();
        const message = { type: "test" as string, data: "hello" };

        notifyParent(message);

        expect(postMessageMock).toHaveBeenCalledTimes(1);
        expect(postMessageMock).toHaveBeenCalledWith(
            message,
            "https://example.com",
        );
    });

    test("does not send postMessage when not in embedded mode", () => {
        embeddedModeMock.mockReturnValue(false);
        const { notifyParent } = useParentNotifier();

        notifyParent({ type: "test" });

        expect(postMessageMock).not.toHaveBeenCalled();
    });

    test("does not send postMessage when parentOrigin is not set", () => {
        parentOriginMock.mockReturnValue(undefined);
        const { notifyParent } = useParentNotifier();

        notifyParent({ type: "test" });

        expect(postMessageMock).not.toHaveBeenCalled();
    });

    test("does not send postMessage when window is not inside an iframe", () => {
        Object.defineProperty(window, "parent", {
            value: window,
            writable: true,
            configurable: true,
        });
        const { notifyParent } = useParentNotifier();

        notifyParent({ type: "test" });

        expect(postMessageMock).not.toHaveBeenCalled();
    });
});
