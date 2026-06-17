export const trimPrefix = (str: string, prefix: string) => {
    if (str.startsWith(prefix)) {
        return str.slice(prefix.length);
    }

    return str;
};

// Splits text on Markdown bold (`**...**`) and wraps those segments in <strong>.
export const emphasize = (text: string): (string | HTMLElement)[] =>
    text.split(/\*\*(.+?)\*\*/).map((part, i) => {
        if (i % 2 === 0) {
            return part;
        }
        const strong = document.createElement("strong");
        strong.textContent = part;
        return strong;
    });
