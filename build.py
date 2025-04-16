#!/usr/bin/env python3

import sys


def handle_coop_disabled():
    print("Cooperative signatures are disabled in config")
    sys.exit(1)


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
    try:
        with open(".env", "r") as f:
            data = f.read()

            for var in [
                "VITE_RSK_LOG_SCAN_ENDPOINT",
                "VITE_WALLETCONNECT_PROJECT_ID",
                "VITE_CHATWOOT_TOKEN",
            ]:
                if var not in data:
                    print(f"WARN: {var} not in .env file")

    except Exception as e:
        print("WARN: could not open .env file:", e)
