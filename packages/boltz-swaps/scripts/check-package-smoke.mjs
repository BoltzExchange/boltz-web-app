import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = join(packageRoot, "package.json");

/**
 * @type {{
 *     name: string;
 *     exports?: Record<string, unknown>;
 *     dependencies?: Record<string, string>;
 *     peerDependencies?: Record<string, string>;
 * }}
 */
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageName = packageJson.name;

const tmpRoot = mkdtempSync(join(tmpdir(), `${packageName}-smoke-`));
const packDir = join(tmpRoot, "pack");
const unpackDir = join(tmpRoot, "unpack");
const smokeDir = join(tmpRoot, "smoke");
const smokeNodeModules = join(smokeDir, "node_modules");
const packedPackageDir = join(smokeNodeModules, packageName);

const dependencyNames = [
    ...new Set([
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.peerDependencies ?? {}),
    ]),
].sort();

const exportSpecifiers = Object.keys(packageJson.exports ?? {})
    .map((key) =>
        key === "." ? packageName : `${packageName}/${key.slice(2)}`,
    )
    .sort();

const findInstalledPackage = (name) => {
    let current = packageRoot;
    while (true) {
        const candidate = join(current, "node_modules", name);
        if (existsSync(join(candidate, "package.json"))) {
            return realpathSync(candidate);
        }

        const parent = dirname(current);
        if (parent === current) {
            throw new Error(
                `Declared dependency "${name}" is not installed; run the workspace install first`,
            );
        }
        current = parent;
    }
};

const linkPackage = (name, target) => {
    const parts = name.split("/");
    const link =
        parts[0]?.startsWith("@") && parts.length === 2
            ? join(smokeNodeModules, parts[0], parts[1])
            : join(smokeNodeModules, name);

    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link, "dir");
};

try {
    mkdirSync(packDir, { recursive: true });
    mkdirSync(unpackDir, { recursive: true });
    mkdirSync(smokeNodeModules, { recursive: true });

    const packOutput = execFileSync(
        "bun",
        ["pm", "pack", "--destination", packDir, "--quiet"],
        {
            cwd: packageRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    const tarballPath = packOutput.trim().split(/\r?\n/).at(-1);
    if (tarballPath === undefined || !existsSync(tarballPath)) {
        throw new Error(
            `Could not find packed tarball from output: ${packOutput}`,
        );
    }

    execFileSync("tar", ["-xzf", tarballPath, "-C", unpackDir], {
        stdio: "pipe",
    });
    renameSync(join(unpackDir, "package"), packedPackageDir);

    for (const name of dependencyNames) {
        linkPackage(name, findInstalledPackage(name));
    }

    const failures = [];
    for (const specifier of exportSpecifiers) {
        try {
            execFileSync(
                process.execPath,
                [
                    "--input-type=module",
                    "--eval",
                    `await import(${JSON.stringify(specifier)});`,
                ],
                {
                    cwd: smokeDir,
                    encoding: "utf8",
                    stdio: ["ignore", "pipe", "pipe"],
                },
            );
        } catch (error) {
            failures.push({
                specifier,
                output: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim(),
            });
        }
    }

    if (failures.length > 0) {
        console.error("FAIL: packed package export smoke test failed");
        for (const { specifier, output } of failures) {
            console.error(`\n${specifier}`);
            console.error(output);
        }
        process.exit(1);
    }

    console.log(
        `ok: packed package imports ${exportSpecifiers.length} exports with only declared deps/peers`,
    );
} finally {
    if (process.env.KEEP_PACKAGE_SMOKE_TMP === "1") {
        const displayPath = tmpRoot.split(sep).join("/");
        console.log(`kept package smoke temp dir: ${displayPath}`);
    } else {
        rmSync(tmpRoot, { recursive: true, force: true });
    }
}
