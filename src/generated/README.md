# Generating `idl.json`

Requires the [Anchor CLI](https://www.anchor-lang.com/docs/references/cli) to be
installed first and the
[Usdt Native Mesh](https://github.com/LayerZero-Labs/usdt-native-mesh)
repository.

For example, if you want it cloned next to this repo:

```sh
git clone https://github.com/LayerZero-Labs/usdt-native-mesh.git ../usdt-native-mesh
cd ../usdt-native-mesh
anchor idl build > ../boltz-web-app/src/generated/idl.json
```
