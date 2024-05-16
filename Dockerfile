FROM node:20
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm ci
COPY . .

ENV NETWORK=mainnet
ENV DOCKER=1

RUN npm run $NETWORK
RUN npm run build
EXPOSE 4183
CMD ["npm", "run", "serve"]
