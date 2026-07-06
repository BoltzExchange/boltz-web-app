#!/usr/bin/env python3

"""Build the dnssec-prover WASM and vendor it into the boltz-swaps SDK.

Runs wasm-pack, then emits two generated modules under
packages/boltz-swaps/src/generated/dnssec/:

  * dnssec_prover_wasm.ts - the wasm-bindgen glue, adapted so it never fetches a
    sibling `.wasm` asset. The default `new URL(..., import.meta.url)` branch is
    replaced with a throw; bytes are injected via `init(bytes)` instead. This is
    what keeps the module bundler-agnostic and reachable only via a lazy import.
  * wasmBytes.ts - the `.wasm` binary base64-inlined so it ships through `tsc`
    (`files: ["dist"]`) without a bundler/asset-copy step, decoded and cached on
    first use.

Both land under src/generated/ so they inherit the repo's eslint/prettier ignore.
"""

import base64
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WASMPACK_DIR = ROOT / "dnssec-prover" / "wasmpack"
PKG_DIR = WASMPACK_DIR / "pkg"
OUT_DIR = ROOT / "packages" / "boltz-swaps" / "src" / "generated" / "dnssec"

GLUE_NAME = "dnssec_prover_wasm.js"
WASM_NAME = "dnssec_prover_wasm_bg.wasm"

GLUE_HEADER = """\
// @ts-nocheck
/* eslint-disable */
// Vendored wasm-bindgen glue for the dnssec-prover WASM (Matt Corallo, MIT).
// Only edit: the default `new URL(...import.meta.url)` fetch branch was removed
// so bytes are always injected (see wasmBytes.ts).
"""

INIT_THROW = "throw new Error('dnssec wasm bytes must be provided to init()');"


def build_wasm() -> None:
    subprocess.run(
        ["wasm-pack", "build", "--target", "web", "--release"],
        cwd=WASMPACK_DIR,
        check=True,
    )
    (WASMPACK_DIR / "Cargo.lock").unlink(missing_ok=True)
    shutil.rmtree(WASMPACK_DIR / "target", ignore_errors=True)


def write_glue() -> None:
    glue = (PKG_DIR / GLUE_NAME).read_text()

    # Drop the default-path branch that fetches `<name>_bg.wasm` relative to the
    # module URL: we always inject bytes, and that reference would break pure
    # `tsc` emit and trip downstream bundlers into resolving an asset we do not
    # ship.
    glue, count = re.subn(
        r"module_or_path = new URL\([^)]*import\.meta\.url\);",
        INIT_THROW,
        glue,
    )
    if count != 1:
        raise SystemExit(
            f"expected exactly one import.meta.url branch to patch, found "
            f"{count}; wasm-pack output changed - re-check the glue"
        )

    # Drop the `@ts-self-types` directive: it points at a sibling `.d.ts` we do
    # not vendor, and standard resolution finds the tsc-emitted one in dist.
    glue, count = re.subn(r"/\* @ts-self-types=[^\n]*\*/\n", "", glue)
    if count != 1:
        raise SystemExit(
            f"expected exactly one @ts-self-types directive to drop, found "
            f"{count}; wasm-pack output changed - re-check the glue"
        )

    (OUT_DIR / "dnssec_prover_wasm.ts").write_text(GLUE_HEADER + glue)


def write_wasm_bytes() -> None:
    b64 = base64.b64encode((PKG_DIR / WASM_NAME).read_bytes()).decode("ascii")
    (OUT_DIR / "wasmBytes.ts").write_text(
        "// Generated from dnssec_prover_wasm_bg.wasm. Do not edit by hand.\n"
        'import { decodeBase64 } from "../../util/base64.ts";\n'
        "\n"
        "const WASM_BASE64 =\n"
        f'    "{b64}";\n'
        "\n"
        "let cached: Uint8Array | undefined;\n"
        "\n"
        "export const getDnssecWasmBytes = (): Uint8Array =>\n"
        "    (cached ??= decodeBase64(WASM_BASE64));\n"
    )


def build() -> None:
    build_wasm()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in (GLUE_NAME, WASM_NAME):
        if not (PKG_DIR / name).exists():
            raise SystemExit(f"wasm-pack did not produce {name}")

    write_glue()
    write_wasm_bytes()

    print(f"wrote {OUT_DIR / 'dnssec_prover_wasm.ts'}")
    print(f"wrote {OUT_DIR / 'wasmBytes.ts'}")


build()
