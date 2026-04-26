FROM oven/bun:1.3 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun ci --ignore-scripts
COPY . .

ARG NETWORK=mainnet

# Self-hosting env variables (optional, passed as build args)
ARG VITE_BTC_EXPLORER_URL=
ARG VITE_BTC_EXPLORER_TOR_URL=
ARG VITE_BTC_EXPLORER_API_URL=
ARG VITE_BTC_EXPLORER_API_TOR_URL=
ARG VITE_TOR_URL=

# Write env vars to .env file so Vite picks them up at build time
RUN printf \
    "VITE_BTC_EXPLORER_URL=%s\nVITE_BTC_EXPLORER_TOR_URL=%s\nVITE_BTC_EXPLORER_API_URL=%s\nVITE_BTC_EXPLORER_API_TOR_URL=%s\nVITE_TOR_URL=%s\n" \
    "$VITE_BTC_EXPLORER_URL" \
    "$VITE_BTC_EXPLORER_TOR_URL" \
    "$VITE_BTC_EXPLORER_API_URL" \
    "$VITE_BTC_EXPLORER_API_TOR_URL" \
    "$VITE_TOR_URL" \
    > .env

RUN bun run generate
RUN bun run $NETWORK
RUN if [ "$NETWORK" = "pro" ]; then bun run build:pro; else bun run build:regular; fi

FROM nginx:alpine AS final

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Template for nginx config that gets substituted at runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

COPY --from=builder /app/dist /usr/share/nginx/html

# Startup script that substitutes environment variables in nginx config
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
