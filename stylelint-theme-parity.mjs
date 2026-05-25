import stylelint from "stylelint";

const ruleName = "boltz/theme-token-parity";

const messages = stylelint.utils.ruleMessages(ruleName, {
    missing: (token, theme, declaredIn) =>
        `Custom property "${String(token)}" is declared in theme "${String(declaredIn)}" but missing from theme "${String(theme)}". ` +
        `All :root[boltz-theme="..."] blocks must declare the same set of custom properties.`,
});

const meta = {
    url: "https://github.com/BoltzExchange/boltz-web-app",
};

const THEME_SELECTOR = /^:root\[boltz-theme=["']([^"']+)["']\]$/;
const BASELINE_SELECTOR = /^:root$/;

const ruleFunction = (primary) => (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
        actual: primary,
        possible: [true],
    });
    if (!validOptions) return;

    const themeBlocks = new Map();
    const baselineTokens = new Set();

    root.walkRules((rule) => {
        if (BASELINE_SELECTOR.test(rule.selector)) {
            rule.walkDecls((decl) => {
                if (decl.prop.startsWith("--")) baselineTokens.add(decl.prop);
            });
            return;
        }
        const match = rule.selector.match(THEME_SELECTOR);
        if (!match) return;
        const themeName = match[1];
        if (!themeBlocks.has(themeName)) {
            themeBlocks.set(themeName, { rules: [], tokens: new Map() });
        }
        const entry = themeBlocks.get(themeName);
        entry.rules.push(rule);
        rule.walkDecls((decl) => {
            if (decl.prop.startsWith("--") && !entry.tokens.has(decl.prop)) {
                entry.tokens.set(decl.prop, decl);
            }
        });
    });

    if (themeBlocks.size < 2) return;

    const tokenOrigin = new Map();
    for (const [themeName, { tokens }] of themeBlocks) {
        for (const token of tokens.keys()) {
            if (baselineTokens.has(token)) continue;
            if (!tokenOrigin.has(token)) tokenOrigin.set(token, themeName);
        }
    }

    for (const [themeName, { rules, tokens }] of themeBlocks) {
        for (const [token, declaredIn] of tokenOrigin) {
            if (tokens.has(token)) continue;
            stylelint.utils.report({
                message: messages.missing(token, themeName, declaredIn),
                node: rules[0],
                result,
                ruleName,
            });
        }
    }
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

export default stylelint.createPlugin(ruleName, ruleFunction);
