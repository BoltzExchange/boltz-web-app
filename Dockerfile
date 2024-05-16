FROM node
WORKDIR /app
COPY package.json .
RUN npm i
COPY . .

ENV NETWORK=mainnet
ENV NODE_ENV=docker

RUN npm run $NETWORK
RUN npm run build
EXPOSE 4183
CMD ["npm", "run", "serve"]
