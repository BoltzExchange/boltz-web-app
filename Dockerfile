FROM node:22 AS builder

RUN npm i -g npm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .

ARG NETWORK=mainnet

RUN npm run $NETWORK
RUN if [ "$NETWORK" = "pro" ]; then npm run build:pro; else npm run build:regular; fi

FROM nginx:alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
