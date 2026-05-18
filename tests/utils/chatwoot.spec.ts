import {
    formatLogsForChatwootAttachment,
    isChatwootConfigured,
    logsFileName,
    postLogsToChatwoot,
} from "../../src/utils/chatwoot";

describe("chatwoot", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_CHATWOOT_TOKEN", "");
        document.cookie =
            "cw_conversation=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        document.cookie =
            "cw_conversation=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    });

    test("should detect Chatwoot configuration from the website token", () => {
        expect(isChatwootConfigured()).toBe(false);

        vi.stubEnv("VITE_CHATWOOT_TOKEN", "website-token");

        expect(isChatwootConfigured()).toBe(true);
    });

    test("should format logs as a JSON attachment", async () => {
        await expect(
            formatLogsForChatwootAttachment({
                "2026/05/18": ["log line"],
            }).text(),
        ).resolves.toBe('{\n  "2026/05/18": [\n    "log line"\n  ]\n}');
    });

    test("should post a logs attachment with the Chatwoot conversation token", async () => {
        vi.stubEnv("VITE_CHATWOOT_TOKEN", "website-token");
        document.cookie = "cw_conversation=auth-token";

        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        const toggleMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        window.$chatwoot = {
            setCustomAttributes: vi.fn(),
            toggle: toggleMock,
        };

        await postLogsToChatwoot({ "2026/05/18": ["log line"] });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://support.boltz.exchange/api/v1/widget/messages?website_token=website-token",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "X-Auth-Token": "auth-token",
                },
            }),
        );
        const formData = fetchMock.mock.calls[0][1].body as FormData;
        const attachment = formData.get("message[attachments][]") as File;
        expect(attachment.name).toEqual(logsFileName);
        await expect(attachment.text()).resolves.toContain("log line");
        expect(toggleMock).toHaveBeenCalledWith("open");
    });
});
