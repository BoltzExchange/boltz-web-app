# Changelog

All notable changes to this project will be documented in this file. See [conventional commits](https://www.conventionalcommits.org/) for commit guidelines.

---
## [1.5.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.5.0..v1.5.1) - 2024-11-11

### Bug Fixes

- do not show QR scan for RSK (#722) - ([f94e7cd](https://github.com/BoltzExchange/boltz-web-app/commit/f94e7cdb31946ccbc4bd5d2f4f29086ca63c7335))
- swap update subscription on WS reconnect (#726) - ([419eb52](https://github.com/BoltzExchange/boltz-web-app/commit/419eb5245ed7f103fe3a2a585ec326a83647d19c))
- catch EVM provider error in create - ([50ed8b7](https://github.com/BoltzExchange/boltz-web-app/commit/50ed8b78ca79e3801a082392258d1652f3816104))

### Features

- disable EVM connect button for invalid pairs (#727) - ([3eff8d3](https://github.com/BoltzExchange/boltz-web-app/commit/3eff8d346677c81105e7b99c7fc6120ce1c8415f))
- contract code validation (#730) - ([f62ef91](https://github.com/BoltzExchange/boltz-web-app/commit/f62ef913f12d6482217ea1784c54b1f2850d3bb2))
- loading spinner when fetching signer balance - ([957f43c](https://github.com/BoltzExchange/boltz-web-app/commit/957f43cfb2875bb6ba13b16b2689737e6f837269))

### Miscellaneous Chores

- update changelog for v1.5.0 - ([058a4a7](https://github.com/BoltzExchange/boltz-web-app/commit/058a4a70dee2c9120ff362e91fe3b9f10df92e2d))
- add RSK to mainnet config (#735) - ([41c3df6](https://github.com/BoltzExchange/boltz-web-app/commit/41c3df6407135e982f27a6102ea8b6e2acfb531c))
- bump version to v1.5.1 - ([3dd5a3b](https://github.com/BoltzExchange/boltz-web-app/commit/3dd5a3bb8c29d4403e983badb4c149577302b6ef))

### Refactoring

- stricter EVM signer balance check - ([5a854d4](https://github.com/BoltzExchange/boltz-web-app/commit/5a854d473dd462cbf36b528fcd3fde0ae615738a))

---
## [1.5.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.4.1..v1.5.0) - 2024-11-05

### Bug Fixes

- test payonchain separator was `,` (#648) - ([e59d304](https://github.com/BoltzExchange/boltz-web-app/commit/e59d30403e34299cfa525357e62371c6d0262351))
- error when camera permissions is denied (#635) - ([6d96290](https://github.com/BoltzExchange/boltz-web-app/commit/6d96290fa7900258aefc0ececa3dafb386afdd5b))
- allow single refund file to be uploaded as backup (#651) - ([9a45b7e](https://github.com/BoltzExchange/boltz-web-app/commit/9a45b7e43bd16641a869053f8191c9ddb57d3697))
- block explorer links for RSK - ([cda71d0](https://github.com/BoltzExchange/boltz-web-app/commit/cda71d09fcf1a692f44a59efe769308df2453474))
- add missing strings - ([ea640bf](https://github.com/BoltzExchange/boltz-web-app/commit/ea640bf41fd10f00df0fc99a2f9bb8ba379852d7))
- add missing strings - ([68d225c](https://github.com/BoltzExchange/boltz-web-app/commit/68d225c4dc03ea5a55792192c5e5275e58326bc1))
- wallet selection on submarine lockup - ([897b4ae](https://github.com/BoltzExchange/boltz-web-app/commit/897b4ae3edd41e1c9c21a778beda790bd3d8eaf2))
- make .env file optional on regtest (#657) - ([9f5122a](https://github.com/BoltzExchange/boltz-web-app/commit/9f5122a48e541afa3faef40507384be57b624065))
- add URL params doc to menu (#660) - ([c624d2a](https://github.com/BoltzExchange/boltz-web-app/commit/c624d2abfdc5c2630d66475c6bb05164df0d8905))
- add timeout to BIP-353 DNS lookup (#704) - ([7ecf7a3](https://github.com/BoltzExchange/boltz-web-app/commit/7ecf7a344c5e0edbc4dfac24e0cdecd7c2a6c7d2))
- reduce error correction level for refund QRs (#711) - ([382d523](https://github.com/BoltzExchange/boltz-web-app/commit/382d523f353e9380f7a458656f63ed9d580aaf05))
- EIP-712 compatibility with Trezor One - ([1392b1d](https://github.com/BoltzExchange/boltz-web-app/commit/1392b1d3e3dedbe19f6d142be9b3f0f25402f21e))
- transaction prompt for locking EVM - ([75bde46](https://github.com/BoltzExchange/boltz-web-app/commit/75bde465aa14d5097e5db69cd368d1caa3586112))
- revert to working ledger eth app version - ([74f01c4](https://github.com/BoltzExchange/boltz-web-app/commit/74f01c4a554fe8eeae327779eb2e9c1f272b8efe))
- do not show testnet derivation path on mainnet - ([7fbde1c](https://github.com/BoltzExchange/boltz-web-app/commit/7fbde1c84936cae50d1d82a8ec642403d6cb590e))
- address connect prompt - ([374517c](https://github.com/BoltzExchange/boltz-web-app/commit/374517c56c7b18006213be361a18ef0316a4d4b7))
- hide browser native wallet when window.ethereum is undefined - ([3e4a212](https://github.com/BoltzExchange/boltz-web-app/commit/3e4a2125bc6e65b6c103f936604a0440672257b3))
- invalid pair hash detection - ([37f5d19](https://github.com/BoltzExchange/boltz-web-app/commit/37f5d197890de6cd69474ccc9d270404fcff4a8d))
- broken EVM reactivity - ([dd15284](https://github.com/BoltzExchange/boltz-web-app/commit/dd15284bc3a5b9f0f2610be3987b8534d367d014))

### Documentation

- URL query parameters - ([f9975e6](https://github.com/BoltzExchange/boltz-web-app/commit/f9975e698831eb853b75bcd612d9962f8c8e018d))

### Features

- improve swap list (#631) - ([e280f2e](https://github.com/BoltzExchange/boltz-web-app/commit/e280f2efe507831cb1b5990bb28e9ca8277a27d6))
- implement RIF relay for claim transactions - ([8a93230](https://github.com/BoltzExchange/boltz-web-app/commit/8a93230930f767d08c87132b39e8705c92078b6f))
- show insufficient balance for EVM lockup - ([69e5069](https://github.com/BoltzExchange/boltz-web-app/commit/69e5069535e4ceef97bbe715ea75d8537a52a92d))
- multiple wallet selection options - ([6307bab](https://github.com/BoltzExchange/boltz-web-app/commit/6307babbbb88bdcc6ded9638688816ee5e324187))
- crop EVM address on mobile - ([5ef9893](https://github.com/BoltzExchange/boltz-web-app/commit/5ef98939fce76e8c1f278a7c6da3efcf547d3846))
- remember wallet of swap - ([8d047e5](https://github.com/BoltzExchange/boltz-web-app/commit/8d047e5c952e537e985a50afd12603dc1be84681))
- detect and switch network - ([f386d8e](https://github.com/BoltzExchange/boltz-web-app/commit/f386d8e4f4705c432aaa6439ab6f0b3c563fce86))
- check network when connecting wallet - ([a9266eb](https://github.com/BoltzExchange/boltz-web-app/commit/a9266eb0814815535a55b30e322c3ef44ba2d070))
- scan contract logs for possible refunds - ([38aa067](https://github.com/BoltzExchange/boltz-web-app/commit/38aa067aa761cba3c250b80a4d64c4aec8e24dc6))
- EVM refund log scanning - ([6732ca4](https://github.com/BoltzExchange/boltz-web-app/commit/6732ca4b83fe5a6b0b78508dbe1afe4fe0d03bd9))
- use custom RPC provider for log scanning - ([4adcbd3](https://github.com/BoltzExchange/boltz-web-app/commit/4adcbd388ca5ca89e3a507db27654e28dbafd597))
- progress indicator for logs rescan - ([69d0f94](https://github.com/BoltzExchange/boltz-web-app/commit/69d0f947b4c7ca6ddd633f48e53abcb7bb39f475))
- WebSocket fallback URL - ([8659a57](https://github.com/BoltzExchange/boltz-web-app/commit/8659a579f87b4450e492b28e0cbd53a4cd86cc89))
- improve embedding of swapbox - ([ed5b350](https://github.com/BoltzExchange/boltz-web-app/commit/ed5b35066bf564572b88e893a0ab74703ea4fe33))
- renegotiate chain swap amounts (#662) - ([4ec6e5c](https://github.com/BoltzExchange/boltz-web-app/commit/4ec6e5cf9c51e9465fa84e94697f1fac9078eeff))
- show swap ID after uploading file (#677) - ([e203f9c](https://github.com/BoltzExchange/boltz-web-app/commit/e203f9ca4ac95d7eb8b59ef20569c9f9aa8296d5))
- show address on EVM send screen (#682) - ([c3a0baa](https://github.com/BoltzExchange/boltz-web-app/commit/c3a0baad1071ae591ff76ad5a7d74dc34edfd363))
- bolt12 support for submarine swaps - ([8b9c1cb](https://github.com/BoltzExchange/boltz-web-app/commit/8b9c1cbf62ab562529d0029149b1398b81cc0034))
- implement Discount CT (#697) - ([7d13dcb](https://github.com/BoltzExchange/boltz-web-app/commit/7d13dcb54e6b9bd417e76972d04d4877abafba5a))
- language URL search parameter (#698) - ([6bcfad2](https://github.com/BoltzExchange/boltz-web-app/commit/6bcfad295d910716c22f02ed8b773a77194e5d41))
- fetch BIP-353 with DNSSEC prover (#700) - ([e1991a6](https://github.com/BoltzExchange/boltz-web-app/commit/e1991a6c9d39cfb92869f527684468fb7f0ce99b))
- validate invoices fetched for offers (#706) - ([a732713](https://github.com/BoltzExchange/boltz-web-app/commit/a7327130cd9ba17dbcac15c2cb8529d85ff9a3c5))
- ledger support - ([ad621c5](https://github.com/BoltzExchange/boltz-web-app/commit/ad621c5e3fa2346da1458b9c53256d20d198a15b))
- trezor support - ([ef8479b](https://github.com/BoltzExchange/boltz-web-app/commit/ef8479bd47e422133625a9943cc378e2a7b6bfe7))
- hardware custom derivation paths - ([f4d8220](https://github.com/BoltzExchange/boltz-web-app/commit/f4d8220e791b2fe610437e88a255f7a86b49c702))
- loading indicator for wallet selection - ([9d96971](https://github.com/BoltzExchange/boltz-web-app/commit/9d96971123b82d64dee612e4c0f76aa786493bca))
- remember custom derivation paths for swaps - ([274c906](https://github.com/BoltzExchange/boltz-web-app/commit/274c906a21d266d4ec2f9e404a13dafbaeb0282a))
- add Japanese (#702) - ([0a032a8](https://github.com/BoltzExchange/boltz-web-app/commit/0a032a8ef7fb21d615a0724d243d861665966e1b))
- browser native web3 wallet support (#701) - ([031c4c6](https://github.com/BoltzExchange/boltz-web-app/commit/031c4c674ed3276eeaca69b9e9881fe95e45cd06))
- show EVM lockup transactions (#715) - ([9c9184c](https://github.com/BoltzExchange/boltz-web-app/commit/9c9184c5a9ae4577631b7e14f033253b8cb488d2))

### Miscellaneous Chores

- update dependencies (#650) - ([8b22b04](https://github.com/BoltzExchange/boltz-web-app/commit/8b22b04f416a8f090c33e726ceae4787c14af482))
- publish Docker on push (#652) - ([8b69453](https://github.com/BoltzExchange/boltz-web-app/commit/8b694536e0674e071f6b106bb7e3b5a1741e3076))
- update regtest block explorer URLs - ([1a91eb6](https://github.com/BoltzExchange/boltz-web-app/commit/1a91eb6606ce5193686f62c22ff5f5b0664f8ab1))
- update regtest RIF addresses - ([7dcfbe2](https://github.com/BoltzExchange/boltz-web-app/commit/7dcfbe23ae2970851ea5f0ace00f1dd141d4a7cf))
- add RBTC to landing page - ([8c5514c](https://github.com/BoltzExchange/boltz-web-app/commit/8c5514c048a37fcd2a0eec5e969decbfa94df56d))
- run prettier - ([1e2fc28](https://github.com/BoltzExchange/boltz-web-app/commit/1e2fc2843c6c3d0fe0a524de0984a57a12248dd4))
- optimize RIF relay calls - ([cabc34b](https://github.com/BoltzExchange/boltz-web-app/commit/cabc34bb3e77e7356c8676a02c81104052ecea88))
- bump regtest version - ([bef523c](https://github.com/BoltzExchange/boltz-web-app/commit/bef523c4c88841eebd6755f9b174e57629b5e49e))
- add missing strings - ([10e9419](https://github.com/BoltzExchange/boltz-web-app/commit/10e94191e8605064d2f4b9c7595a95213dd5172a))
- add missing translations - ([fa533ed](https://github.com/BoltzExchange/boltz-web-app/commit/fa533edf35fafed4ccb08f784568a8aa55fd4809))
- bump dependencies - ([a3bbd64](https://github.com/BoltzExchange/boltz-web-app/commit/a3bbd64905e901908c18cb0a364068249f5a57cd))
- run prettier on docs - ([74b6777](https://github.com/BoltzExchange/boltz-web-app/commit/74b6777ff2718339b8b4cf94a6e4f36009e2ec02))
- update regtest (#663) - ([c957ad1](https://github.com/BoltzExchange/boltz-web-app/commit/c957ad1216d235e8f39c45bf2cebce30c27362b2))
- simplify footer (#664) - ([4769214](https://github.com/BoltzExchange/boltz-web-app/commit/4769214cbcf88696fde114df72c5835577b163d6))
- fix vulnerable dependencies (#670) - ([08c65bb](https://github.com/BoltzExchange/boltz-web-app/commit/08c65bbc216578f22d9c556ef4a78bf2fb580814))
- minor RSK fixes (#671) - ([abb4c7f](https://github.com/BoltzExchange/boltz-web-app/commit/abb4c7f8ac2762e8532b418b1737dabe52cf955f))
- enable RSK on beta site (#672) - ([6980615](https://github.com/BoltzExchange/boltz-web-app/commit/698061529c2cb066a3f6b6ca25a2cebafff09e22))
- reword for bolt12 - ([8e32075](https://github.com/BoltzExchange/boltz-web-app/commit/8e32075485ddcea9d02a11ddb548b227ff8158cb))
- bump regtest for Bitcoin Core v28.0 support (#688) - ([e8c9aa8](https://github.com/BoltzExchange/boltz-web-app/commit/e8c9aa8a63bbdc331a2ab7f2f77a7ffbad302bf2))
- release v1.4.2 - ([81cacd4](https://github.com/BoltzExchange/boltz-web-app/commit/81cacd4063ec087fc75498698d8668e20c3786d9))
- add BancoLibre to integrations - ([2641a39](https://github.com/BoltzExchange/boltz-web-app/commit/2641a3930b73aeb631744f07530f5f4b434c7648))
- add StashPay to integrations - ([69cb83b](https://github.com/BoltzExchange/boltz-web-app/commit/69cb83b2b173dab4d2582c6fd49b02e76d219677))
- bump bolt12 resolve timeout (#710) - ([6a844a0](https://github.com/BoltzExchange/boltz-web-app/commit/6a844a02f58c1fbb1fd58a18174f9089564675c7))
- show ledger not supported message - ([5df045d](https://github.com/BoltzExchange/boltz-web-app/commit/5df045de231d32f8628cb80c69756521505fb07f))
- allow RSK Test ledger app - ([25476e9](https://github.com/BoltzExchange/boltz-web-app/commit/25476e93485dcc02a02279f3c7b3bd04ecf764db))
- add new strings, misc fixes - ([4934d37](https://github.com/BoltzExchange/boltz-web-app/commit/4934d37bf5d7740c252c38e901915681b702224e))
- add timeout in Japanese - ([0d69faa](https://github.com/BoltzExchange/boltz-web-app/commit/0d69faa2756721bce22b4e2c3a0fda58036384f6))
- update dependencies (#713) - ([723f072](https://github.com/BoltzExchange/boltz-web-app/commit/723f0722a6ac0681feacbee34b14ff9c8fdb950a))
- fix Docker build on arm64 (#714) - ([daf4c5e](https://github.com/BoltzExchange/boltz-web-app/commit/daf4c5e35b96792235d30925754dfe6e7053d800))
- add basic ESLint config - ([bd84463](https://github.com/BoltzExchange/boltz-web-app/commit/bd84463b3ae59430e0e7e4a708b6eff3dd44eabd))
- run prettier on public folder - ([cf67887](https://github.com/BoltzExchange/boltz-web-app/commit/cf6788782db0f972c2ed4ec6e39fe89e82ff6996))
- fix package-lock.json for Docker build - ([eb5bc5e](https://github.com/BoltzExchange/boltz-web-app/commit/eb5bc5e5a3826f5a73495f56bd61c80129b3fb31))
- bump version to v1.5.0 - ([dc0f4ac](https://github.com/BoltzExchange/boltz-web-app/commit/dc0f4acfbe7c00ea4c39901b9b6e1ddede36f483))

### Refactoring

- remove all Metamask wording - ([d914789](https://github.com/BoltzExchange/boltz-web-app/commit/d914789b0e429fc78fe33d1f09f0ae783cbb0eeb))
- rewrite build check script in Python - ([4ad7da0](https://github.com/BoltzExchange/boltz-web-app/commit/4ad7da0d1046716d2bdd4e052ca52adfd69f78b9))
- remove API endpoint based on pair - ([255e511](https://github.com/BoltzExchange/boltz-web-app/commit/255e511d6cc17a8e2629597e67a68bb94aa99bcd))
- only require a single signature for a RIF transaction (#665) - ([7ed509f](https://github.com/BoltzExchange/boltz-web-app/commit/7ed509f18863e4ebbdd8845f02a6307ba4db9437))
- cleanup RSK claim page (#687) - ([d37de5a](https://github.com/BoltzExchange/boltz-web-app/commit/d37de5a630a0f3b5286d1f287559c4e5790656f2))
- improve invoice fetching (#699) - ([7703f36](https://github.com/BoltzExchange/boltz-web-app/commit/7703f36d7ffc5595c933aeaf6b8d64ff86cb06e4))
- remove open Ledger app prompt - ([e3ca2a7](https://github.com/BoltzExchange/boltz-web-app/commit/e3ca2a7a2de4589e4e88df9ee8ca529dde6cbac8))
- lazy load HWW dependencies - ([4f8ed9a](https://github.com/BoltzExchange/boltz-web-app/commit/4f8ed9aefea6ba41cc029cd4edb984c5ef15a66f))
- lazy load bolt12 library - ([c3594ad](https://github.com/BoltzExchange/boltz-web-app/commit/c3594adedf09f2076d6cdbf9cb158032520ed265))
- lazy load @vulpemventures/secp256k1-zkp - ([43a5004](https://github.com/BoltzExchange/boltz-web-app/commit/43a50048c991ddbd46992411159fbf4bc3d48036))
- move HWW lazy loaders - ([3e2dd57](https://github.com/BoltzExchange/boltz-web-app/commit/3e2dd57106e73f35f411bf0ec3f0280a7f0a8166))

### Tests

- e2e tests for BTC swaps (#655) - ([0fe7bcf](https://github.com/BoltzExchange/boltz-web-app/commit/0fe7bcff6ef6f8b34a68162ccbc262adf845ea7e))

---
## [1.4.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.4.0..v1.4.1) - 2024-07-22

### Bug Fixes

- time drift in date parsing - ([de3344a](https://github.com/BoltzExchange/boltz-web-app/commit/de3344a7cfeea8f7f9c5b5b77c9f5043bc9edfa7))
- legacy Liquid refunds (#616) - ([6f5a4a0](https://github.com/BoltzExchange/boltz-web-app/commit/6f5a4a07c3341d51ac1cfc1446fb5f2233909acb))
- error formatting in notifications (#617) - ([7bceb68](https://github.com/BoltzExchange/boltz-web-app/commit/7bceb68cd254b323efafc4c4ab8c0284fd6b1cfe))
- missing refund page for failed chain swap (#621) - ([7fdc338](https://github.com/BoltzExchange/boltz-web-app/commit/7fdc338b36439cdf12b4fe175f5d28c5ccb37e2a))
- translation of settings not switching - ([0b833b5](https://github.com/BoltzExchange/boltz-web-app/commit/0b833b5cb509bfb12b0f869db38b643c1cf6c766))
- refund transaction error handling (#627) - ([87b8547](https://github.com/BoltzExchange/boltz-web-app/commit/87b8547956ad791d12f68b3a1006faad589a8031))
- Nginx 404 with Docker on paths (#632) - ([bd6ac77](https://github.com/BoltzExchange/boltz-web-app/commit/bd6ac77f91c8072b763aa3b84ff31710d70d7c6a))
- Error type serialization in logger (#634) - ([ebb59de](https://github.com/BoltzExchange/boltz-web-app/commit/ebb59de873f1f748a8979b29db084ff3e13d4f0a))
- swap box clears address on asset switch (#633) - ([cc990cf](https://github.com/BoltzExchange/boltz-web-app/commit/cc990cf10876931075d4f0dbb633651e45326cd7))
- prevent pasting same value twice - ([5ae7bf2](https://github.com/BoltzExchange/boltz-web-app/commit/5ae7bf2211e885f1984fefbbe72dd03cdd47840a))
- switch separator on paste - ([8df049c](https://github.com/BoltzExchange/boltz-web-app/commit/8df049c366194fd03e4ea135b28f5a44c6f2a655))

### Features

- show cooperative refund error on broadcast fail (#624) - ([9dbb9a4](https://github.com/BoltzExchange/boltz-web-app/commit/9dbb9a48cff07d51548480a1141e36a3f7099e73))
- reckless mode - ([9233260](https://github.com/BoltzExchange/boltz-web-app/commit/92332601abc3217ef78f94ca7bfcf30c0c0783b0))
- add warning to download filenames (#630) - ([5a0d7f2](https://github.com/BoltzExchange/boltz-web-app/commit/5a0d7f29260395767dad56f4409a03cc2f4fea62))

### Miscellaneous Chores

- minor subline wording change (#612) - ([c930680](https://github.com/BoltzExchange/boltz-web-app/commit/c930680cd4265642560192c3e3d414f4a2d2b9cc))
- dependency updates (#615) - ([d5109e1](https://github.com/BoltzExchange/boltz-web-app/commit/d5109e1f4876fea01c165ba8322d03eab1c62195))
- remove bolt.observer (#618) - ([22d7171](https://github.com/BoltzExchange/boltz-web-app/commit/22d71719419915e90a1dd419afc4892fb3c9196c))
- update README (#619) - ([6e9efcf](https://github.com/BoltzExchange/boltz-web-app/commit/6e9efcf731ecff75494eaebc8181ffe843c802bb))
- update dependencies (#620) - ([4117572](https://github.com/BoltzExchange/boltz-web-app/commit/411757245bbe11301598856a89887196d652fc9e))
- reorder run from source instructions (#628) - ([691ed5b](https://github.com/BoltzExchange/boltz-web-app/commit/691ed5b29c72cee66be9de998c64fe7cd2a0cea6))
- add Blitz and Helm as integrations (#642) - ([87f4ea9](https://github.com/BoltzExchange/boltz-web-app/commit/87f4ea963e6f5bfa7959bee3d1868fa35a93c6df))
- update version to v1.4.1 and prepare release (#647) - ([d956aa9](https://github.com/BoltzExchange/boltz-web-app/commit/d956aa93af2f10756bf86cdb40f3173f404ba95d))

### Refactoring

- move block explorer link out of Pay page (#613) - ([154e108](https://github.com/BoltzExchange/boltz-web-app/commit/154e1085cb15e228a0a32674ed32b7d8015b07e1))
- use consts and `Switch` for swap status (#640) - ([41218e6](https://github.com/BoltzExchange/boltz-web-app/commit/41218e6972e27f4fe5ccf767689d93d7cdc9c5ed))
- lightning node stats (#643) - ([00c51ca](https://github.com/BoltzExchange/boltz-web-app/commit/00c51cad2e49801315ae4d08047bb224591e3f58))

---
## [1.4.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.3.5..v1.4.0) - 2024-05-29

### Bug Fixes

- only set failure reason for current swap (#595) - ([a4169fe](https://github.com/BoltzExchange/boltz-web-app/commit/a4169febf884b3efba1fc1925853b99266aa8cd4))
- log settings buttons (#597) - ([53a303a](https://github.com/BoltzExchange/boltz-web-app/commit/53a303a052e68d8a4acdf6f59b56ec4a28f835a1))
- copy amount with correct denomination (#599) - ([47ec05c](https://github.com/BoltzExchange/boltz-web-app/commit/47ec05cc8a4f94b3b8747afaf696a0d9b40af03e))
- handle chain swaps not being available - ([bd3e00a](https://github.com/BoltzExchange/boltz-web-app/commit/bd3e00a7cc2e0d77b602e7d99943d8488f566264))
- chain swaps to unconfidential Liquid addresses - ([8e3fa41](https://github.com/BoltzExchange/boltz-web-app/commit/8e3fa415fafe11b171dea563e78d526e13911765))
- increase refund QR size (#606) - ([3625883](https://github.com/BoltzExchange/boltz-web-app/commit/3625883e57081c3c3cf3d21cd2b06ea33459e4bb))
- initialize secp before creating claim transaction (#607) - ([2af6839](https://github.com/BoltzExchange/boltz-web-app/commit/2af6839677894f880363183148997fdbfa65d236))
- chain swap lockup address link - ([edae12f](https://github.com/BoltzExchange/boltz-web-app/commit/edae12f6950a2bc098fdbb1a0d920d422898fa92))
- chain swap miner fee calculations (#610) - ([0416a9d](https://github.com/BoltzExchange/boltz-web-app/commit/0416a9dfa20ca23e8ba03b0746dd840f3d3ac0f0))

### Features

- add `Dockerfile` (#591) - ([f557118](https://github.com/BoltzExchange/boltz-web-app/commit/f557118ac527f6422d989038151108305b8201b6))
- play sound on successful swaps (#536) - ([caa861a](https://github.com/BoltzExchange/boltz-web-app/commit/caa861a81ac8fa7ec0ac9d2268127edcfee525e2))
- show amount on success page (#590) - ([dc5150d](https://github.com/BoltzExchange/boltz-web-app/commit/dc5150d75fa1a9f397fc02bd3c5d88bf75ea5049))
- add browser notification (#528) - ([e5461f7](https://github.com/BoltzExchange/boltz-web-app/commit/e5461f71470356f2b0de1c3e5edab75141a510dd))
- chain swaps (#551) - ([caffdda](https://github.com/BoltzExchange/boltz-web-app/commit/caffdda5a94b6ddccacaca7eacfb477c2c8da69a))

### Miscellaneous Chores

- remove license disclaimer in README - ([d514c82](https://github.com/BoltzExchange/boltz-web-app/commit/d514c82ce68dfead6ec77cd20e3665685874a593))
- add Bull Bitcoin as integration (#603) - ([f305eaf](https://github.com/BoltzExchange/boltz-web-app/commit/f305eafafd6f1d033a6b1def12319c961c83abc4))
- fix wording of refunded line - ([5a80247](https://github.com/BoltzExchange/boltz-web-app/commit/5a80247e93f31495cf686af3b0b63cc5110716f8))
- change headline to Bitcoin Bridge (#604) - ([18d4b95](https://github.com/BoltzExchange/boltz-web-app/commit/18d4b9524d0e5dae42303a15b41b3e0cd2bb65be))
- prepare release v1.4.0 - ([030e35e](https://github.com/BoltzExchange/boltz-web-app/commit/030e35ef047421452b77d3a61c2e713e7f958dea))

### Refactoring

- use trash icon instead of `delete` in SwapList (#596) - ([99b772e](https://github.com/BoltzExchange/boltz-web-app/commit/99b772ed06d06642d6964cbe82053d80da9674ae))

---
## [1.3.5](https://github.com/BoltzExchange/boltz-web-app/compare/v1.3.4..v1.3.5) - 2024-05-17

### Bug Fixes

- disable swaps to unconfidential addresses (#566) - ([55d87f7](https://github.com/BoltzExchange/boltz-web-app/commit/55d87f7f084c0a4963b30709d7f34c06bbc5897b))
- add 1 sat to miner fee when swapping to unconfidential address - ([56ef80f](https://github.com/BoltzExchange/boltz-web-app/commit/56ef80fa7c93f846c120e7e075e5e99fea1ea586))
- capitalize subline (#570) - ([55b4bb8](https://github.com/BoltzExchange/boltz-web-app/commit/55b4bb8d5a44cdda657da6a476add44e50ca0d3c))
- hot reload issue (#577) - ([c4bde0c](https://github.com/BoltzExchange/boltz-web-app/commit/c4bde0c80756021ceed3ad9b22f537416b0ce0b7))
- improve close of settings box (#580) - ([9029b0a](https://github.com/BoltzExchange/boltz-web-app/commit/9029b0abb9dfcb4c3162801d88c2527dd190af51))
- retry claiming on reload (#582) - ([96c0268](https://github.com/BoltzExchange/boltz-web-app/commit/96c026868d60b22c59bc14dbe45dc0401db25242))

### Features

- add geyser integration (#574) - ([1efa4d2](https://github.com/BoltzExchange/boltz-web-app/commit/1efa4d21a07f6685056a0ee1dfbd3e3fbe3d9b6c))
- add setting menu (#549) - ([1719ce0](https://github.com/BoltzExchange/boltz-web-app/commit/1719ce091fb06c02d50e7a34d3d46b58e50568e7))
- change license to AGPL3 (#588) - ([77d96b8](https://github.com/BoltzExchange/boltz-web-app/commit/77d96b8cf5e7adb394d300271efe3bde7fe41fa6))
- capture logs in browser storage (#576) - ([e8a9689](https://github.com/BoltzExchange/boltz-web-app/commit/e8a968978cba326c79c26184cc7bbcafdebe952c))
- add `release.sh` for release chores (#565) - ([accef30](https://github.com/BoltzExchange/boltz-web-app/commit/accef302f864de7160b5d15b6f28946170b5ee67))

### Miscellaneous Chores

- blog link update (#568) - ([a0a9be8](https://github.com/BoltzExchange/boltz-web-app/commit/a0a9be828632e359216b016591993d50dbdc0858))
- remove logging of refund transaction (#592) - ([cd9a76f](https://github.com/BoltzExchange/boltz-web-app/commit/cd9a76f5f5f2ab80ba5ee866c4e29dcb558fffeb))
- increase tooltip click delay (#593) - ([8c72cf2](https://github.com/BoltzExchange/boltz-web-app/commit/8c72cf2058946c6a11c3e78d735c840d370906a0))
- update version to 1.3.5 and prepare release (#594) - ([15e5c44](https://github.com/BoltzExchange/boltz-web-app/commit/15e5c44898cfe0670a41c64416c44e8e74245902))

### Refactoring

- swap found wording on refund page (#589) - ([b91498e](https://github.com/BoltzExchange/boltz-web-app/commit/b91498e2726741082e6a5af13a7165538fd25d3a))

---
## [1.3.4](https://github.com/BoltzExchange/boltz-web-app/compare/v1.3.3..v1.3.4) - 2024-04-23

### Bug Fixes

- small number BTC denomination (#560) - ([ed35055](https://github.com/BoltzExchange/boltz-web-app/commit/ed350551cb3284bd0a7e68cdce45e2c3355546c2))

### Features

- QR code icon depending on asset (#559) - ([dbf2d08](https://github.com/BoltzExchange/boltz-web-app/commit/dbf2d08c131a24f0776d288d4b328eeaaea4db8a))

### Miscellaneous Chores

- set mainnet log level to debug - ([7f37914](https://github.com/BoltzExchange/boltz-web-app/commit/7f3791406db4c042cdbe6b5f86528d0b5498423b))
- prepare release v1.3.4 (#563) - ([39f22b9](https://github.com/BoltzExchange/boltz-web-app/commit/39f22b909972e8286787735da52e0c0f0ef70488))

### Refactoring

- use <a> for swap history links (#557) - ([186cd14](https://github.com/BoltzExchange/boltz-web-app/commit/186cd146ae278a45ed0795b5154f82bcef4a4df1))

---
## [1.3.3](https://github.com/BoltzExchange/boltz-web-app/compare/v1.3.1..v1.3.3) - 2024-04-16

### Bug Fixes

- NPM package version - ([6a1cb3c](https://github.com/BoltzExchange/boltz-web-app/commit/6a1cb3c90c636965387754d6bc9fec7e0c8f6bf7))
- remove RBTC from beta and mainnet (#512) - ([cd6d2d0](https://github.com/BoltzExchange/boltz-web-app/commit/cd6d2d05b6f3036fda3f3133901ebe2c766831b3))
- register serviceworker on / (#511) - ([11bb6f9](https://github.com/BoltzExchange/boltz-web-app/commit/11bb6f9f67ade92bb6a7961f13c94be8d5ac0602))
- error handling for null swap in pay (#515) - ([6471a7d](https://github.com/BoltzExchange/boltz-web-app/commit/6471a7d22b047c99450bb289785fe2b6c2eb3c9b))
- show EVM coop refund on lockup failed (#517) - ([992959b](https://github.com/BoltzExchange/boltz-web-app/commit/992959b1c7173149e67fa611b1b63ae23cfb66cb))
- bail validation and refactor create button labels (#500) - ([9bef8c2](https://github.com/BoltzExchange/boltz-web-app/commit/9bef8c2b90326cf6f6c9279f5c544cda4b5430d6))
- CSS for external links in menu (#527) - ([972d825](https://github.com/BoltzExchange/boltz-web-app/commit/972d8253f45d5bf5c003542a2e0d9e9bbef0385f))
- only retry claims of Taproot swaps (#531) - ([5559cf1](https://github.com/BoltzExchange/boltz-web-app/commit/5559cf145bc3d75b60fb749811229d0e3ec67c2f))
- catch exception on refund page (#534) - ([a7928f4](https://github.com/BoltzExchange/boltz-web-app/commit/a7928f4db7b958caf7fa5eb8ba8e785785bd75e1))
- node stats when LND is offline (#539) - ([e472f91](https://github.com/BoltzExchange/boltz-web-app/commit/e472f91fbbfa7031f5e8d4bc118c72fe1c8966f7))
- QR code placeholder size (#541) - ([5806d2d](https://github.com/BoltzExchange/boltz-web-app/commit/5806d2dd3581278f8a4cf43cfa72a01c3fa3e85f))
- multiple claim transactions being broadcasted (#542) - ([00c253c](https://github.com/BoltzExchange/boltz-web-app/commit/00c253c1bc6a1cae4960376e73d801dda77c8eb8))
- remove spaces when copying (#543) - ([a3da6c1](https://github.com/BoltzExchange/boltz-web-app/commit/a3da6c1e83b8698340fdc5c30f1c51ab35fc2028))
- multiple tabs local storage issue (#544) - ([6ac99d5](https://github.com/BoltzExchange/boltz-web-app/commit/6ac99d5895f95f81ad897c367c7ef6268846a46b))
- hide network in navbar on mainnet (#550) - ([2f50a51](https://github.com/BoltzExchange/boltz-web-app/commit/2f50a515eec71757539d002beb6fccc755a32782))
- disable until lnurl is fetched and submitted (#553) - ([6f56d54](https://github.com/BoltzExchange/boltz-web-app/commit/6f56d54584d8775125a5b18d5559fb797081a76a))
- regtest invoice validtion on mainnet (#554) - ([2c59c0c](https://github.com/BoltzExchange/boltz-web-app/commit/2c59c0c729982d89e1b647d96cd3e340d0d54b95))

### Documentation

- fix "Back to Docs Home" link - ([6926d17](https://github.com/BoltzExchange/boltz-web-app/commit/6926d1731929b6d1cb4c7ac9781508de75e311f9))

### Features

- add email to footer (#502) - ([4225a41](https://github.com/BoltzExchange/boltz-web-app/commit/4225a41cab32f42c2fd6e1a5c6cbf5d6af2e094a))
- Telegram icon for footer (#505) - ([cd72aee](https://github.com/BoltzExchange/boltz-web-app/commit/cd72aee9ead88cbc162bd424c60c1a392e0187f8))
- dynamic config (#507) - ([b701332](https://github.com/BoltzExchange/boltz-web-app/commit/b701332dc77039ca49b4b2e959ee399cb30209e2))
- add user feedback to copy button (#516) - ([bd1dd61](https://github.com/BoltzExchange/boltz-web-app/commit/bd1dd618907c2258969dcbd915790b24d141c71e))
- prevent refunding to lockup address (#523) - ([0ea46d8](https://github.com/BoltzExchange/boltz-web-app/commit/0ea46d8cd315099b95f6b9b45d792405ee0bb135))
- switch assets based on input (#503) - ([53924e1](https://github.com/BoltzExchange/boltz-web-app/commit/53924e11084adc69e361bc8607a1c1347e28859a))
- localized BTC denomination separator (#538) - ([70f4842](https://github.com/BoltzExchange/boltz-web-app/commit/70f484211e72ecd3fe842b177b5f9cfa817d1fd6))

### Miscellaneous Chores

- bump follow-redirects from 1.15.5 to 1.15.6 (#513) - ([e0eacf6](https://github.com/BoltzExchange/boltz-web-app/commit/e0eacf6391a54d8f6c40559f9142ed169d69a073))
- update dependencies (#518) - ([50fbc8f](https://github.com/BoltzExchange/boltz-web-app/commit/50fbc8fe063169561fed9dc951d45f7313f9aed2))
- update CI checkout action (#519) - ([a5a9af2](https://github.com/BoltzExchange/boltz-web-app/commit/a5a9af2c438b1e5aa02373c0ffe7a27fa8fcc1d6))
- change youtube link to playlist (#522) - ([2808f16](https://github.com/BoltzExchange/boltz-web-app/commit/2808f16c2d4d78ea33fe4314b9656121a0e6df12))
- add canary link (#526) - ([626f0d1](https://github.com/BoltzExchange/boltz-web-app/commit/626f0d106731809077adfc50e096890bbb39b558))
- use compareTrees function from boltz-core (#532) - ([efbd8fa](https://github.com/BoltzExchange/boltz-web-app/commit/efbd8fa1be8d73aa31ae11bd848b86db423eca54))
- show return to page only on mobile (#537) - ([029ae81](https://github.com/BoltzExchange/boltz-web-app/commit/029ae812b14a6166979c8e0c737e81c79c904e05))
- prepare release v1.3.2 - ([46561e2](https://github.com/BoltzExchange/boltz-web-app/commit/46561e2acb7a4d3eb5f366e0511ad3ff87496ca7))
- bump vite from 5.2.4 to 5.2.6 (#552) - ([2b291d4](https://github.com/BoltzExchange/boltz-web-app/commit/2b291d423ed77ddc679f0e9eb1e4c4fee54a5d01))
- prepare release v1.3.3 (#556) - ([89e901c](https://github.com/BoltzExchange/boltz-web-app/commit/89e901cd9bebb62495fd9e33705c5a31ccdd05a0))

### Refactoring

- move create button signal to context (#497) - ([19ccdbc](https://github.com/BoltzExchange/boltz-web-app/commit/19ccdbcc9191999cbe6ed878488cb3e333c53d18))
- build scripts (#508) - ([c366cb1](https://github.com/BoltzExchange/boltz-web-app/commit/c366cb1838c5305638faf81bbe649519375af208))
- use solid-icons instead of single SVGs (#510) - ([9d4603e](https://github.com/BoltzExchange/boltz-web-app/commit/9d4603ecbee9a7a256177b7a27ba845dc93626b7))
- create swap with lnaddress / lnurl (#535) - ([eb4465e](https://github.com/BoltzExchange/boltz-web-app/commit/eb4465ea15a5642b280b01b04b389afda895baa5))
- node stats formatting (#540) - ([51fa596](https://github.com/BoltzExchange/boltz-web-app/commit/51fa59686d0f1bd9ec52693e0d21c7dfe6f18b58))

### Tests

- set loglevel to error in tests (#514) - ([a61d295](https://github.com/BoltzExchange/boltz-web-app/commit/a61d295e78849c879a459cdd9fbe722d7ec676bc))

---
## [1.3.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.3.0..v1.3.1) - 2024-03-11

### Bug Fixes

- referralId when creating swaps - ([d11b452](https://github.com/BoltzExchange/boltz-web-app/commit/d11b4523e3ec7e10683804c66f3cb593a614b01a))
- legacy pair miner fee calculation - ([216d01b](https://github.com/BoltzExchange/boltz-web-app/commit/216d01b4c56ad1d7fe2302c92aa279eb182423d7))
- autoswitch off by 1 (#467) - ([32b1626](https://github.com/BoltzExchange/boltz-web-app/commit/32b16263cde40072e1bf87e0a07f16e524e498b6))
- broken tests - ([ab53dc2](https://github.com/BoltzExchange/boltz-web-app/commit/ab53dc2a0d2b60151ed869d0bd02f465d83e0d1f))
- catch error on 0 amount invoices (#477) - ([9351202](https://github.com/BoltzExchange/boltz-web-app/commit/9351202cedf668737cc9e449db2c228535aa5e49))
- safety check if swap was found (#484) - ([71841cf](https://github.com/BoltzExchange/boltz-web-app/commit/71841cf9ff5b7b639c969b16133229829380f2d2))
- disable WebLN invoice button on invalid amount (#479) - ([1a89612](https://github.com/BoltzExchange/boltz-web-app/commit/1a896129b8ed5f923a1666098176cbad92912946))
- retry Taproot claims (#487) - ([58e1319](https://github.com/BoltzExchange/boltz-web-app/commit/58e131957d752fb5fafc506186cbcbedfd4a5fed))
- duplicate spacer for BTC swaps (#490) - ([0431c57](https://github.com/BoltzExchange/boltz-web-app/commit/0431c5772f8aeae749fd3de4c00639d97486c6f5))
- improve pasting (#496) - ([c9e4a5d](https://github.com/BoltzExchange/boltz-web-app/commit/c9e4a5d58bc2c5b1204544c84d9008ba28d284f0))

### Features

- handle WIF encoded private keys (#462) - ([80a7c0e](https://github.com/BoltzExchange/boltz-web-app/commit/80a7c0e09e27953ff9ec49ece02980c22f22e503))
- cooperative submarine claims (#463) - ([e188ef9](https://github.com/BoltzExchange/boltz-web-app/commit/e188ef93abe7a4df7cd36663e229c76d9a16f7a3))
- add boltz status page to footer (#466) - ([9c3e5ac](https://github.com/BoltzExchange/boltz-web-app/commit/9c3e5ac2b8693c55ed02de29efd2e8e0f99c0ebf))
- switch from SSE to WS - ([004aeab](https://github.com/BoltzExchange/boltz-web-app/commit/004aeab3bceacc00fca2fadd34177ec8f7717d09))
- cooperative EVM refunds - ([726f30f](https://github.com/BoltzExchange/boltz-web-app/commit/726f30fbc148ad38b1775afadb882b436d75a254))
- migrate all endpoints to v2 - ([d49fa17](https://github.com/BoltzExchange/boltz-web-app/commit/d49fa17c992593e878d57a3d72b13056660073a3))
- fetch node public key - ([570a0d7](https://github.com/BoltzExchange/boltz-web-app/commit/570a0d758353bce91fd1caf5f5c982989a37ed1b))
- add youtube link and create footer nav (#476) - ([9be3c87](https://github.com/BoltzExchange/boltz-web-app/commit/9be3c874ea3d389844f41f829a110dd9b5de5372))
- add testnet link (#486) - ([4a273a3](https://github.com/BoltzExchange/boltz-web-app/commit/4a273a386e7ec915eb8060d2107b1ea5f22859a9))
- show WASM error page if not supported (#485) - ([c1e22a1](https://github.com/BoltzExchange/boltz-web-app/commit/c1e22a19e1f7ff7751bd8c28a973cbf53d571cd8))
- amount max/min error should have priority (#483) - ([4182f85](https://github.com/BoltzExchange/boltz-web-app/commit/4182f85f1f6b4b9ad972f2a6a59176cceea30358))
- only show refund button when file is uploaded (#471) - ([6cd2bc5](https://github.com/BoltzExchange/boltz-web-app/commit/6cd2bc54f748bb5598051ea7c3be5f5cfb925278))
- add loading animation (#493) - ([6963977](https://github.com/BoltzExchange/boltz-web-app/commit/6963977cb3a2ddeacf09c7736107c04e06c6b404))
- implement Satcomma formatting for sats amounts (#494) - ([5902a08](https://github.com/BoltzExchange/boltz-web-app/commit/5902a082f3f42788791147a58bec5280af488602))
- intermediate step when uploading refundjson and proper error (#489) - ([ed395bd](https://github.com/BoltzExchange/boltz-web-app/commit/ed395bd00bc4e5ce03633e851c1e5933e36351c8))

### Miscellaneous Chores

- add aqua and marina as integrations (#461) - ([6e62b9d](https://github.com/BoltzExchange/boltz-web-app/commit/6e62b9dbf9701b61a3b18e2b5f3787907df41d28))
- update dependencies (#472) - ([a9a99ed](https://github.com/BoltzExchange/boltz-web-app/commit/a9a99ed731c02417e97235b106d61d2d63e08eae))
- bump CI Node version - ([341a8ee](https://github.com/BoltzExchange/boltz-web-app/commit/341a8eee779eb5dae97bb1488b213e3b6b6c5692))
- remove unused dependencies - ([7b3ca93](https://github.com/BoltzExchange/boltz-web-app/commit/7b3ca93c73517d376f928a04d720b928b788c11b))
- update dependencies - ([a0585c4](https://github.com/BoltzExchange/boltz-web-app/commit/a0585c4daee0c49bb9b1f34343a3844f3fa90f45))
- bump @openzeppelin/contracts from 5.0.1 to 5.0.2 (#495) - ([df7d063](https://github.com/BoltzExchange/boltz-web-app/commit/df7d06300e7e023cc61d425961f2f45c329e5237))
- release v1.3.1 (#499) - ([55dd4d5](https://github.com/BoltzExchange/boltz-web-app/commit/55dd4d5fea700a3b0059621220183bff70f840f3))

### Refactoring

- switch tests to jest (#473) - ([18345a7](https://github.com/BoltzExchange/boltz-web-app/commit/18345a7f22daeda50acaf0dbfb5476182a1a8977))
- consistent API V2 endpoint usage (#480) - ([04fca42](https://github.com/BoltzExchange/boltz-web-app/commit/04fca4221d0ebc59933e8a8507f3a802983622d8))

### Bug

- address was not validated after assets switch (#475) - ([8cdca78](https://github.com/BoltzExchange/boltz-web-app/commit/8cdca783b1ea241183d624471b6a303aa5159b69))

---
## [1.3.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.2.1..v1.3.0) - 2024-01-25

### Bug Fixes

- refunds on invoice payment failure (#406) - ([b94295a](https://github.com/BoltzExchange/boltz-web-app/commit/b94295a14f9b0174d0f762d44e56870805557cb8))
- network button margin (#407) - ([697fcf2](https://github.com/BoltzExchange/boltz-web-app/commit/697fcf2ac62a3891c3faac2348bbdfc630854c28))
- swap list alignment (#400) - ([2a5ee53](https://github.com/BoltzExchange/boltz-web-app/commit/2a5ee537baae4f795e2b89d4978b2ee3f8646508))
- invoice with millisats precision amount (#425) - ([5da7b41](https://github.com/BoltzExchange/boltz-web-app/commit/5da7b41403edc9a9cec2db53c6b53f6cb60e4a3f))
- use of DOM element references after component cleanup (#421) - ([518ee5e](https://github.com/BoltzExchange/boltz-web-app/commit/518ee5e26eb0c8fa1fa272b6e4115fe7d8e3c0b2))
- copy onchain amount (#433) - ([a00998e](https://github.com/BoltzExchange/boltz-web-app/commit/a00998eb3ccfb5e5bc0cabdd33b63ede447354e4))
- coalesce Boltz fee with 0 - ([dce2002](https://github.com/BoltzExchange/boltz-web-app/commit/dce200260bc4ceab3207dc1563dddc94b5e04641))
- do not create swap when WASM is not available (#446) - ([43c39bf](https://github.com/BoltzExchange/boltz-web-app/commit/43c39bf272b2f6ae3cfb735c1212e4bc03522149))
- pair hash of RSK - ([5c26a48](https://github.com/BoltzExchange/boltz-web-app/commit/5c26a48c551083bf48535bea72008db0c0376825))
- disable refund button while transaction is being created (#453) - ([9d5f7ea](https://github.com/BoltzExchange/boltz-web-app/commit/9d5f7eacb56666bae3f99146718a57b0c526b78c))
- refunded status button green (#454) - ([55a5885](https://github.com/BoltzExchange/boltz-web-app/commit/55a588565152548b8011c5e377afa5549f670e23))
- refunds strings (#455) - ([47e762a](https://github.com/BoltzExchange/boltz-web-app/commit/47e762adce127d7c9e658c2c7fe9e7a09e06e804))
- lnurl error message (#457) - ([44bfea4](https://github.com/BoltzExchange/boltz-web-app/commit/44bfea4c1ba45ae9ebb063898e047642ae181bdb))
- tweak QR code scanner options (#458) - ([8d5526e](https://github.com/BoltzExchange/boltz-web-app/commit/8d5526e64d411b32fbdbaf66f842a374983031cc))
- Taproot swap refund files - ([36702dc](https://github.com/BoltzExchange/boltz-web-app/commit/36702dcc6c7195e72ccf2a2c51a2a105f0d712cb))
- undefined asset on refund page (#459) - ([2efaf2a](https://github.com/BoltzExchange/boltz-web-app/commit/2efaf2a11687ef39b99c13f872a5f1321ca210d7))

### Features

- QR code scanner (#323) - ([8e86081](https://github.com/BoltzExchange/boltz-web-app/commit/8e860811aadd72b71b08e762889a3c7219c88794))
- add version footer (#410) - ([2e4c682](https://github.com/BoltzExchange/boltz-web-app/commit/2e4c682d41a7944336939bff7d7381cc3ded3903))
- placeholders for amounts instead of 0 on load (#394) - ([0c770c0](https://github.com/BoltzExchange/boltz-web-app/commit/0c770c04aaef52624f1f61b28c92671d0719a927))
- Taproot swaps - ([a6ad33e](https://github.com/BoltzExchange/boltz-web-app/commit/a6ad33e123a9b8bc4326abf41cf6a568b2c98435))
- uncooperative claim fallback - ([2895b43](https://github.com/BoltzExchange/boltz-web-app/commit/2895b43d81513feb60fce8c3f214882854a5afe9))
- use API v2 to fetch pairs - ([27840dc](https://github.com/BoltzExchange/boltz-web-app/commit/27840dc016b310a9b1b138b59034bb2152639b82))
- automatic denom switcher (#395) - ([0381ff9](https://github.com/BoltzExchange/boltz-web-app/commit/0381ff90d22e406441e6f67753d9240a3b839e44))
- deeplinks for wallets (#378) - ([2bde980](https://github.com/BoltzExchange/boltz-web-app/commit/2bde9805586f0a66e9f05fa4229f545debda6ac4))

### Miscellaneous Chores

- disable address input autocomplete (#404) - ([4d38d6f](https://github.com/BoltzExchange/boltz-web-app/commit/4d38d6f72141ce2bc74bb8e855fc48ef178d92ad))
- move tests to TypeScript (#413) - ([a619e08](https://github.com/BoltzExchange/boltz-web-app/commit/a619e082d405481d4063a48289262bf5788bd58d))
- move main components to ts (#415) - ([07b0cb9](https://github.com/BoltzExchange/boltz-web-app/commit/07b0cb921944e07eeae0ebe44722b18705d32a7d))
- move utils to TypeScript (#416) - ([87b1044](https://github.com/BoltzExchange/boltz-web-app/commit/87b10441270d682b2428e35b4a6874bc77a0fda9))
- move status pages to TypeScript (#417) - ([b31bc7d](https://github.com/BoltzExchange/boltz-web-app/commit/b31bc7dc87aa14ea4bb8fd437b84b02df77cf13a))
- cleanup src file structure (#424) - ([0cfc54e](https://github.com/BoltzExchange/boltz-web-app/commit/0cfc54e5e47ea46308f181c87e424a7390ebf81e))
- use blockstream.info on testnet (#429) - ([b9d5100](https://github.com/BoltzExchange/boltz-web-app/commit/b9d5100ed7d16654243a35cc104506ce39881fbd))
- bump follow-redirects from 1.15.3 to 1.15.5 (#449) - ([434fbc0](https://github.com/BoltzExchange/boltz-web-app/commit/434fbc00eb03194b59d07eac84ecc1f339427e60))
- bump boltz-core version - ([c4cbc41](https://github.com/BoltzExchange/boltz-web-app/commit/c4cbc4116997f7ee6e8470c431be03990e3b3df2))
- update vite (#450) - ([79535cf](https://github.com/BoltzExchange/boltz-web-app/commit/79535cf0aa4af437c55dbc46e54a651d26d36978))
- clarify wording on refund page (#456) - ([f2b5895](https://github.com/BoltzExchange/boltz-web-app/commit/f2b58959d5df8bc9b2f02338462360108ce2fb28))
- prepare release v1.3.0 - ([02a861d](https://github.com/BoltzExchange/boltz-web-app/commit/02a861d50c4988613defe6206c9dd2f19eb6d09f))

### Refactoring

- buttons width 100% (#379) - ([5cb5e25](https://github.com/BoltzExchange/boltz-web-app/commit/5cb5e2598613905eed043a3af07409aecbb0c0b2))
- move signals and ecpair to TypeScript (#408) - ([e8d6a2f](https://github.com/BoltzExchange/boltz-web-app/commit/e8d6a2f3e360f904f7ed0dc2ada55273c09026b6))
- move components to TypeScript (#409) - ([18854f8](https://github.com/BoltzExchange/boltz-web-app/commit/18854f8b6829b25499ce1d8a544a8515411e654d))
- use strong types for window.webln (#412) - ([cdce5aa](https://github.com/BoltzExchange/boltz-web-app/commit/cdce5aad638b19374ed8437f610eef2755731baa))
- remove clickable amount component (#423) - ([e1cb801](https://github.com/BoltzExchange/boltz-web-app/commit/e1cb80148e7fbbd5074e94225162ff2f190b5a35))
- amount conversion (#420) - ([1d5ff0e](https://github.com/BoltzExchange/boltz-web-app/commit/1d5ff0e57a126a7682b79bab8cf33b6d753f4833))
- amount calculations (#422) - ([161f463](https://github.com/BoltzExchange/boltz-web-app/commit/161f4635c2ccac96fbd3cb8117997f2116af0c66))
- fetcher not using global signals (#427) - ([ea57df7](https://github.com/BoltzExchange/boltz-web-app/commit/ea57df716312ff875bcf68e51c38fd8ef8a45c86))
- feeChecker not using global signals (#428) - ([60feb19](https://github.com/BoltzExchange/boltz-web-app/commit/60feb1970c0aaa4ef831cdbd7dd521e522396ba3))
- SwapChecker into component (#431) - ([cdea315](https://github.com/BoltzExchange/boltz-web-app/commit/cdea315dad8a192f6449c52200a4899ba8feaef8))
- move feeCheck from helper (#432) - ([dbdf3e8](https://github.com/BoltzExchange/boltz-web-app/commit/dbdf3e85ffd634cbe21f12312c4ffa004890cc0a))
- use create context for signals (#430) - ([8d32407](https://github.com/BoltzExchange/boltz-web-app/commit/8d32407c26823c3dfe93b9297e0cec391521c18e))
- use PayContext for signals (#434) - ([75b5e1f](https://github.com/BoltzExchange/boltz-web-app/commit/75b5e1f7d6e629171b7cf0bc54eb27cb72841622))
- claim and refund logic (#435) - ([a74ed8f](https://github.com/BoltzExchange/boltz-web-app/commit/a74ed8fab7d0398898d2e171f71e17e284317ef0))
- use globalcontext remove signals and fetcher (#439) - ([1049dfd](https://github.com/BoltzExchange/boltz-web-app/commit/1049dfd881ac9b06256b8f2ceb0b68e34e88ec0e))
- use globalcontext remove signals - ([d40ccdf](https://github.com/BoltzExchange/boltz-web-app/commit/d40ccdf8b3b5219ee0cb9a36573500b117d2a53f))
- update boltz-core - ([c3b7fca](https://github.com/BoltzExchange/boltz-web-app/commit/c3b7fcadd92e8eefa35a3612f3a2d14988099c30))
- revert to 0 as placeholder for amounts - ([75f5ad8](https://github.com/BoltzExchange/boltz-web-app/commit/75f5ad8def43f3bd176cff2ffc47111254a6a591))

### Tests

- fix validation test for Taproot - ([1150ab4](https://github.com/BoltzExchange/boltz-web-app/commit/1150ab4380938345f59d2dfdb7bf86fb64d38765))

---
## [1.2.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.2.0..v1.2.1) - 2023-12-22

### Bug Fixes

- reactive clickable amount label - ([713f023](https://github.com/BoltzExchange/boltz-web-app/commit/713f0235c7caaf51fbd9ba8ad1f873801268e662))
- revalidate amounts when address is valid (#393) - ([1675278](https://github.com/BoltzExchange/boltz-web-app/commit/16752788e7e823fc64ed749d36d0abe037a93405))
- missing qrcode import (#392) - ([5acba3e](https://github.com/BoltzExchange/boltz-web-app/commit/5acba3e4dce2a9c8d22e1e39120fc30f7e798e79))
- do not setReverse in Pay.jsx (#376) - ([1fb47fc](https://github.com/BoltzExchange/boltz-web-app/commit/1fb47fc58e7378c02c82d2cd6b7d8cceec0e49c3))

### Features

- denomination toggle (#398) - ([3668640](https://github.com/BoltzExchange/boltz-web-app/commit/36686400ee286af086e6c0c980e227479bf77dfb))

### Miscellaneous Chores

- release v1.2.1 (#401) - ([f760509](https://github.com/BoltzExchange/boltz-web-app/commit/f7605099c6c4c1f241a65eb2b547939e62194a76))

### Misc

- revert to sat as default denomination (#397) - ([ddc7d50](https://github.com/BoltzExchange/boltz-web-app/commit/ddc7d509bd649f7706746a1d8269e93f5e5458bf))

---
## [1.2.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.1.2..v1.2.0) - 2023-12-21

### Bug Fixes

- handling of LNURLs - ([04535cf](https://github.com/BoltzExchange/boltz-web-app/commit/04535cf1163554ab2e76eddb4d150399e3bd040c))
- order of swap history - ([8613e52](https://github.com/BoltzExchange/boltz-web-app/commit/8613e520e9b95e8399057cf810d24fbe1cb06b98))
- fixes scrollbar jump when clicking into swapbox (#311) - ([c1cea9c](https://github.com/BoltzExchange/boltz-web-app/commit/c1cea9c472b22ebe81d83140d101a10d5a1e47e8))
- alignment past swaps (#310) - ([f82e52f](https://github.com/BoltzExchange/boltz-web-app/commit/f82e52f936cdb6960b18e093f1794fe1f930693d))
- alignment past swaps (#315) - ([eee1e94](https://github.com/BoltzExchange/boltz-web-app/commit/eee1e9423e068bf37e5daf9e166daa1219e2630f))
- out of context execution of effects/memos (#322) - ([9bf8ba1](https://github.com/BoltzExchange/boltz-web-app/commit/9bf8ba11f0e6695eb69c410bcd2957067163e2a2))
- missing space in Create (#326) - ([eeb45d8](https://github.com/BoltzExchange/boltz-web-app/commit/eeb45d8deb727be599e080d949b1e43a45362271))
- remove timeout blockheight from swap flow (#309) - ([72559d7](https://github.com/BoltzExchange/boltz-web-app/commit/72559d708d96b41d4857988b3a4146e682d48040))
- handle js error when asset is missing on api (#329) - ([3e60821](https://github.com/BoltzExchange/boltz-web-app/commit/3e60821aca2ba215dd743658921847101f4ce4b0))
- disable contract code match check - ([1fc837a](https://github.com/BoltzExchange/boltz-web-app/commit/1fc837aa2a9e2ba6f9ff1481ef3a219ad9426df2))
- skip refund step for RSK - ([386ba82](https://github.com/BoltzExchange/boltz-web-app/commit/386ba82b6236c4a8a767137abaf6a971173ad9c8))
- ES translations (#333) - ([189f6cb](https://github.com/BoltzExchange/boltz-web-app/commit/189f6cb2496f38e1ac5b55a5b6a053fa5b09720f))
- es lang typo (#336) - ([957fc40](https://github.com/BoltzExchange/boltz-web-app/commit/957fc401aaf4358bd39c30fae6039f8411fbd9ac))
- LNURL fetching error handling (#345) - ([ec3561d](https://github.com/BoltzExchange/boltz-web-app/commit/ec3561daa0a83d39509909a92c6fa2e04c901cbd))
- webln paste invoice gets deleted (#343) - ([f85af50](https://github.com/BoltzExchange/boltz-web-app/commit/f85af50cd60c856d9d6dbb4ed4c36748b7394c5c))
- Uncaught (in promise) ReferenceError: can't access lexical declaration 'validateAmount' (#350) - ([4323fe3](https://github.com/BoltzExchange/boltz-web-app/commit/4323fe3bfe201b30aa901befaa4beaf153fdcce7))
- Node.js version in CI (#356) - ([1fd6e4b](https://github.com/BoltzExchange/boltz-web-app/commit/1fd6e4b9b4dde15c3d06279a6a63e3f69592045a))
- small ES lang fix (#362) - ([2ef9aa5](https://github.com/BoltzExchange/boltz-web-app/commit/2ef9aa5cbb5191fb808912bd5de4aa89c7e6cebd))
- only show expiry warning for mainchain (#367) - ([110118c](https://github.com/BoltzExchange/boltz-web-app/commit/110118c9433165d08a33bb9cdeaebf184acec180))
- only set onchain address for Reverse Swaps (#371) - ([ba34c10](https://github.com/BoltzExchange/boltz-web-app/commit/ba34c101f7c2216a2d3441aa01a35480cc806536))
- failure reason gets overwritten (#365) - ([29d29dd](https://github.com/BoltzExchange/boltz-web-app/commit/29d29ddb15664c9d1ef90c7da87a58b921847a48))
- create button label on language change (#364) - ([36dae59](https://github.com/BoltzExchange/boltz-web-app/commit/36dae59805aed2f2caa92ca88da055fd32e75164))
- asset select based on available pairs (#369) - ([421d826](https://github.com/BoltzExchange/boltz-web-app/commit/421d8268d9c63ba77e200dfc52c1a76b921e788b))
- empty swaplist on `/refund` (#373) - ([f0a7f36](https://github.com/BoltzExchange/boltz-web-app/commit/f0a7f3679b8a5547612366a264bf8c4a1b90c3f0))

### Features

- make min and max clickable (#303) - ([b8c9911](https://github.com/BoltzExchange/boltz-web-app/commit/b8c9911bf065cc59acd0fe68a3b7d86e6bdac431))
- browser language detection (#301) - ([8308f8c](https://github.com/BoltzExchange/boltz-web-app/commit/8308f8c81434e273e30b4be333f31119e7940ed8))
- use swapbox on `/` (#289) - ([fd55427](https://github.com/BoltzExchange/boltz-web-app/commit/fd554276cc23b4cf47b4ed1d5ed0389ebb1072b6))
- RSK swaps (#306) - ([fa6a6dc](https://github.com/BoltzExchange/boltz-web-app/commit/fa6a6dc4717d66dee4f736dc0665f12cee797fa5))
- refund step for normal swaps (#258) - ([9de1f7f](https://github.com/BoltzExchange/boltz-web-app/commit/9de1f7f946170086e4f10d7425f4d824d1febc34))
- embedded swap box for iframes (#328) - ([b9d80b1](https://github.com/BoltzExchange/boltz-web-app/commit/b9d80b1f937087ec7705e2a05dea1e2b9d046d0f))
- add Boltz icon to QR codes (#330) - ([7711e3a](https://github.com/BoltzExchange/boltz-web-app/commit/7711e3a3d35fe848d605e61942faedb4043c08dc))
- improved create swap button (#317) - ([b0d3107](https://github.com/BoltzExchange/boltz-web-app/commit/b0d310716df432bc27670432323a09dddc3ad793))
- extract from bip21 follow up (#349) - ([126548b](https://github.com/BoltzExchange/boltz-web-app/commit/126548b39507ed7caa695f5af19c3b619ba3197e))
- add zh (#375) - ([ba241d8](https://github.com/BoltzExchange/boltz-web-app/commit/ba241d82866bfd907c0a7a4fff54de29b09d3d65))

### Miscellaneous Chores

- v1.1.2 changelog - ([08ea449](https://github.com/BoltzExchange/boltz-web-app/commit/08ea449636341bbc2375363d8726d1b5a7f5a23c))
- dependency updates - ([955a1d4](https://github.com/BoltzExchange/boltz-web-app/commit/955a1d4d406f51e6d9457e1fad8cb262e3bd2e70))
- bump browserify-sign from 4.2.1 to 4.2.2 (#295) - ([4308aea](https://github.com/BoltzExchange/boltz-web-app/commit/4308aea7114092a7dad79af79396ccf050c624fd))
- update dependencies (#314) - ([43f4e4b](https://github.com/BoltzExchange/boltz-web-app/commit/43f4e4bd50f8f77ce1f83cb3813d2f5a3b275bc7))
- add pre commit config (#319) - ([f7fc0d7](https://github.com/BoltzExchange/boltz-web-app/commit/f7fc0d7d4c1f074feee6a53d5932cba68191a796))
- prettier import order (#320) - ([2e8d4c5](https://github.com/BoltzExchange/boltz-web-app/commit/2e8d4c5926e0457f1804dfcc9e1f6a258bd1f46b))
- remove unused test snapshot - ([d129751](https://github.com/BoltzExchange/boltz-web-app/commit/d129751ab1ce410d5ebcaf4e8fdbaec155a0d9dc))
- optimize hr css (#331) - ([37b183f](https://github.com/BoltzExchange/boltz-web-app/commit/37b183fb29dcafef4d14c4c416c5c8dd09f34e71))
- update vite security fix (#347) - ([3dd4c5c](https://github.com/BoltzExchange/boltz-web-app/commit/3dd4c5c6a9b1687c5288d7c7a5e627eab386d81d))
- default to BTC denomination (#384) - ([ee5cf93](https://github.com/BoltzExchange/boltz-web-app/commit/ee5cf934c6ccf496a5ca912c9863294d40f5364d))
- v1.2.0 release prep - ([b6b8ffb](https://github.com/BoltzExchange/boltz-web-app/commit/b6b8ffb903e639ef4dd3b8d37fdf22a83380af4a))
- changelog - ([d30476f](https://github.com/BoltzExchange/boltz-web-app/commit/d30476fedc198ff5722cc28c3896fbecf2b08189))

### Refactoring

- add social urls and onion into config (#312) - ([558ca99](https://github.com/BoltzExchange/boltz-web-app/commit/558ca99782b35c9f48f0962556b0761c6f490197))
- move signals into components (#324) - ([7ca72df](https://github.com/BoltzExchange/boltz-web-app/commit/7ca72df7f71f3cbb92c8af6fbd33831fb6f121f1))
- convert configs to typscript (#340) - ([03591ea](https://github.com/BoltzExchange/boltz-web-app/commit/03591ea2f79155e2c7a55ecc81318d662917b7cf))
- i18n to TypeScript (#342) - ([485119f](https://github.com/BoltzExchange/boltz-web-app/commit/485119f50cc922147db32a133c04ff20cb1451be))
- invoice extraction (#361) - ([1352a23](https://github.com/BoltzExchange/boltz-web-app/commit/1352a23e5330389fd4c64d8e58f8d08d02609bbc))
- refine homepage design (#325) - ([80f2040](https://github.com/BoltzExchange/boltz-web-app/commit/80f20408649f31af2085f1c73f8a713fe2a9d4d4))

### Tests

- comment RSK contract verification tests - ([c3ad8c3](https://github.com/BoltzExchange/boltz-web-app/commit/c3ad8c3e45a9e69111e4906dcbcea055c280b2ac))

---
## [1.1.2](https://github.com/BoltzExchange/boltz-web-app/compare/v1.1.1..v1.1.2) - 2023-10-20

### Bug Fixes

- invoice validation (#282) - ([2248a71](https://github.com/BoltzExchange/boltz-web-app/commit/2248a7119353a44a76f8791becfe45839ecdc082))
- check fee amount instead of pair hash (#283) - ([44daf97](https://github.com/BoltzExchange/boltz-web-app/commit/44daf977eab22df5b944f845662515bc24ef647b))
- only claim from inside swapchecker (#284) - ([543d01f](https://github.com/BoltzExchange/boltz-web-app/commit/543d01f268c110fb92d2a489c6046c3a9f982ad7))

### Features

- change calculated send/receive amount on fee update (#285) - ([ba30023](https://github.com/BoltzExchange/boltz-web-app/commit/ba300235765325d7ed1c7ce69e05d65619e840d2))
- save selected send/receive asset in localstorage (#288) - ([eae2567](https://github.com/BoltzExchange/boltz-web-app/commit/eae2567726621673c0af624ab3175ecc1b6d54ba))

### Miscellaneous Chores

- v1.1.1 changelog - ([acd04e5](https://github.com/BoltzExchange/boltz-web-app/commit/acd04e5a268946188b7bbf51097e0390ecfa75cd))
- trivial dependency updates - ([463c2e7](https://github.com/BoltzExchange/boltz-web-app/commit/463c2e7b307a8891bed82ae77e664a588c70b9ad))
- remove unused i18n check - ([cd48345](https://github.com/BoltzExchange/boltz-web-app/commit/cd483455c2a184bc7fd78e526ff12d72e6ec883e))
- update i18n - ([d7e6e69](https://github.com/BoltzExchange/boltz-web-app/commit/d7e6e69e686364911d5daf2eb3c5ee4a130ea1b1))
- release v1.1.2 preparation (#292) - ([8b66c51](https://github.com/BoltzExchange/boltz-web-app/commit/8b66c517c5d9a9de9f9ca72707b55d8ab1808641))

### Refactoring

- remove usages of deprecated createStorageSignal - ([0074f77](https://github.com/BoltzExchange/boltz-web-app/commit/0074f77fffd846def45d1dbe207de6890973657f))
- switch to @bitcoinerlab/secp256k1 - ([80c9bbf](https://github.com/BoltzExchange/boltz-web-app/commit/80c9bbf00d35f985b6a76f04566d4e7083603553))

### Bug

- decimals handling for 0.000 (#287) - ([6f864a2](https://github.com/BoltzExchange/boltz-web-app/commit/6f864a28c3beced00c0916a637591b7211321d5d))

---
## [1.1.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.1.0..v1.1.1) - 2023-10-11

### Bug Fixes

- default swap direction (#269) - ([3278637](https://github.com/BoltzExchange/boltz-web-app/commit/32786373966a725e307218748ff8ed19e71b64cc))
- no # in language selector (#272) - ([8d05cd5](https://github.com/BoltzExchange/boltz-web-app/commit/8d05cd5fe8279fa5a41e664dba9c3e71e53c11b1))

### Documentation

- add PWA instructions (#275) - ([51d77ff](https://github.com/BoltzExchange/boltz-web-app/commit/51d77ff049144f71c50df6ef1257f6c0ed562cca))

### Features

- use invoice amount from pasted invoice (#276) - ([7dcc621](https://github.com/BoltzExchange/boltz-web-app/commit/7dcc6219418c24381cd70040900bc429c7946c21))

### Miscellaneous Chores

- update CHANGELOG.md for v1.1.0 - ([be71b54](https://github.com/BoltzExchange/boltz-web-app/commit/be71b54e8e45d803b2bbb7ca98aaea677161283e))
- add commit template (#267) - ([5f8f503](https://github.com/BoltzExchange/boltz-web-app/commit/5f8f503bee47283a31ffaba445d95edb39586471))
- bump postcss from 8.4.24 to 8.4.31 (#274) - ([fdf4c76](https://github.com/BoltzExchange/boltz-web-app/commit/fdf4c769970e494b1d94e7bfb5ceece1f4e1d218))
- v1.1.1 release prep (#278) - ([31c1a95](https://github.com/BoltzExchange/boltz-web-app/commit/31c1a956140dfa23ba957b37a679f3935698fe36))

---
## [1.1.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.0.1..v1.1.0) - 2023-10-03

### Bug Fixes

- improve language selector (#216) - ([c410a27](https://github.com/BoltzExchange/boltz-web-app/commit/c410a2792a08858df87a1668727c96ccc8fbec24))
- back to home link to / (#223) - ([d7d1e91](https://github.com/BoltzExchange/boltz-web-app/commit/d7d1e91a235a8c554ebdcbba7eaa3491f418ad59))
- make labels shorter for more menu room (#225) - ([c7cb742](https://github.com/BoltzExchange/boltz-web-app/commit/c7cb74215e52a27db223f0b2b7ed1f4293fedd57))
- improve language menu selector (#224) - ([b154a77](https://github.com/BoltzExchange/boltz-web-app/commit/b154a77f4adea90a37222c77f41574f2cc17a9e1))
- close asset dialog when clicking outside of box (#226) - ([5a3a4fa](https://github.com/BoltzExchange/boltz-web-app/commit/5a3a4fabed7c4ce5e6370c60a41ad4a88ef8f964))
- WebLN enable() should not expect an object (#230) - ([d0a3955](https://github.com/BoltzExchange/boltz-web-app/commit/d0a3955081e9d2d77070b2723057d75c18dc8e34))
- sort swap history by creation date - ([3461afc](https://github.com/BoltzExchange/boltz-web-app/commit/3461afc5dc87961f3ab2576d24a48ce24e0bc3be))
- refund QR generation on mobile Tor browser (#241) - ([7d84a25](https://github.com/BoltzExchange/boltz-web-app/commit/7d84a259379a2c6d7969c920eda0c70fbbdbf7df))
- remove default amount (#242) - ([d422ece](https://github.com/BoltzExchange/boltz-web-app/commit/d422ecece15ea04f6f10c075f9ab5fc338d7c42e))
- dh link (#246) - ([73d90a0](https://github.com/BoltzExchange/boltz-web-app/commit/73d90a031a736d8004edd9104f1c8c536c774219))
- grammar issue in German - ([cadefb1](https://github.com/BoltzExchange/boltz-web-app/commit/cadefb18f56858a1aa03f01b20744574db2d908d))
- docs link (#251) - ([eacb4b7](https://github.com/BoltzExchange/boltz-web-app/commit/eacb4b7ff9da17a22b5581adab9187c2f05ecb0d))
- validation of native SegWit normal Swap (#259) - ([485aa98](https://github.com/BoltzExchange/boltz-web-app/commit/485aa9861e6da61b824389a695515a1a2417ccd6))
- issue claiming im background (#260) - ([cf15eaf](https://github.com/BoltzExchange/boltz-web-app/commit/cf15eaf020b045fd025c6e19aef650a9a33bb778))
- i18n test - ([bf53583](https://github.com/BoltzExchange/boltz-web-app/commit/bf535839fc9f78c3fbbe51af36ac768933aef8c8))
- missing German translations - ([5b26954](https://github.com/BoltzExchange/boltz-web-app/commit/5b2695413fda1df192df869ca8c4eb3fa5d4df52))
- German, add missing Spanish strings - ([ca10c24](https://github.com/BoltzExchange/boltz-web-app/commit/ca10c24b10b15b34c04be3310d33a921c7e36736))
- missing receive string in DE, ES - ([30dac78](https://github.com/BoltzExchange/boltz-web-app/commit/30dac78024e2e1704275750db6c25a8c585b5c1d))
- DE select_asset - ([072507c](https://github.com/BoltzExchange/boltz-web-app/commit/072507c1017dcaeebac4c169089955bd9a0e436f))
- extra check if swap was already claim (#261) - ([2070407](https://github.com/BoltzExchange/boltz-web-app/commit/207040781b785a278086461797da50a3b5d7d355))

### Features

- show logo on loading screen (#210) - ([b1a9e66](https://github.com/BoltzExchange/boltz-web-app/commit/b1a9e66807ef87c2d1405514dba02211ded51e9e))
- Japanese translation (#184) - ([a4c4c0d](https://github.com/BoltzExchange/boltz-web-app/commit/a4c4c0d58ae0d6482def91cc32cdfedb2da90fac))
- add german & spanish (#218) - ([58b4991](https://github.com/BoltzExchange/boltz-web-app/commit/58b49912e35f296a44390f9a06030319a9632948))
- add 404 page (#222) - ([36cd6fe](https://github.com/BoltzExchange/boltz-web-app/commit/36cd6fe01421eeba376c5bffd33832985c72e810))
- add loading indicator for swap status (#211) - ([da361a5](https://github.com/BoltzExchange/boltz-web-app/commit/da361a560a82fb0b8eb0889f2f4d80823b22fc8c))
- add timeout to language dropdown menu (#227) - ([88f045e](https://github.com/BoltzExchange/boltz-web-app/commit/88f045e1ad7bc2a5471ac44d42f5a8c4bc6e8338))
- different referrals for mobile and desktop (#240) - ([9d38783](https://github.com/BoltzExchange/boltz-web-app/commit/9d387832c7bbe570bd24c83eb2b57d4aba258e2a))
- default language in config (#234) - ([c95d963](https://github.com/BoltzExchange/boltz-web-app/commit/c95d96323ec6090dbe5da14762a4a5d45801aa02))
- better labels for block explorer links (#239) - ([5315da7](https://github.com/BoltzExchange/boltz-web-app/commit/5315da7bbe3f9c2b6ca18708548b81ed7bc5d06f))
- API URL configurable per asset (#232) - ([4b3d9ff](https://github.com/BoltzExchange/boltz-web-app/commit/4b3d9ff177930cf0bf144112e92fc2f0649d4a88))
- history backup and restore (#237) - ([ba72fe2](https://github.com/BoltzExchange/boltz-web-app/commit/ba72fe2b4ff44a1c83e14571936738acd55d62f0))
- multiple SSE swap update streams (#236) - ([240d9a2](https://github.com/BoltzExchange/boltz-web-app/commit/240d9a22c0224114b3b87993e35d31e8348682b0))
- persist send amount on direction switch (#243) - ([8e30b23](https://github.com/BoltzExchange/boltz-web-app/commit/8e30b23094e19429d8048702a2969934cfd62d1b))
- gitbook (#228) - ([c08c243](https://github.com/BoltzExchange/boltz-web-app/commit/c08c2433c90ac77e4093287b19b429fb66a9bc47))
- add cropped invoice and amount to swap screen (#262) - ([937210d](https://github.com/BoltzExchange/boltz-web-app/commit/937210d51eaa60b21e25be0c143107702bbfeff2))
- refactor asset selector (#257) - ([d73b47f](https://github.com/BoltzExchange/boltz-web-app/commit/d73b47f08fab109cffb09517fd3c4caf41d0939f))

### Miscellaneous Chores

- **(deps)** bump @openzeppelin/contracts from 4.9.2 to 4.9.3 (#247) - ([cbcbd6f](https://github.com/BoltzExchange/boltz-web-app/commit/cbcbd6f2a6e35d477cb7e6b46eb0ff0ac406a158))
- add changelog - ([40823ce](https://github.com/BoltzExchange/boltz-web-app/commit/40823ceebd07d0d69384ddd7f71ccc11114de0b6))
- BSL Release Update (#265) - ([73f8e0b](https://github.com/BoltzExchange/boltz-web-app/commit/73f8e0b8884b8a1040da58638a9c74e3d87324cf))
- bump package.json version to v1.1.0 - ([f8748dd](https://github.com/BoltzExchange/boltz-web-app/commit/f8748dd377d4d0a32361494b0339aecfd7779927))

### Refactoring

- improve refund file flow (#209) - ([04972e7](https://github.com/BoltzExchange/boltz-web-app/commit/04972e77b83b1605d50db6a9561a7a4ca63a2a8d))
- show full size swap box on landing page (#213) - ([f206803](https://github.com/BoltzExchange/boltz-web-app/commit/f20680354f9f4791ca7ca6fbce97631e05ac17bf))
- WebLN enable callback (#231) - ([b008e3b](https://github.com/BoltzExchange/boltz-web-app/commit/b008e3bf465ee1418e130d7fc79f713e0134a2b3))
- remove fee reload button (#235) - ([1681999](https://github.com/BoltzExchange/boltz-web-app/commit/16819997026cc132c6f4686dfc1dd049fc780b0d))
- add SCSS stylesheets (#233) - ([c5b2502](https://github.com/BoltzExchange/boltz-web-app/commit/c5b2502e2a58c6970b0c28f0d74970c700b031aa))
- use polling to fetch latest status of background swaps (#266) - ([0c7328d](https://github.com/BoltzExchange/boltz-web-app/commit/0c7328d1a94843bbcb2724648f5c8e2006c5e47b))

### FiX

- add missing placeholder in DE, ES - ([ab1dd16](https://github.com/BoltzExchange/boltz-web-app/commit/ab1dd16ea6e7c857f3cd601fb333233b6b3fc240))

### Rm

- japanese language (#249) - ([a20390f](https://github.com/BoltzExchange/boltz-web-app/commit/a20390f0f9f73b03492921eda398f6f43b9630b4))

---
## [1.0.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.0.0..v1.0.1) - 2023-07-19

### Bug Fixes

- broken links (#186) - ([7a0ad5a](https://github.com/BoltzExchange/boltz-web-app/commit/7a0ad5a2e3c9b9f950ebd4a8fd580ab1d26b3e6f))
- add GitHub link (#191) - ([bb6c217](https://github.com/BoltzExchange/boltz-web-app/commit/bb6c217d8ca1384a3c7fdeed155eba63b46b76ea))
- QR code generation in TOR browser (#195) - ([0828de3](https://github.com/BoltzExchange/boltz-web-app/commit/0828de3af2aaefc8346d3050b4f1584e2f8e8c27))

### Miscellaneous Chores

- remove Vercel script - ([d9330f3](https://github.com/BoltzExchange/boltz-web-app/commit/d9330f3e7b034a845ecea2bc7ef31192ab1967a7))

---
## [1.0.0] - 2023-06-19

### Bug Fixes

- invoice has to be reset after the amounts change again (#71) - ([a6db80d](https://github.com/BoltzExchange/boltz-web-app/commit/a6db80d95a37232cefb4062a206563c03905b9d7))

<!-- generated by git-cliff -->
