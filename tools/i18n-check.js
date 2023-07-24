import i18n from '../src/i18n/i18n.js';

const langs = Object.keys(i18n);

console.log(`Found ${langs.length} languages:`);
for (const lang of langs) {
    console.log(`  - ${lang}`);
}

const missing = new Map();

for (const lang of langs) {
    const langKeys = Object.keys(i18n[lang]);

    for (const comp of langs) {
        if (lang === comp) {
            continue
        }

        if (!missing.has(comp)) {
            missing.set(comp, []);
        }

        const compKeys = Object.keys(i18n[comp]);
        const diff = langKeys.filter((val) => !compKeys.includes(val));
        
        missing.set(comp, missing.get(comp).concat(diff));
    }
}

console.log();
for (const [lang, missingStrs] of missing.entries()) {
    if (missingStrs.length === 0) {
        continue;
    }
    
    console.log(`${lang} is missing:`);
    for (const str of missingStrs) {
        console.log(`  - ${str}`);
    }
}
