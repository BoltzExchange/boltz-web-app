#! /bin/python3

import sys
import json

def handle_coop_disabled():
    print("Cooperative signatures are disabled in config")
    sys.exit(1)

with open("./src/config.ts", "r") as f:
    for line in f:
        if "cooperativeDisabled" not in line:
            continue

        if "false" not in line:
            handle_coop_disabled()

network: str | None = None

with open("./public/config.json") as f:
    data = json.load(f)

    network = data["network"]

    if data.get("cooperativeDisabled", False):
        handle_coop_disabled()


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
