/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

// Configuration for both regular and pro versions
const config = {
    regular: {
        boltzUrl: "https://boltz.exchange",
        boltzTitle: "Boltz | Non-Custodial Bitcoin Bridge",
        boltzDescription:
            "Swap between different Bitcoin layers while staying in full control. Fast and non-custodial Lightning / Bitcoin / Liquid / Rootstock swaps.",
        boltzColor100: "#FFE96D",
        boltzColor200: "#E1C218",
        backgroundColor: "#142840",
        assetsPath: "",
        ldJson: {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Boltz Exchange",
            url: "https://boltz.exchange",
            logo: "https://boltz.exchange/boltz.svg",
            sameAs: ["https://x.com/boltzhq"],
            hasPart: {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "Boltz Pro | Stack Sats Non-Custodially",
                url: "https://pro.boltz.exchange",
                logo: "https://pro.boltz.exchange/boltz-pro-preview.jpg",
                description:
                    "Earn sats for swapping Bitcoin in directions that help balance our liquidity. Fast and non-custodial Lightning / Bitcoin / Liquid / Rootstock swaps.",
            },
        },
    },
    pro: {
        boltzUrl: "https://pro.boltz.exchange",
        boltzTitle: "Boltz Pro | Stack Sats Non-Custodially",
        boltzDescription:
            "Earn sats for swapping Bitcoin in directions that help balance our liquidity. Fast and non-custodial Lightning / Bitcoin / Liquid / Rootstock swaps.",
        boltzColor100: "#c8cfd6",
        boltzColor200: "#9fa8b1",
        backgroundColor: "#14191e",
        assetsPath: "/pro",
        ldJson: {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Boltz Pro",
            url: "https://pro.boltz.exchange",
            logo: "https://pro.boltz.exchange/boltz-preview.jpg",
            description:
                "Earn sats for swapping Bitcoin in directions that help balance our liquidity. Fast and non-custodial Lightning / Bitcoin / Liquid / Rootstock swaps.",
            offers: {
                "@type": "Offer",
                description:
                    "Non-custodial Bitcoin swapping with earning potential",
            },
            provider: {
                "@type": "Organization",
                name: "Boltz Exchange",
                url: "https://boltz.exchange",
                logo: "https://boltz.exchange/boltz.svg",
            },
        },
    },
};

function usage() {
    const scriptName = path.basename(import.meta.url);
    console.log(`
    Usage: ${scriptName} [--regular|--pro]

    Generates an index.html from index.template.html using configuration variables.

    Arguments:
        --regular   Generate site for regular Boltz Exchange
        --pro       Generate site for Boltz Pro

    Examples:
    ${scriptName} --regular
    ${scriptName} --pro
  `);
}

function replaceTemplateVariables(template, variables) {
    let result = template;

    // Find all variables in the template (both ${variable} and $variable patterns)
    const variablePatterns = [
        /\$\{([^}]+)\}/g, // ${variable}
        /\$([a-zA-Z_][a-zA-Z0-9_]*)/g, // $variable
    ];

    const foundVariables = new Set();

    for (const pattern of variablePatterns) {
        let match;
        while ((match = pattern.exec(template)) !== null) {
            foundVariables.add(match[1]);
        }
    }

    // Check if all found variables are defined
    const undefinedVariables = [];
    for (const variable of foundVariables) {
        if (!(variable in variables)) {
            undefinedVariables.push(variable);
        }
    }

    if (undefinedVariables.length > 0) {
        throw new Error(
            `Undefined variables found in template: ${undefinedVariables.join(", ")}`,
        );
    }

    // Replace all variables in the template
    for (const [key, value] of Object.entries(variables)) {
        // Handle both ${variable} and $variable patterns
        const regex1 = new RegExp(`\\$\\{${key}\\}`, "g");
        const regex2 = new RegExp(`\\$${key}`, "g");
        result = result.replace(regex1, value);
        result = result.replace(regex2, value);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
}

function validateInputs(args) {
    // Validate argument count
    if (!Array.isArray(args) || args.length !== 1) {
        throw new Error("Exactly one argument required");
    }

    const mode = args[0];

    // Validate mode argument
    if (typeof mode !== "string" || !mode.startsWith("--")) {
        throw new Error("Mode must be a string starting with '--'");
    }

    // Validate allowed modes
    const allowedModes = ["--regular", "--pro"];
    if (!allowedModes.includes(mode)) {
        throw new Error(
            `Invalid mode: ${mode}. Allowed modes: ${allowedModes.join(", ")}`,
        );
    }

    return mode;
}

function validateConfig(config) {
    if (!config || typeof config !== "object") {
        throw new Error("Config must be an object");
    }

    const requiredFields = [
        "boltzUrl",
        "boltzTitle",
        "boltzDescription",
        "boltzColor100",
        "boltzColor200",
        "backgroundColor",
        "assetsPath",
        "ldJson",
    ];

    for (const field of requiredFields) {
        if (!(field in config)) {
            throw new Error(`Missing required config field: ${field}`);
        }
    }

    // Validate URL format
    try {
        new URL(config.boltzUrl);
    } catch {
        throw new Error(`Invalid URL format: ${config.boltzUrl}`);
    }

    // Validate JSON structure
    if (typeof config.ldJson !== "object" || config.ldJson === null) {
        throw new Error("ldJson must be a valid object");
    }

    return true;
}

function validateFilePaths(templatePath, outputPath) {
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
    }

    // Check if template is readable
    try {
        fs.accessSync(templatePath, fs.constants.R_OK);
    } catch {
        throw new Error(`Template file not readable: ${templatePath}`);
    }

    // Check if output directory is writable
    const outputDir = path.dirname(outputPath);
    try {
        fs.accessSync(outputDir, fs.constants.W_OK);
    } catch {
        throw new Error(`Output directory not writable: ${outputDir}`);
    }

    return true;
}

function main() {
    try {
        const args = process.argv.slice(2);

        // Show usage if no arguments provided
        if (args.length === 0) {
            usage();
            return 1;
        }

        // Validate inputs
        const mode = validateInputs(args);

        // Get selected config
        let selectedConfig;
        if (mode === "--regular") {
            selectedConfig = config.regular;
        } else if (mode === "--pro") {
            selectedConfig = config.pro;
        } else {
            throw new Error(`Invalid mode: ${mode}`);
        }

        // Validate config
        validateConfig(selectedConfig);

        // Prepare variables for template replacement
        const variables = {
            ...selectedConfig,
            ldJson: JSON.stringify(selectedConfig.ldJson, null, 4),
        };

        // Get script directory
        const __filename = fileURLToPath(import.meta.url);
        const scriptDir = path.dirname(__filename);
        const templatePath = path.join(scriptDir, "index.template.html");
        const outputPath = path.join(scriptDir, "index.html");

        // Validate file paths
        validateFilePaths(templatePath, outputPath);

        // Read template file
        const template = fs.readFileSync(templatePath, "utf8");

        if (!template || template.trim().length === 0) {
            throw new Error("Template file is empty");
        }

        // Replace variables in template
        const output = replaceTemplateVariables(template, variables);

        // Write output file
        fs.writeFileSync(outputPath, output, "utf8");

        console.log(
            `Successfully generated ${outputPath} for ${mode === "--regular" ? "regular" : "pro"} mode`,
        );

        return 0; // Success exit code
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        console.error("Error:", errorMessage);
        return 1; // Error exit code
    }
}

if (
    process.argv[1] &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
    const exitCode = main();
    process.exit(exitCode);
}
