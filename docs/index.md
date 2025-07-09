---
next:
    text: "📲 Install as App"
    link: "/pwa"
---

# 🖥 Run from Source

We encourage our technical users to check the code and run the web app locally
from source following the instructions below.

## Dependencies

Make sure to have the latest
[Node.js LTS and NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
installed. We recommend using
[nvm](https://github.com/nvm-sh/nvm#install--update-script) to manage npm
installs: `nvm install --lts`

### Run

Clone the repository, change to the project folder and run `npm install` to
install all dependencies. Then `npm run mainnet && npm run build` and
`npx serve dist` to bring it up.

Open [http://localhost:3000](http://localhost:3000) in your browser and start
swapping!

## With Docker

```bash
docker build -t boltz-webapp .
docker run -d --rm -p 4173:80 --name my-boltz-webapp boltz-webapp
```
