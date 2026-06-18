import type { JSX } from "solid-js";

export const trimPrefix = (str: string, prefix: string) => {
    if (str.startsWith(prefix)) {
        return str.slice(prefix.length);
    }

    return str;
};

// Splits text on Markdown bold (`**...**`) and wraps those segments in <strong>.
export const emphasize = (text: string): (string | JSX.Element)[] =>
    text
        .split(/\*\*(.+?)\*\*/)
        .map((part, i) => (i % 2 === 0 ? part : <strong>{part}</strong>));
