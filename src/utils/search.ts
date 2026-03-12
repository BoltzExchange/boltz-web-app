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
