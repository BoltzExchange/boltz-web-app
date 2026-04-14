# Gas top-up

## Tron

We don't support gas top-ups for Tron because most wallets have some way to pay
gas in USDT directly, which is usually much cheaper for fresh wallets due to how
energy works on Tron.

## Only connected wallets

We don't add a gas top-up when the destination wallet isn't connected in the
browser. In that case, we can't be sure whether the wallet belongs to the user
or is an external wallet, so automatically adding a gas top-up would be bad UX.
