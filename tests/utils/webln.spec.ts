import log from "loglevel";
import { beforeEach, describe, expect, test, vitest } from "vitest";

import { detectWebLNProvider, enableWebln } from "../../src/utils/webln";

describe("WebLN", () => {
    beforeEach(() => {
        log.error = vitest.fn();
    });

    test("should not detect WebLN when no injected provider is present", async () => {
        expect(await detectWebLNProvider(1)).toEqual(false);
    });

    test("should detect WebLN when provider is present", async () => {
        window.webln = {} as any;
        expect(await detectWebLNProvider()).toEqual(true);
    });

    test("should detect WebLN when provider is present after 200ms", async () => {
        setTimeout(() => (window.webln = {} as any), 1);
        expect(await detectWebLNProvider()).toEqual(true);
    });

    test("should call WebLN callback if enable call succeeds", async () => {
        // @ts-ignore
        window.webln = {
            enable: vitest.fn().mockResolvedValue(undefined),
        } as any;
        const cb = vitest.fn();

        expect(await enableWebln(cb));

        // @ts-ignore
        expect(window.webln.enable).toHaveBeenCalledTimes(1);
        // @ts-ignore
        expect(window.webln.enable).toHaveBeenCalledWith();

        expect(cb).toHaveBeenCalledTimes(1);
        expect(log.error).toHaveBeenCalledTimes(0);
    });

    test("should not call WebLN callback if enable call fails", async () => {
        // @ts-ignore
        window.webln = {
            enable: vitest.fn().mockRejectedValue("unauthorized"),
        } as any;
        const cb = vitest.fn();

        expect(await enableWebln(cb));

        // @ts-ignore
        expect(window.webln.enable).toHaveBeenCalledTimes(1);
        // @ts-ignore
        expect(window.webln.enable).toHaveBeenCalledWith();

        expect(cb).toHaveBeenCalledTimes(0);
        expect(log.error).toHaveBeenCalledTimes(1);
    });

    test("should not call WebLN callback if window.webln is undefined", async () => {
        const cb = vitest.fn();

        expect(await enableWebln(cb));

        expect(cb).toHaveBeenCalledTimes(0);
        expect(log.error).toHaveBeenCalledTimes(1);
    });
});
