FROM node:22 AS builder

RUN npm i -g npm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .

ARG NETWORK=mainnet

RUN npm run $NETWORK
RUN npm run build

FROM scratch AS output

ARG NETWORK=mainnet

COPY --from=builder /app/dist /dist/${NETWORK}
