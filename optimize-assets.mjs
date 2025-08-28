#!/usr/bin/env node
/* eslint-disable no-console */
import { execSync } from "child_process";
import fs from "fs";
import process from "process";

// Check if cwebp is installed
function checkCwebp() {
    try {
        execSync("cwebp -version", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

execSync("npx svgo -r src/assets", { stdio: "inherit" });

const pngFiles = fs
    .readdirSync("src/assets")
    .filter((file) => file.toLocaleLowerCase().endsWith(".png"));

if (pngFiles.length > 0) {
    if (!checkCwebp()) {
        console.error(`❌ cwebp not installed. Please install with:
  • Ubuntu/Debian: sudo apt-get install webp
  • macOS: brew install webp
  • Windows: Download from https://developers.google.com/speed/webp/download
Do NOT install cwebp via npm!`);
        process.exit(1);
    }

    for (const file of pngFiles) {
        const pngPath = `src/assets/${file}`;
        const webpPath = pngPath.replace(".png", ".webp");
        execSync(`cwebp "${pngPath}" -o "${webpPath}"`, { stdio: "pipe" });
        fs.unlinkSync(pngPath);
        console.log(`✓ Converted ${file} to WebP`);
    }
}

console.log("✅ Assets optimized");
