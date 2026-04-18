/**
 * Returns a score for how well `query` fuzzy-matches `target`.
 * All query characters must appear in order in the target.
 * Lower score = better match. Returns null if no match.
 */
export const fuzzyScore = (query: string, target: string): number | null => {
    const q = query.toLowerCase();
    const t = target.toLowerCase();

    let score = 0;
    let lastIndex = -1;

    for (const char of q) {
        const index = t.indexOf(char, lastIndex + 1);
        if (index === -1) return null;
        score += index - lastIndex;
        lastIndex = index;
    }

    return score;
};

export const scrollToFocused = (list: HTMLElement | undefined, idx: number) => {
    const item = list?.children[idx] as HTMLElement;
    item?.scrollIntoView?.({ block: "nearest" });
};

export const findEnabledIndex = (
    start: number,
    step: 1 | -1,
    length: number,
    isDisabled?: (i: number) => boolean,
): number => {
    if (length === 0) return 0;
    const wrap = (i: number) => ((i % length) + length) % length;
    let idx = wrap(start);
    if (!isDisabled) return idx;
    for (let n = 0; n < length; n++) {
        if (!isDisabled(idx)) return idx;
        idx = wrap(idx + step);
    }
    return idx;
};

export const handleListKeyDown = (
    e: KeyboardEvent,
    length: number,
    setFocusedIndex: (fn: (i: number) => number) => void,
    onSelect: () => void,
    onClose: () => void,
    isDisabled?: (index: number) => boolean,
) => {
    switch (e.key) {
        case "j":
        case "ArrowDown":
            e.preventDefault();
            setFocusedIndex((i) =>
                findEnabledIndex(i + 1, 1, length, isDisabled),
            );
            break;
        case "k":
        case "ArrowUp":
            e.preventDefault();
            setFocusedIndex((i) =>
                findEnabledIndex(i - 1, -1, length, isDisabled),
            );
            break;
        case "Enter":
            if ((e.target as HTMLElement).closest("button")) return;
            e.preventDefault();
            onSelect();
            break;
        case "Escape":
            e.preventDefault();
            onClose();
            break;
    }
};

export const fuzzySort = <T>(
    items: T[],
    query: string,
    getText: (item: T) => string,
): T[] => {
    if (!query) return items;

    return items
        .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
        .filter((r) => r.score !== null)
        .sort((a, b) => a.score - b.score)
        .map((r) => r.item);
};
