---
next:
    text: "📲 Install as App"
    link: "/pwa"
---

# 🖥 Run from Source

We encourage our technical users to check the code and run the web app locally
from source following the instructions below.

## Native Build

### Dependencies

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

## Docker

In your local `boltz-web-app` repository, run:

```bash
docker build -t boltz-webapp .
docker run -d --rm -p 3000:80 --name my-boltz-webapp boltz-webapp
```

Just like the native build, the Docker container will serve the web app on
[http://localhost:3000](http://localhost:3000).

## Secure Context

To access your local Boltz Web App build from another machine, ensure the page
is served in a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
Otherwise, the site will not work and the browser console will show an error
like: `Window is not in a secure context`.

Ways to get a secure context:

- access the site via `localhost` (for remote hosts, use SSH port forwarding:
  `ssh -N -L 3000:localhost:3000 user@server`)
- or serve the app over `https://` (self‑signed certificates are fine).
