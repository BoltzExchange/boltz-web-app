import { config } from "../config";

const chatwootAuthCookie = "cw_conversation";

export const getChatwootToken = () =>
    import.meta.env.VITE_CHATWOOT_TOKEN as string | undefined;

export const isChatwootConfigured = () =>
    !!getChatwootToken() && config.chatwootUrl !== undefined;

const getCookie = (name: string) => {
    const prefix = `${name}=`;
    const cookie = document.cookie
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(prefix));

    return cookie === undefined
        ? undefined
        : decodeURIComponent(cookie.substring(prefix.length));
};

export const logsFileName = "boltz-logs.json";

export class ChatwootNotReadyError extends Error {
    constructor() {
        super("Chatwoot conversation is not ready");
    }
}

export const formatLogsForChatwootAttachment = (
    logs: Record<string, string[]>,
) => new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });

export const postLogsToChatwoot = async (logs: Record<string, string[]>) => {
    const websiteToken = getChatwootToken();
    const chatwootUrl = config.chatwootUrl;

    if (!websiteToken || chatwootUrl === undefined) {
        throw new Error("Chatwoot is not configured");
    }

    const authToken = getCookie(chatwootAuthCookie);
    if (authToken === undefined) {
        // Open the widget so it can bootstrap a conversation for the retry
        window.$chatwoot?.toggle("open");
        throw new ChatwootNotReadyError();
    }

    const formData = new FormData();
    formData.append(
        "message[attachments][]",
        formatLogsForChatwootAttachment(logs),
        logsFileName,
    );
    formData.append("message[referer_url]", window.location.href);
    formData.append("message[timestamp]", new Date().toString());

    const response = await fetch(
        `${chatwootUrl}/api/v1/widget/messages?${new URLSearchParams({
            website_token: websiteToken,
        }).toString()}`,
        {
            method: "POST",
            headers: {
                "X-Auth-Token": authToken,
            },
            body: formData,
        },
    );

    if (!response.ok) {
        throw new Error(`Chatwoot responded with ${response.status}`);
    }

    window.$chatwoot?.toggle("open");
};
