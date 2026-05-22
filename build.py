#!/usr/bin/env python3

from __future__ import annotations

import math
import os
import re
import sys


def handle_coop_disabled():
    print("Cooperative signatures are disabled in config")
    sys.exit(1)


def parse_env(data: str) -> dict[str, str]:
    env: dict[str, str] = {}

    for raw_line in data.splitlines():
        line = raw_line.strip()
        if line == "" or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        env[key] = value

    return env


def read_env_file(path: str, warn_missing: bool = False) -> dict[str, str]:
    try:
        with open(path, "r") as f:
            return parse_env(f.read())
    except Exception as e:
        if warn_missing:
            print(f"WARN: could not open {path} file:", e)

        return {}


oft_eta_env_var_pattern = re.compile(r"^VITE_USDT0_[A-Z0-9_]+_OFT_ETA_SECONDS$")

network: str | None = None

with open("./src/config.ts", "r") as f:
    for line in f:
        if "cooperativeDisabled" in line:
            if "false" not in line:
                handle_coop_disabled()

        if "network:" in line and '"' in line:
            network = line.split(":")[1].strip().strip('"').strip('",')

# .env file is not required on regtest
if network != "regtest":
    env = {
        **read_env_file(".env", warn_missing=True),
        **read_env_file(".env.local"),
        **os.environ,
    }

    for var in [
        "VITE_RSK_LOG_SCAN_ENDPOINT",
        "VITE_ARBITRUM_LOG_SCAN_ENDPOINT",
        "VITE_RSK_FALLBACK_ENDPOINT",
        "VITE_WALLETCONNECT_PROJECT_ID",
        "VITE_CHATWOOT_TOKEN",
    ]:
        if var not in env:
            print(f"WARN: {var} not in .env or .env.local")

    errors: list[str] = []
    is_production_deploy = os.environ.get("ENV") == "production"
    oft_eta_env = {
        key: value for key, value in env.items() if oft_eta_env_var_pattern.match(key)
    }
    expected_oft_eta_vars = {
        key
        for key in read_env_file(".env.sample")
        if oft_eta_env_var_pattern.match(key)
    }

    if is_production_deploy:
        missing = sorted(expected_oft_eta_vars - oft_eta_env.keys())
        for var in missing:
            errors.append(f"{var} is required for production builds")

    for var, value in sorted(oft_eta_env.items()):
        try:
            seconds = float(value)
        except ValueError:
            errors.append(f"{var} must be a non-negative number")
            continue

        if not math.isfinite(seconds) or seconds < 0:
            errors.append(f"{var} must be a non-negative number")

    if len(errors) > 0:
        for error in errors:
            print(f"ERROR: {error}")
        sys.exit(1)
