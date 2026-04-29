# IDL Inputs

This directory stores committed IDL inputs for Codama. Generated TypeScript
bindings under this directory are intentionally ignored and can be recreated
with `bun run generate`.

Run all Solana binding generation:

```sh
bun run generate
```

Run one target:

```sh
bun run generate:solana-oft
bun run generate:solana-cctp
```

## `solana-oft-idl.json`

Requires the [Anchor CLI](https://www.anchor-lang.com/docs/references/cli) to be
installed first and the
[Usdt Native Mesh](https://github.com/LayerZero-Labs/usdt-native-mesh)
repository.

To refresh the IDL source, for example with the repository cloned next to this
repo:

```sh
git clone https://github.com/LayerZero-Labs/usdt-native-mesh.git ../usdt-native-mesh
cd ../usdt-native-mesh
anchor idl build > ../boltz-web-app/src/generated/solana-oft-idl.json
```

## `solana-cctp-token-messenger-minter-v2-idl.json`

Sourced from Circle's
[`solana-cctp-contracts`](https://github.com/circlefin/solana-cctp-contracts)
repository. To refresh the IDL source:

```sh
curl -L \
  https://raw.githubusercontent.com/circlefin/solana-cctp-contracts/master/examples/target/idl/token_messenger_minter_v2.json \
  -o src/generated/solana-cctp-token-messenger-minter-v2-idl.json
```
