FROM oven/bun:1.3 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .
RUN bun ci --ignore-scripts

ARG NETWORK=mainnet

RUN bun --filter boltz-swaps generate
RUN bun run $NETWORK
RUN if [ "$NETWORK" = "pro" ]; then bun run build:pro; else bun run build:regular; fi

FROM scratch AS output

ARG NETWORK=mainnet

COPY --from=builder /app/dist /dist/${NETWORK}
