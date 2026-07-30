# Changelog

All notable changes to this project will be documented in this file. See [conventional commits](https://www.conventionalcommits.org/) for commit guidelines.

---
## [2.2.0](https://github.com/BoltzExchange/boltz-web-app/compare/v2.1.4..v2.2.0) - 2026-07-30

### Bug Fixes

- swap write race (#1536) - ([08280ff](https://github.com/BoltzExchange/boltz-web-app/commit/08280ffe75cc69629ade92407751a849dae7e39c))
- show claiming status from USDT/USDC (#1540) - ([93bca5d](https://github.com/BoltzExchange/boltz-web-app/commit/93bca5d1280136b89b290877aa8418289f374d2a))
- refunds self-heal against stale lockup txs (#1545) - ([5ad0602](https://github.com/BoltzExchange/boltz-web-app/commit/5ad06023d34a8992c8eae5ec283986a21fa6fea9))
- check for LNURL spec errors - ([4c5c621](https://github.com/BoltzExchange/boltz-web-app/commit/4c5c621a7eb18fb0ebb21223b784c33e70419f8e))
- commitment swap wording (#1572) - ([f194848](https://github.com/BoltzExchange/boltz-web-app/commit/f1948489bd50316402dc2ff39cb8df3a4bb0773e))
- invoice error message on commitment swaps (#1571) - ([25fd5a4](https://github.com/BoltzExchange/boltz-web-app/commit/25fd5a44ff52e47084b70d4bbaa23fba644590cb))
- require rescue key backup on commitment swap creation (#1569) - ([f746c2c](https://github.com/BoltzExchange/boltz-web-app/commit/f746c2c55f822830a4f63fcf2b268d024a778418))
- handle insufficient USDT0 bridge credits (#1574) - ([06a4a03](https://github.com/BoltzExchange/boltz-web-app/commit/06a4a03b2413f8befed1f30c399d8ccd457ab17f))
- racy 0 amount swap quote (#1563) - ([6b3c6e4](https://github.com/BoltzExchange/boltz-web-app/commit/6b3c6e421387b31bd4e443ead501c91ddfd84b26))
- allow direct EVM rescue claims without a wallet (#1568) - ([cb9bbe2](https://github.com/BoltzExchange/boltz-web-app/commit/cb9bbe2ce368c434ee4fc4192e590ac73fcc26f7))
- rescue stranded USDT/C-ARB during OFT send (#1575) - ([ecedacc](https://github.com/BoltzExchange/boltz-web-app/commit/ecedaccba6b09dd43e63777954b430112f4c31ba))
- persist replacement quote before acceptance (#1577) - ([7a2878d](https://github.com/BoltzExchange/boltz-web-app/commit/7a2878dec3c219a29108e5c989bb5bd98fb3a39d))
- allow clicking on swaps while scan is still running (#1579) - ([87167be](https://github.com/BoltzExchange/boltz-web-app/commit/87167be6abd30119d72c830be8569af180a47464))
- patch swap metadata for commitment swaps (#1578) - ([9fecbf6](https://github.com/BoltzExchange/boltz-web-app/commit/9fecbf634064a5023d6daae8b78cf0ab7197732d))
- show EVM-source chain swaps as claimable in rescue flow (#1580) - ([8b1d57a](https://github.com/BoltzExchange/boltz-web-app/commit/8b1d57aa0ad743816e8b0122ce3edbe9be458ec7))

### Features

- chain swap send support in sdk - ([923e146](https://github.com/BoltzExchange/boltz-web-app/commit/923e14610c52b58d1a785466b5136e04f8c0db2f))
- allow chain swaps from ARK - ([ab4be9b](https://github.com/BoltzExchange/boltz-web-app/commit/ab4be9b8771c89dedad2b1825a99bd7cf15e4413))
- min receive amount in SDK - ([d5000aa](https://github.com/BoltzExchange/boltz-web-app/commit/d5000aabfe443f156a92f3f9bbc5085abaa9bba7))
- lightning swaps in SDK (#1538) - ([0df6cf2](https://github.com/BoltzExchange/boltz-web-app/commit/0df6cf2e9729ba730b22158ec407b662024e3f91))
- WebSocket ping/pong to prevent stalling (#1542) - ([405ba67](https://github.com/BoltzExchange/boltz-web-app/commit/405ba671aaee85e91f9f021a6b38b6dd1f6bc64d))
- offer refund when commitment is rejected (#1544) - ([ad3c261](https://github.com/BoltzExchange/boltz-web-app/commit/ad3c26109d012d13308d1ac3bb20ec9b395cf7f1))
- WebSocket support in SDK (#1543) - ([962a6e5](https://github.com/BoltzExchange/boltz-web-app/commit/962a6e59e9c38bf09ddbf11e0d688d6cc1bc62e6))
- post swap metadata (#1524) - ([d1fa7dd](https://github.com/BoltzExchange/boltz-web-app/commit/d1fa7dd63dd7fa868ff4a6acddb4944de9b53027))
- version swap metadata (#1552) - ([ffaa098](https://github.com/BoltzExchange/boltz-web-app/commit/ffaa098fd94b9515148dfa563d63908dff0fbf6d))
- make max button respect wallet balance (#1507) - ([11c39ef](https://github.com/BoltzExchange/boltz-web-app/commit/11c39ef271898f950bcfaa6614ca47ad83c1373a))
- store swap metadata on commitment swaps (#1556) - ([c167142](https://github.com/BoltzExchange/boltz-web-app/commit/c167142c164af5a24397f2ba096099a4bb706fc6))
- rescue routed EVM swaps (#1525) - ([68b988a](https://github.com/BoltzExchange/boltz-web-app/commit/68b988a0b63052a00e8110cea2d37f3d9f0b8d61))
- add generic key-value storage to SDK (#1564) - ([da78036](https://github.com/BoltzExchange/boltz-web-app/commit/da78036dbbf4c91cbd86cc1eb1a08f5ad306e7f7))
- consolidate swap rescue UX (#1562) - ([adec6f1](https://github.com/BoltzExchange/boltz-web-app/commit/adec6f12adb2ad0c69de8044914552abd200417b))
- make rescue claim/refund UI consistent with the regular flow pages (#1566) - ([d09df06](https://github.com/BoltzExchange/boltz-web-app/commit/d09df065fe3b2a319dd8c1d548d0bd4c2e211a05))
- use swap metadata to refund submarine swaps to original source (#1576) - ([100420c](https://github.com/BoltzExchange/boltz-web-app/commit/100420c38000ea439aa43a304f2d185b6e5a0741))

### Miscellaneous Chores

- harden CI permissions - ([19a7976](https://github.com/BoltzExchange/boltz-web-app/commit/19a797663ceda798357843600d74fe64cdcec104))
- add btcpay, rm tropykus from integrations (#1537) - ([5457671](https://github.com/BoltzExchange/boltz-web-app/commit/54576719735b188947a0d8a8c35c9752489a2703))
- fix flaky package integration test (#1541) - ([9da8786](https://github.com/BoltzExchange/boltz-web-app/commit/9da87865246bf90c6ac1f81247d4440efd89d336))
- bump package version to v0.0.9 (#1546) - ([ce33ac3](https://github.com/BoltzExchange/boltz-web-app/commit/ce33ac3feedff48d1d0116ef6f741dcaa2c45555))
- fix flaky package integration tests (#1547) - ([537c0d7](https://github.com/BoltzExchange/boltz-web-app/commit/537c0d7a699cf299204fa8de5731cce6427b4940))
- revert USDT0 Polygon extra gas (#1551) - ([c639177](https://github.com/BoltzExchange/boltz-web-app/commit/c639177effb62806f509c207a8c7c1338f3a3c27))
- update integrations and partner section (#1555) - ([8d1cb21](https://github.com/BoltzExchange/boltz-web-app/commit/8d1cb21dff02887edcfaa2d7d3aec6e4b0aae54c))
- bump to TypeScript v7 (#1558) - ([a340ec3](https://github.com/BoltzExchange/boltz-web-app/commit/a340ec381d48dacf02b54e4a3d267c1c74a747f3))
- remove stashpay from integrations (#1582) - ([05e862c](https://github.com/BoltzExchange/boltz-web-app/commit/05e862c791e39d6e41c71c51f22fda7de8afe40b))

### Refactoring

- make swap bridge status more intuitive (#1533) - ([d45db5b](https://github.com/BoltzExchange/boltz-web-app/commit/d45db5b1605a23b0397696b5804299cc7c9f71bc))
- LNURL and BIP-353 invoice fetching in SDK - ([8d6f318](https://github.com/BoltzExchange/boltz-web-app/commit/8d6f318b16d494966fc08e96aed3082df03244d0))

### Tests

- E2E test Arbitrum USDT0 chain swaps (#1499) - ([33d71b6](https://github.com/BoltzExchange/boltz-web-app/commit/33d71b6cbc2f9643df27cd8c5f2516aa2c95f70a))
- add USDT0 Ethereum OFT bridge coverage (#1527) - ([0ca2f6a](https://github.com/BoltzExchange/boltz-web-app/commit/0ca2f6a89cfa13a1d9715380b4aee157c7f03c45))
- E2E for ERC20 lockups and refunds (#1539) - ([2f03ab0](https://github.com/BoltzExchange/boltz-web-app/commit/2f03ab08783a0a9122cb59e94381d821c51853f3))

---
## [2.1.4](https://github.com/BoltzExchange/boltz-web-app/compare/v2.1.3..v2.1.4) - 2026-06-18

### Bug Fixes

- scanned QR address validation (#1515) - ([502103f](https://github.com/BoltzExchange/boltz-web-app/commit/502103f9ee31de01d7508c720f502617020f3be7))
- stranded funds from dex quote shortfall (#1529) - ([992824b](https://github.com/BoltzExchange/boltz-web-app/commit/992824b7fdb7cc3b75d6378034714ac91f0f8bd7))

### Features

- display network badge on all pages (#1510) - ([5691d56](https://github.com/BoltzExchange/boltz-web-app/commit/5691d56029bd92c339c354734108ec74a5eed028))
- onion domain for gas sponsor (#1513) - ([03aa745](https://github.com/BoltzExchange/boltz-web-app/commit/03aa745d1fa03491124dfadd1954bd40bca3fb26))
- URL param for rescue backup via mnemonic (#1511) - ([ef18b28](https://github.com/BoltzExchange/boltz-web-app/commit/ef18b288daba308c3e241389f4efa0413230d2c7))
- post message on swap completion (#1512) - ([413ede3](https://github.com/BoltzExchange/boltz-web-app/commit/413ede393d8b8c8e645d5e0316d1421669a21875))
- add unblinded Liquid claim tx link (#1523) - ([37bc819](https://github.com/BoltzExchange/boltz-web-app/commit/37bc8195c34e7035498b5aa3082ef1b0310e813f))
- add unix timestamp to rescue file name (#1528) - ([8e4eb73](https://github.com/BoltzExchange/boltz-web-app/commit/8e4eb7316bd0277e67de331783cc83c4e869b874))

### Miscellaneous Chores

- improve WebSocket logging (#1514) - ([97a7be6](https://github.com/BoltzExchange/boltz-web-app/commit/97a7be6da0cfeb112521f27a3d692b65459aa2cc))
- update rbtc icon (#1519) - ([ab939d2](https://github.com/BoltzExchange/boltz-web-app/commit/ab939d2613a9162303bf21ec9f2a54da5589a77b))
- bump regtest (#1521) - ([b291dfd](https://github.com/BoltzExchange/boltz-web-app/commit/b291dfd1abdf3c597a3bbeed8910807fd305ed4a))
- log currency denomination (#1518) - ([78fb837](https://github.com/BoltzExchange/boltz-web-app/commit/78fb837f25990dc35d63be1cc11f34f8989f85db))
- improve rescue key backup warnings (#1531) - ([42293ee](https://github.com/BoltzExchange/boltz-web-app/commit/42293ee5dc8b7ee785b061f264e921952897adbe))
- bump dependencies (#1532) - ([b7f3d0e](https://github.com/BoltzExchange/boltz-web-app/commit/b7f3d0e9c05e50b1979894ed710770ea11949f2c))
- bump version to v2.1.4 (#1534) - ([4c22641](https://github.com/BoltzExchange/boltz-web-app/commit/4c22641123b62ae838d68e51ea4fdb90942896f0))

---
## [2.1.3](https://github.com/BoltzExchange/boltz-web-app/compare/v2.1.2..v2.1.3) - 2026-06-01

### Bug Fixes

- wallet connection styles (#1497) - ([a458162](https://github.com/BoltzExchange/boltz-web-app/commit/a458162d4609f59ac2bd122e3da900795d280864))
- OFT sends to Polygon (#1500) - ([8bf8d5c](https://github.com/BoltzExchange/boltz-web-app/commit/8bf8d5c9ac94479caefc6bb750810c9fa684c63c))
- cooperative claims of chain swaps from EVM (#1501) - ([6060738](https://github.com/BoltzExchange/boltz-web-app/commit/60607384317a8fff6d41bae9fa499cb61a3e15df))

### Features

- embedded mode and light theme (#1498) - ([9319c04](https://github.com/BoltzExchange/boltz-web-app/commit/9319c04313beb22fad6ca081904538a01cf10ade))
- retrieve missing OFT transfer tx hash (#1433) - ([cbad27f](https://github.com/BoltzExchange/boltz-web-app/commit/cbad27f92641cf737bd1e20eb55bd60105940352))
- recover pending CCTP bridge sends (#1459) - ([4a8678e](https://github.com/BoltzExchange/boltz-web-app/commit/4a8678e1c98d42d57e1c3e55e3e429922340130e))

### Miscellaneous Chores

- improve logging of resource fetching error (#1506) - ([f99feed](https://github.com/BoltzExchange/boltz-web-app/commit/f99feed8dd8b9ef47376916d2405f744ae86d7f9))
- mempool.space API override for tests (#1508) - ([c49c110](https://github.com/BoltzExchange/boltz-web-app/commit/c49c110ccdc8c4dcbbd03e1eb8dbd9818b57e92b))
- bump version to v2.1.3 (#1509) - ([fcabd80](https://github.com/BoltzExchange/boltz-web-app/commit/fcabd8055fc321a2d8b8ac9461e80ad252f75537))

### Refactoring

- adjust Solana signer order (#1503) - ([407258d](https://github.com/BoltzExchange/boltz-web-app/commit/407258db828b329815e3797e867698fdc2e8cc53))

---
## [2.1.2](https://github.com/BoltzExchange/boltz-web-app/compare/v2.1.1..v2.1.2) - 2026-05-22

### Bug Fixes

- BOLT12 invoice verification - ([249949a](https://github.com/BoltzExchange/boltz-web-app/commit/249949adf7c4cd6ebf6f6d97d7ec23d604b661f0))
- token decimals edge case handling - ([35d9b4c](https://github.com/BoltzExchange/boltz-web-app/commit/35d9b4cdc90af333c6fc151790eca27d8dac1302))
- remove accidential loglevel import in package (#1482) - ([d7aa711](https://github.com/BoltzExchange/boltz-web-app/commit/d7aa71133fadf54c93bd9ac4e5cf6008b19ebb89))
- pro opportunity click not updating assets (#1481) - ([9b62965](https://github.com/BoltzExchange/boltz-web-app/commit/9b629650a11356a792bb4439b2c1064d4b582121))
- allow refunding 'transaction.claim.pending' swap with extra UTXOs (#1478) - ([28e890b](https://github.com/BoltzExchange/boltz-web-app/commit/28e890b8a0c98b5d4bbd0e479324fb5b0734ae22))
- missing "rescue method connected" color in pro (#1479) - ([0c27a03](https://github.com/BoltzExchange/boltz-web-app/commit/0c27a031f1cd21fd573e82bddae70d75268fdf0c))
- overflow in asset select - ([a24c480](https://github.com/BoltzExchange/boltz-web-app/commit/a24c480730a35c3231be793cdd2785b42041f9da))
- flaky mnemonic verify fake word selection (#1487) - ([815af4a](https://github.com/BoltzExchange/boltz-web-app/commit/815af4a4fa1431097a5c7598eaae59caec830c21))

### Features

- add WBTC on Arbitrum - ([884782a](https://github.com/BoltzExchange/boltz-web-app/commit/884782ac12519ff408542e0c365e821debb3d491))

### Miscellaneous Chores

- cleanup EVM claim args - ([e340823](https://github.com/BoltzExchange/boltz-web-app/commit/e3408236ddf0ddf01e278ede3aac30eafa2bdb94))
- dim down focused input border color (#1480) - ([611d94e](https://github.com/BoltzExchange/boltz-web-app/commit/611d94ea10c7003be4ed108a5e09841727525048))
- setup stylelint (#1484) - ([d998f94](https://github.com/BoltzExchange/boltz-web-app/commit/d998f94e566c310e61b13ab3db76f0e14a7377ef))
- add WBTC to social preview and rescue explainer (#1489) - ([8c55bf5](https://github.com/BoltzExchange/boltz-web-app/commit/8c55bf513ed4dec20b32691d46b697edc6e40627))
- ensure connect wallet modal fits in view (#1491) - ([c5c2adf](https://github.com/BoltzExchange/boltz-web-app/commit/c5c2adfa1440ba61137910bbdfc900c408966805))
- remove yadio (#1495) - ([afdc499](https://github.com/BoltzExchange/boltz-web-app/commit/afdc499a96990476f875b0aabac58f45aefe0723))
- bump version to v2.1.2 (#1496) - ([c345afb](https://github.com/BoltzExchange/boltz-web-app/commit/c345afb99957a5a8d0c2ee892cb3f059f36d1472))

### Refactoring

- cleanup renegotiaton logic (#1483) - ([0ec840a](https://github.com/BoltzExchange/boltz-web-app/commit/0ec840ad01089d5e729d03cd587e8d13d91bee5b))
- gas sponsor wrapper (#1494) - ([792c5d7](https://github.com/BoltzExchange/boltz-web-app/commit/792c5d7cf565ce31ad9a7eef17da98ead360618d))
- column asset selector (#1490) - ([47d2ff7](https://github.com/BoltzExchange/boltz-web-app/commit/47d2ff7a8184dda20e054366474b1b77e52a04b2))

---
## [2.1.1](https://github.com/BoltzExchange/boltz-web-app/compare/v2.1.0..v2.1.1) - 2026-05-19

### Miscellaneous Chores

- small UI fixes (#1474) - ([e3933d0](https://github.com/BoltzExchange/boltz-web-app/commit/e3933d0f745ea53b24eb7610f073c31cadf94a85))
- bump version to v2.1.1 (#1477) - ([901cde9](https://github.com/BoltzExchange/boltz-web-app/commit/901cde95d858cbfa9bff36fcbe973bfdbe897aad))

### Refactoring

- replace logs copy with post to support (#1473) - ([137218d](https://github.com/BoltzExchange/boltz-web-app/commit/137218d5b83850f3a1d85a9ffd368378582019d0))

<!-- generated by git-cliff -->
