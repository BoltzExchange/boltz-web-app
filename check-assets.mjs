#!/usr/bin/env node
/* eslint-disable no-console */
import { execSync } from "child_process";
import fs from "fs";
import process from "process";

const fixSuggestion = `
Please run "npm run optimize:assets", commit the changes and try again
`;

const pngFiles = fs
    .readdirSync("src/assets")
    .filter((file) => file.toLocaleLowerCase().endsWith(".png"));

if (pngFiles.length > 0) {
    console.error(
        `❌ Found ${pngFiles.length} PNG file(s) that should be converted to WebP: ${pngFiles.join(", ")} ${fixSuggestion}`,
    );
    process.exit(1);
}

try {
    execSync("npx svgo -r src/assets", { stdio: "pipe" });
    const status = execSync("git status --porcelain src/assets", {
        encoding: "utf8",
    });

    if (status.length > 0) {
        console.error(
            `❌ Not all SVG assets are optimized: ${status} ${fixSuggestion}`,
        );
        process.exit(1);
    } else {
        console.log("✅ All assets are optimized");
        process.exit(0);
    }
} catch (error) {
    console.error("❌ Error checking asset status", error);
    process.exit(1);
}
