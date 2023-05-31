#!/bin/bash

if [[ $VERCEL_GIT_COMMIT_REF == "mainnet" ]] ; then
  npm run mainnet
else
  npm run testnet
fi
