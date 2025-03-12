import log from "loglevel";

import { detectWebLNProvider, enableWebln } from "../../src/utils/webln";

/* eslint-disable @typescript-eslint/unbound-method,@typescript-eslint/no-explicit-any */

describe("WebLN", () => {
    beforeEach(() => {
        log.error = vi.fn();
    });

    test("should not detect WebLN when no injected provider is present", async () => {
        expect(await detectWebLNProvider(1)).toEqual(false);
    });

    test("should detect WebLN when provider is present", async () => {
        window.webln = {} as any;
        expect(await detectWebLNProvider()).toEqual(true);
    });

    test("should detect WebLN when provider is present after 200ms", async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        setTimeout(() => (window.webln = {} as any), 1);
        expect(await detectWebLNProvider()).toEqual(true);
    });

    test("should call WebLN callback if enable call succeeds", async () => {
        window.webln = {
            enable: vi.fn().mockResolvedValue(undefined),
        } as any;
        const cb = vi.fn();

        expect(await enableWebln(cb));

        expect(window.webln.enable).toHaveBeenCalledTimes(1);
        expect(window.webln.enable).toHaveBeenCalledWith();

        expect(cb).toHaveBeenCalledTimes(1);
        expect(log.error).toHaveBeenCalledTimes(0);
    });

    test("should not call WebLN callback if enable call fails", async () => {
        window.webln = {
            enable: vi.fn().mockRejectedValue("unauthorized"),
        } as any;
        const cb = vi.fn();

        expect(await enableWebln(cb));

        expect(window.webln.enable).toHaveBeenCalledTimes(1);
        expect(window.webln.enable).toHaveBeenCalledWith();

        expect(cb).toHaveBeenCalledTimes(0);
        expect(log.error).toHaveBeenCalledTimes(1);
    });

    test("should not call WebLN callback if window.webln is undefined", async () => {
        const cb = vi.fn();

        expect(await enableWebln(cb));

        expect(cb).toHaveBeenCalledTimes(0);
        expect(log.error).toHaveBeenCalledTimes(1);
    });
});
