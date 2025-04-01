#!/usr/bin/env python3

import os
import shutil
from pathlib import Path

def build():
    target_dir = Path(os.path.dirname(__file__)).joinpath("src/utils/dnssec")

    build_dir = Path(os.path.dirname(__file__)).joinpath("dnssec-prover/wasmpack")
    os.chdir(build_dir)
    os.system("wasm-pack build --target web --release && rm Cargo.lock && rm -r target/")

    os.chdir(os.path.dirname(__file__))
    os.makedirs(target_dir, exist_ok=True)

    for base, _, files in os.walk(build_dir.joinpath("pkg")):
        for file in files:
            if file in ["package.json", ".gitignore"]:
                continue

            shutil.copy2(
                Path(base).joinpath(file),
                Path(target_dir).joinpath(file)
            )

build()
