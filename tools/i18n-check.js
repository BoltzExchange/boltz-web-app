import { rawDict } from '../src/i18n/i18n.js';

const langs = Object.keys(rawDict);

console.log(`Found ${langs.length} languages:`);
for (const lang of langs) {
    console.log(`  - ${lang}`);
}

const missing = new Map();

for (const lang of langs) {
    const langKeys = Object.keys(rawDict[lang]);

    for (const comp of langs) {
        if (lang === comp) {
            continue
        }

        if (!missing.has(comp)) {
            missing.set(comp, new Set());
        }

        const compKeys = Object.keys(rawDict[comp]);
        const diff = langKeys.filter((val) => !compKeys.includes(val));
        
        diff.forEach((item) => missing.get(comp).add(item));
    }
}

console.log();
for (const [lang, missingStrs] of missing.entries()) {
    if (missingStrs.size === 0) {
        continue;
    }

    console.log(`${lang} is missing ${missingStrs.size}:`);
    for (const str of missingStrs) {
        console.log(`  - ${str}`);
    }
    console.log();
}
