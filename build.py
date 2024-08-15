#! /bin/python3

import sys

with open("./src/config.ts", "r") as f:
    for line in f:
        if "cooperativeDisabled" not in line:
            continue

        if "true" in line:
            print("Cooperative signatures are disabled in config")
            sys.exit(1)

        break

with open(".env", "r") as f:
    data = f.read()

    for var in ["VITE_RSK_LOG_SCAN_ENDPOINT"]:
        if var not in data:
            print(f"{var} not in .env file")
            sys.exit(1)
