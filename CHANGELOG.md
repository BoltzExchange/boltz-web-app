# Changelog

All notable changes to this project will be documented in this file. See [conventional commits](https://www.conventionalcommits.org/) for commit guidelines.

---
## [1.3.4](https://github.com/BoltzExchange/boltz-web-app/compare/v1.3.3..v1.3.4) - 2024-04-23

### Bug Fixes

- small number BTC denomination (#560) - ([ed35055](https://github.com/BoltzExchange/boltz-web-app/commit/ed350551cb3284bd0a7e68cdce45e2c3355546c2))

### Features

- QR code icon depending on asset (#559) - ([dbf2d08](https://github.com/BoltzExchange/boltz-web-app/commit/dbf2d08c131a24f0776d288d4b328eeaaea4db8a))

### Miscellaneous Chores

- set mainnet log level to debug - ([7f37914](https://github.com/BoltzExchange/boltz-web-app/commit/7f3791406db4c042cdbe6b5f86528d0b5498423b))

### Refactoring

- use `<a>` for swap history links (#557) - ([186cd14](https://github.com/BoltzExchange/boltz-web-app/commit/186cd146ae278a45ed0795b5154f82bcef4a4df1))

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
