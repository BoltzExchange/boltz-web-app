# Changelog

All notable changes to this project will be documented in this file. See [conventional commits](https://www.conventionalcommits.org/) for commit guidelines.

---
## [1.8.6](https://github.com/BoltzExchange/boltz-web-app/compare/v1.8.5..v1.8.6) - 2025-10-29

### Bug Fixes

- log timestamps (#1043) - ([f455ea2](https://github.com/BoltzExchange/boltz-web-app/commit/f455ea2cc97e415aded3c9bf6fc02940f2b747bc))
- highlight first and last blocks in address (#1052) - ([9dbef5f](https://github.com/BoltzExchange/boltz-web-app/commit/9dbef5f0df370f3c40b4de5ae0506684b95b3a59))

### Features

- improve "Accept quote" UX (#1044) - ([c939e9b](https://github.com/BoltzExchange/boltz-web-app/commit/c939e9bf0f8e02a5757b477607428a7e63b3b069))
- add timestamp to logs (#1045) - ([21410c8](https://github.com/BoltzExchange/boltz-web-app/commit/21410c810244e41ea741f7ab05193632caa2d1c7))
- display all characters of addresses (#1050) - ([8f4ee98](https://github.com/BoltzExchange/boltz-web-app/commit/8f4ee9823105266fc606145a8babc7e2b8b0fe5d))
- Add Products page (#1038) - ([f5d3d0c](https://github.com/BoltzExchange/boltz-web-app/commit/f5d3d0c57976260519a53c660510d9908cdcd8b7))

### Miscellaneous Chores

- improve i18n pt translations (#1040) - ([a45b1b4](https://github.com/BoltzExchange/boltz-web-app/commit/a45b1b437490b959ac21c5e37563b776d04822a9))
- update RPC error message (#1048) - ([52b24a6](https://github.com/BoltzExchange/boltz-web-app/commit/52b24a6f0ecc6d3efaeec2c5e3b6c33e84649c9d))
- change link from testnet to regtest in footer (#1056) - ([1d5a965](https://github.com/BoltzExchange/boltz-web-app/commit/1d5a9651980614d53878e8fa860b467c16645bfa))

### Tests

- improve i18n coverage (#1041) - ([dfaf364](https://github.com/BoltzExchange/boltz-web-app/commit/dfaf364f210ece977309bac34643155797e48180))

---
## [1.8.5](https://github.com/BoltzExchange/boltz-web-app/compare/v1.8.4..v1.8.5) - 2025-10-11

### Bug Fixes

- update boltz-cli data path - ([a8e501e](https://github.com/BoltzExchange/boltz-web-app/commit/a8e501e4042057d317dc66ebac4e992980ccb6bf))
- err message and mSat unit - ([1f0bcd1](https://github.com/BoltzExchange/boltz-web-app/commit/1f0bcd17841f619251c484097633530ff0bf420d))

### Features

- Show lnurl/lnaddress min/max amount errors - ([d5b3263](https://github.com/BoltzExchange/boltz-web-app/commit/d5b32633c7e2472f36f113261d0105a899d6f13d))
- show destination on swap send screen (#1035) - ([9828463](https://github.com/BoltzExchange/boltz-web-app/commit/9828463acec1bc30e8580469ee83b080a9f77d72))

### Miscellaneous Chores

- add error logs during swap creation - ([f222897](https://github.com/BoltzExchange/boltz-web-app/commit/f222897ccba2fed27eef31bc8f906e416607eaa5))
- update regtest submodule - ([26ea365](https://github.com/BoltzExchange/boltz-web-app/commit/26ea3655e0660e513afc6972f636114c59e076ca))
- update i18n translations - ([3a48f1e](https://github.com/BoltzExchange/boltz-web-app/commit/3a48f1e7fdb01f28e439669f465b1dc811e144b5))
- hardcode btc as denomination, add missing language strings - ([cfa879f](https://github.com/BoltzExchange/boltz-web-app/commit/cfa879fde80787e2300c94e406b67eae978a78fa))
- log swap creations with destination (#1034) - ([21a48b3](https://github.com/BoltzExchange/boltz-web-app/commit/21a48b3576af292587c075744c6dc3a4657c3487))
- bump dependencies (#1036) - ([c35a634](https://github.com/BoltzExchange/boltz-web-app/commit/c35a6341999c266d488d5fbed60559f8355b7f59))
- bump version to v1.8.5 (#1039) - ([62477ca](https://github.com/BoltzExchange/boltz-web-app/commit/62477ca3c46189351d474ae6a083c3c89822f020))

### Tests

- Show lnurl/lnaddress min/max amount errors - ([8b4483f](https://github.com/BoltzExchange/boltz-web-app/commit/8b4483f4e3b0fbc3c4b6256e309a023f64879811))

### E2e

- Uncooperative refunds via Rescue/External Rescue (#1030) - ([b17da3b](https://github.com/BoltzExchange/boltz-web-app/commit/b17da3b3805b0e76eb36023fe441a0253d9a21dd))

---
## [1.8.4](https://github.com/BoltzExchange/boltz-web-app/compare/v1.8.2..v1.8.4) - 2025-09-19

### Bug Fixes

- avoid fetching UTXOs during initial swap phase (#1018) - ([1118868](https://github.com/BoltzExchange/boltz-web-app/commit/1118868e9099f678e7de13dc91d6e82fba1f3b96))
- Trezor tx value NaN (#1027) - ([4969a01](https://github.com/BoltzExchange/boltz-web-app/commit/4969a0149d6a2f9b1da6be2c30f3136147d39d7f))
- missing timeout block heights for uncooperative refunds (#1024) - ([ab7cfdb](https://github.com/BoltzExchange/boltz-web-app/commit/ab7cfdb0746af7488db71d3ebd975370a780dd40))

### Features

- show timeout block height (#1021) - ([81cf5a9](https://github.com/BoltzExchange/boltz-web-app/commit/81cf5a9e06ff605eb89edf004d347bb70b46d47b))

### Miscellaneous Chores

- add "receive" hint to address/invoice field (#1020) - ([cf72302](https://github.com/BoltzExchange/boltz-web-app/commit/cf7230225b68d5b94fca9a1c3f301ce43b168a87))
- update dependencies - ([5e49c79](https://github.com/BoltzExchange/boltz-web-app/commit/5e49c79a2dba88932038823f4462cf7a0623a84d))
- bump axios from 1.11.0 to 1.12.0 (#1025) - ([21528c7](https://github.com/BoltzExchange/boltz-web-app/commit/21528c78139973239730d6bfac3cc6a219f3e574))
- pretty print logs - ([d4b0fd7](https://github.com/BoltzExchange/boltz-web-app/commit/d4b0fd72137c44254693991465cbb5bac1067423))
- update regtest submodule (#1029) - ([b1315ed](https://github.com/BoltzExchange/boltz-web-app/commit/b1315eda961215e33d1569323b2f4fbaecbabbde))
-  [**breaking**]remove support for `embed` param - ([072df95](https://github.com/BoltzExchange/boltz-web-app/commit/072df952e3bea6cb1bb8d9467aac1830906bf701))
- bump version to v1.8.4 (#1031) - ([94a96d4](https://github.com/BoltzExchange/boltz-web-app/commit/94a96d4ab59c59056f84d592282b32c848ef55ad))

---
## [1.8.2](https://github.com/BoltzExchange/boltz-web-app/compare/v1.8.1..v1.8.2) - 2025-09-04

### Bug Fixes

- bolt12 error typo (#998) - ([f9d66e8](https://github.com/BoltzExchange/boltz-web-app/commit/f9d66e8874e2a58f16e75188812d2b65c8ba7a1e))
- NaN value in Trezor signer - ([59cd8c8](https://github.com/BoltzExchange/boltz-web-app/commit/59cd8c8614340eb5ec12cb27a7658699f0eb2e26))
- min-relay fee not met (#1006) - ([fa64938](https://github.com/BoltzExchange/boltz-web-app/commit/fa64938b36d61279f5bd53797f8d331f88bf8bea))
- ignore backend status for timed out swaps (#1008) - ([f5bceba](https://github.com/BoltzExchange/boltz-web-app/commit/f5bcebaa49e942430589ffcc834d0ff3fcb5e1c1))

### Documentation

- add secure context section (#1002) - ([e3c817a](https://github.com/BoltzExchange/boltz-web-app/commit/e3c817a662d1e44bd0c37827f38b7ec2f0851927))

### Features

- include RDNS records in backup - ([6168602](https://github.com/BoltzExchange/boltz-web-app/commit/6168602247fff73c81411d4a68bc4ca3fb65a21d))
- independent uncooperative refunds (#995) - ([4f9fa9b](https://github.com/BoltzExchange/boltz-web-app/commit/4f9fa9b8b3c82f4db37a730dbdd7d093e47a7bc5))

### Miscellaneous Chores

- clarify Docker build port (#996) - ([2109451](https://github.com/BoltzExchange/boltz-web-app/commit/2109451d5133ae3a32398ea0337d5e788e8ecc0a))
- bump sha.js from 2.4.11 to 2.4.12 (#1000) - ([1201c9e](https://github.com/BoltzExchange/boltz-web-app/commit/1201c9e21cb1e83ab770b401358257e9fe431422))
- bump cipher-base from 1.0.4 to 1.0.6 (#1001) - ([5006f0d](https://github.com/BoltzExchange/boltz-web-app/commit/5006f0d1e359000ed5148da5931f52266ba523fc))
- update dependencies (#1004) - ([28822b2](https://github.com/BoltzExchange/boltz-web-app/commit/28822b2b340a54fa08462546d97e76011f0feae3))
- extend BOLT12 E2E test - ([59ff005](https://github.com/BoltzExchange/boltz-web-app/commit/59ff0050761395b3f607770ad60e7b7ebbe9cbb5))
- use Primal for nostr links (#1009) - ([8fecc81](https://github.com/BoltzExchange/boltz-web-app/commit/8fecc8188ea665a7c14bb52c6ef7cf30c9c14c77))
- bump version to v1.8.2 (#1015) - ([cd09ad4](https://github.com/BoltzExchange/boltz-web-app/commit/cd09ad440f861172f2b8975d3d65e3b455075877))

### Refactoring

- fetch mechanism for 3rd party explorers (#993) - ([a01d907](https://github.com/BoltzExchange/boltz-web-app/commit/a01d90780ad2e7862c6f6aea7cc2ab174ab89d86))
- mnemonic input improvements (#999) - ([cb4eee8](https://github.com/BoltzExchange/boltz-web-app/commit/cb4eee865fef8e9a76b1eb0a98d4361ba628f021))
- refundable assets type safety (#1010) - ([142520c](https://github.com/BoltzExchange/boltz-web-app/commit/142520cdec5def16a0308170a95fcdb1faaaada3))
- SEO and performance improvements (#1011) - ([f516815](https://github.com/BoltzExchange/boltz-web-app/commit/f5168154b93ad31c5d316b1f80611341b4f55ed4))

---
## [1.8.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.8.0..v1.8.1) - 2025-08-12

### Bug Fixes

- show "Backup" button on iOS (#989) - ([644506b](https://github.com/BoltzExchange/boltz-web-app/commit/644506b2aab46cefaee82a47d87601dd3dedc02f))
- restore previous `SwapChecker` behavior (#991) - ([3b049a6](https://github.com/BoltzExchange/boltz-web-app/commit/3b049a64c0e7a79c172f2a83a9db201ad5f4e13c))

### Miscellaneous Chores

- bump version to v1.8.1 - ([98d9e37](https://github.com/BoltzExchange/boltz-web-app/commit/98d9e3758f9c5f2a6e84d404cbcbd4d29ab077ee))

---
## [1.8.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.9..v1.8.0) - 2025-08-06

### Bug Fixes

- Improve flip assets button's UX (#968) - ([cdcce46](https://github.com/BoltzExchange/boltz-web-app/commit/cdcce468361f013f708c7ac74291e24e087b2771))
- Boltz Pro Telegram bot link CSS (#986) - ([3707ece](https://github.com/BoltzExchange/boltz-web-app/commit/3707ece544097df26c2c927b38bac800b76c4bf7))

### Documentation

- enable search detailed view - ([fe5e46d](https://github.com/BoltzExchange/boltz-web-app/commit/fe5e46d884af4a78ca5bcad523703d08e69d573f))

### Features

- claim pending chain/reverse swaps with rescue key (#973) - ([cdee6e7](https://github.com/BoltzExchange/boltz-web-app/commit/cdee6e7da7e8c3095ea623598f8c33cbf88109de))
- RSK fallback provider (#981) - ([cab7f4d](https://github.com/BoltzExchange/boltz-web-app/commit/cab7f4de91dc8dd492b482823dd8b0b400f230f6))

### Miscellaneous Chores

- update blog link - ([db71275](https://github.com/BoltzExchange/boltz-web-app/commit/db712752b41fe479e73a48ec2d75f8fc8cfaffd8))
- bump form-data from 4.0.1 to 4.0.4 (#970) - ([a387b24](https://github.com/BoltzExchange/boltz-web-app/commit/a387b245303ec8e7d356b6149c8eac6802677cd2))
- bump axios from 1.10.0 to 1.11.0 (#971) - ([538275b](https://github.com/BoltzExchange/boltz-web-app/commit/538275bca1b3be8ff21082e55e0df7be47878174))
- show transaction mempool warning on desktop (#972) - ([188fffa](https://github.com/BoltzExchange/boltz-web-app/commit/188fffa6e0e407d795ad87f02606f70f652cec88))
- update dependencies - ([e7bdf51](https://github.com/BoltzExchange/boltz-web-app/commit/e7bdf5124792f789c5d188febfd2eea069a37c0f))
- update pro banner docs link - ([c8d9091](https://github.com/BoltzExchange/boltz-web-app/commit/c8d909137cdda4812590c60141216f456123a42f))
- update version to v1.8.0 (#988) - ([c6a99d9](https://github.com/BoltzExchange/boltz-web-app/commit/c6a99d999882b9759f64e9222f69628df8d4ab63))

### Refactoring

- rescue swap improvements (#983) - ([4d9edf1](https://github.com/BoltzExchange/boltz-web-app/commit/4d9edf11f3ce815239c255a09b8a2c1ca2a2fb7d))

---
## [1.7.9](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.8..v1.7.9) - 2025-07-10

### Bug Fixes

- RSK denomination on refund page (#958) - ([4d00bf5](https://github.com/BoltzExchange/boltz-web-app/commit/4d00bf5204941acddb5c338f0740425a518de614))
- pasting amounts with white space (#959) - ([49a3452](https://github.com/BoltzExchange/boltz-web-app/commit/49a3452689fcbc9b54b7d09e4fa6f0a0ca6efb3a))
- Disabled `createButton` for addr pre-filled with url param - ([22cc274](https://github.com/BoltzExchange/boltz-web-app/commit/22cc274851e8cabd655763c2f14325849f96891e))
- `AddressInput` filled with incorrect RBTC address (#960) - ([48819b6](https://github.com/BoltzExchange/boltz-web-app/commit/48819b65b4f9380b4fc6f59aaf9d683823494082))
- undefined used as a key, but it is not a string in test - ([2793d22](https://github.com/BoltzExchange/boltz-web-app/commit/2793d220f89a4979c77f94afa583012f3bd1c7f5))
- handle undefined `routingInfo` (#965) - ([94396b3](https://github.com/BoltzExchange/boltz-web-app/commit/94396b3aa7c7ae176ceea9912f9e2cb45b823c0f))

### Documentation

- fix misc issues - ([5817b93](https://github.com/BoltzExchange/boltz-web-app/commit/5817b935524ca599166bce6c25b888cc00087eee))

### Features

- magic routing hint shortcuts (#948) - ([a729560](https://github.com/BoltzExchange/boltz-web-app/commit/a729560db98f90c30fc45a04a0757e20596e4bc0))
- avoid MRH when no fees are saved (#963) - ([7ab98f8](https://github.com/BoltzExchange/boltz-web-app/commit/7ab98f840321bb934255507ac32f523114abfe12))

### Miscellaneous Chores

- bump dependencies (#955) - ([df45d71](https://github.com/BoltzExchange/boltz-web-app/commit/df45d716d64eeb9f41ad86ab2a1b8863888ffde9))
- only update deploy docs when changed - ([b736be1](https://github.com/BoltzExchange/boltz-web-app/commit/b736be170323b76a552c44228232346cb39e5895))
- bump version to v1.7.9 (#966) - ([11e0448](https://github.com/BoltzExchange/boltz-web-app/commit/11e0448575fff66405fe416a7612052a4b71231a))

### Refactoring

- make destination parser type safe - ([4f55c00](https://github.com/BoltzExchange/boltz-web-app/commit/4f55c009d7104d4d5dfab7cadf5d8ffc9bfd8b8c))
- switch to vitepress (#961) - ([ac13d8a](https://github.com/BoltzExchange/boltz-web-app/commit/ac13d8a32ab04297f8f5592ccf580d3435570b8e))
- cleanup invoice parsing - ([2b62411](https://github.com/BoltzExchange/boltz-web-app/commit/2b62411723a27f9bbf5f4c1ea5e3bed6004ed890))

### Tests

- **(e2e)** Validate multiple url params combinations - ([1acf99d](https://github.com/BoltzExchange/boltz-web-app/commit/1acf99dad6c6cc7b1050daf15428ed9f0d3d7090))

---
## [1.7.8](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.7..v1.7.8) - 2025-06-17

### Bug Fixes

- URL params on Boltz Pro (#939) - ([21340ea](https://github.com/BoltzExchange/boltz-web-app/commit/21340ea1473f53642c94d8c7175af312faeaed5c))
- prevent swap creation without claim address (#943) - ([8f625c1](https://github.com/BoltzExchange/boltz-web-app/commit/8f625c15bb406c1e3da5d88b83411e351b9aca5b))

### Features

- URL param to display mnemonic input (#947) - ([49b525d](https://github.com/BoltzExchange/boltz-web-app/commit/49b525da0c1e1268bf1eac8fcbb76a058243be85))

### Miscellaneous Chores

- update Ark Labs link (#936) - ([496f50a](https://github.com/BoltzExchange/boltz-web-app/commit/496f50a79b94ae1a06a2204b45f5738687f613fa))
- update dependencies (#938) - ([7363b6e](https://github.com/BoltzExchange/boltz-web-app/commit/7363b6e913c5e3ea9b34522eb67b79ad5f5bdf03))
- update Onion URL for pro (#940) - ([9691dd9](https://github.com/BoltzExchange/boltz-web-app/commit/9691dd9dcddecf4717ec02ad7043eac6f372ca3a))
- update link previews (#941) - ([a4ee721](https://github.com/BoltzExchange/boltz-web-app/commit/a4ee7213429a428a33e8b4f10aa9b7915665f727))
- minor tos update (#949) - ([2f3923a](https://github.com/BoltzExchange/boltz-web-app/commit/2f3923a99971bba7ba62f0cbeaed3b132327aba5))
- shorten Spanish string to avoid line break (#951) - ([f49fdca](https://github.com/BoltzExchange/boltz-web-app/commit/f49fdca62b1f4ef0be31a05d558b730a8f4a4c1c))
- bump version to v1.7.8 (#952) - ([d094788](https://github.com/BoltzExchange/boltz-web-app/commit/d094788304a3096d689c796e97221430867b195a))

### Refactoring

- missing theme CSS variables (#932) - ([908e21b](https://github.com/BoltzExchange/boltz-web-app/commit/908e21bd249d22a0e09904918f9fc8f1d161bd87))
- failedToPay refund UX improvements (#937) - ([af4f6d6](https://github.com/BoltzExchange/boltz-web-app/commit/af4f6d62ef1b0907ecacc7c6e7c47be0c26041c3))

---
## [1.7.7](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.6..v1.7.7) - 2025-06-09

### Features

- pro swap opportunities list (#930) - ([acaa15a](https://github.com/BoltzExchange/boltz-web-app/commit/acaa15a60ef3019816b42920f4e92e54c3c0af58))

### Miscellaneous Chores

- adjust Dockerfiles for pro builds (#926) - ([20843a2](https://github.com/BoltzExchange/boltz-web-app/commit/20843a27c0af0aa6bb8d84d59b8d2714cc6d27b6))
- bump dependencies (#927) - ([f5ef3a3](https://github.com/BoltzExchange/boltz-web-app/commit/f5ef3a3c5a3bf9b0dddc82a2393b5bbaf8f631ed))
- minor pp update (#934) - ([a7a0492](https://github.com/BoltzExchange/boltz-web-app/commit/a7a049299c4ea863b636e40542e6585fa8d09b11))
- bump version to v1.7.7 (#935) - ([9a45ec7](https://github.com/BoltzExchange/boltz-web-app/commit/9a45ec77e73a6051a58c2466a79be7086011db45))

---
## [1.7.6](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.5..v1.7.6) - 2025-06-04

### Features

- add Boltz Pro theme (#922) - ([1d68304](https://github.com/BoltzExchange/boltz-web-app/commit/1d6830435ea6219d2c4f6ce97b65686863f667c4))
- mnemonic as alternative to download key file (#910) - ([38dec6d](https://github.com/BoltzExchange/boltz-web-app/commit/38dec6d4e5dfd26a3debb956d7dae5b5182a9d8b))
- Add Pro Theme colors on loading (#924) - ([13c9557](https://github.com/BoltzExchange/boltz-web-app/commit/13c9557ce086d8a4f6be1fb61488c6829fb9a00d))

### Miscellaneous Chores

- add Alby as integration (#920) - ([dc08b25](https://github.com/BoltzExchange/boltz-web-app/commit/dc08b25f06a0d1da11b2d8c16eb5d9e7aad5dbec))
- add Cake Pay; rm Marina from integrations (#921) - ([54ace47](https://github.com/BoltzExchange/boltz-web-app/commit/54ace47b492346be70a66f2a1f9c47604c80d03d))
- bump version to v1.7.6 (#925) - ([efa0642](https://github.com/BoltzExchange/boltz-web-app/commit/efa0642230753e084b72608ff061c7219672076a))

### Refactoring

- adjust hero glow (#923) - ([b217119](https://github.com/BoltzExchange/boltz-web-app/commit/b217119d0acaa8d6b41b1e4094396931aaf62780))

---
## [1.7.5](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.4..v1.7.5) - 2025-05-20

### Bug Fixes

- button size to avoid text overflow (#908) - ([40af40c](https://github.com/BoltzExchange/boltz-web-app/commit/40af40cdd0263fe6a3889dacdf45d20fb5160f74))
- revalidate amount on backspace deletion (#914) - ([3f0b7a5](https://github.com/BoltzExchange/boltz-web-app/commit/3f0b7a5949a683c60ac8aa2d3761bf7a75568df1))
- properly handle 0-amount invoice error (#913) - ([88e8375](https://github.com/BoltzExchange/boltz-web-app/commit/88e8375a3e8bc806a5ad8c8f67727f5edaf1fd32))

### Miscellaneous Chores

- update dependencies (#911) - ([8abf39a](https://github.com/BoltzExchange/boltz-web-app/commit/8abf39a1fa4a6e464dc7b8b187245fb4a567f369))
- bump base-x (#916) - ([e5bf782](https://github.com/BoltzExchange/boltz-web-app/commit/e5bf782577c4568e9f7417942a8d054326f4eb7b))
- bump dependencies (#917) - ([dbc9c9d](https://github.com/BoltzExchange/boltz-web-app/commit/dbc9c9d2a9cbfa261ca3b837dd7329997978ae9f))
- API instructions in pro banner (#918) - ([f4b9cdb](https://github.com/BoltzExchange/boltz-web-app/commit/f4b9cdbdefe1f88eaa2cd058d37f7980f8bde749))
- bump version to v1.7.5 (#919) - ([e288457](https://github.com/BoltzExchange/boltz-web-app/commit/e288457d85f46b4dc16127aa1455856caf5a2a0c))

---
## [1.7.4](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.3..v1.7.4) - 2025-04-24

### Bug Fixes

- missing colon for max amount (#907) - ([3f82675](https://github.com/BoltzExchange/boltz-web-app/commit/3f82675a21b1f66bfa95d4579bbbb069eb3eb325))

### Features

- add Fedi as integration (#904) - ([50b429d](https://github.com/BoltzExchange/boltz-web-app/commit/50b429dfa3d44df68dbd0b20a420d11978ce9cde))
- apply `minimalBatched` to submarine swaps (#906) - ([bf7bf37](https://github.com/BoltzExchange/boltz-web-app/commit/bf7bf37d49185647e40fdb6de7f45dc5cc992835))
- prompt on tab close with pending swaps (#897) - ([f7fa7a6](https://github.com/BoltzExchange/boltz-web-app/commit/f7fa7a63686b460f60c132f862722a7ed89b835a))

### Miscellaneous Chores

- bump version to v1.7.4 (#909) - ([7c04bb1](https://github.com/BoltzExchange/boltz-web-app/commit/7c04bb1715d8e797988b6134fa3250ca25569182))

---
## [1.7.3](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.2..v1.7.3) - 2025-04-16

### Bug Fixes

- config for pro (#881) - ([9359179](https://github.com/BoltzExchange/boltz-web-app/commit/9359179962d6960723e6005f44809e724d6ee1f9))
- rollback WalletConnect to fix production builds (#882) - ([373619a](https://github.com/BoltzExchange/boltz-web-app/commit/373619a9cb57ae0c8990da779ce4b1469e660481))
- builds in Docker (#887) - ([2da0e19](https://github.com/BoltzExchange/boltz-web-app/commit/2da0e197cc50cc26371571a251d92e4890efe6d3))
- `receiveAsset` URL parameter (#885) - ([8610a90](https://github.com/BoltzExchange/boltz-web-app/commit/8610a9046b1402703a7bbac8e63fabdc105fe346))
- address derivation for RSK from Trezor (#898) - ([03db673](https://github.com/BoltzExchange/boltz-web-app/commit/03db6731be065adb8f185583019dfdfa62aed44e))
- Rootstock derivation path (#900) - ([a3925a9](https://github.com/BoltzExchange/boltz-web-app/commit/a3925a95519fbd9e51480479d57c8689189d2f65))
- format and add missing denominations (#894) - ([0fc95ce](https://github.com/BoltzExchange/boltz-web-app/commit/0fc95ce3c6978213977065e457749a397368294a))

### Features

- include rescue key in backup (#874) - ([b592bbd](https://github.com/BoltzExchange/boltz-web-app/commit/b592bbd73628ebb9fd89197487e1dd9bc4d1d256))
- add Portuguese translations (#889) - ([f0a5c75](https://github.com/BoltzExchange/boltz-web-app/commit/f0a5c758bd830fd4246f5912ee59f7cb65181ab5))
- improve UX for copying address/invoice on click - ([988414a](https://github.com/BoltzExchange/boltz-web-app/commit/988414ad88e20ad6d4b981efebf5db1ee4347b51))

### Miscellaneous Chores

- python3 from env in shebang (#880) - ([f42a6cd](https://github.com/BoltzExchange/boltz-web-app/commit/f42a6cd885f9982e9983d44a699848290ab40b2e))
- minor dependency updates - ([8f18c90](https://github.com/BoltzExchange/boltz-web-app/commit/8f18c909eaf71a1a06a68b08e10c6151c74b0e88))
- check type imports with ESLint - ([2d64281](https://github.com/BoltzExchange/boltz-web-app/commit/2d6428158e28505549002b5d1d4a70d89ba418de))
- bump boltz-core to v3.0.0 - ([f4e000f](https://github.com/BoltzExchange/boltz-web-app/commit/f4e000f9a389079abfb8f974dae867b3af4603e6))
- bump Ledger dependencies - ([c093918](https://github.com/BoltzExchange/boltz-web-app/commit/c09391840d7a3b1fc96c0de650fb285ba96c675d))
- add eslint no-console rule and remove old console.log - ([d96d864](https://github.com/BoltzExchange/boltz-web-app/commit/d96d864a6b03d0ae3a6132078bda120fd5e44707))
- reorder header menu (#896) - ([1df3f95](https://github.com/BoltzExchange/boltz-web-app/commit/1df3f95b34cb800c21f1c0e32f23b250aa4ecdfd))
- bump version to v1.7.3 (#903) - ([e4c83cc](https://github.com/BoltzExchange/boltz-web-app/commit/e4c83cc96a8309cd5a34b0a9049c0ea277fdaee5))

### Refactoring

- compiled network configuration file (#883) - ([ece175d](https://github.com/BoltzExchange/boltz-web-app/commit/ece175d0f1881b8ab10dd7e193801dfcd0e6f0eb))
- HadwareSigner -> HardwareSigner (#902) - ([2d5b280](https://github.com/BoltzExchange/boltz-web-app/commit/2d5b280bd02c74c5350a449b0330dd0e3d9eb138))

### Tests

- copy box content to clipboard on click - ([35c3783](https://github.com/BoltzExchange/boltz-web-app/commit/35c37836e0fd649356dd30aad96d70587ab47b03))

---
## [1.7.2](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.1..v1.7.2) - 2025-03-31

### Bug Fixes

- LNURL fetch amount query param (#860) - ([75fdeff](https://github.com/BoltzExchange/boltz-web-app/commit/75fdeff7de0cd14ada72d3ba5d4971bb2746c381))
- parse amounts query params for LN addresses (#863) - ([a8b1661](https://github.com/BoltzExchange/boltz-web-app/commit/a8b166182522f574e6e71b8bd86cf38c5980e939))
- settings icon overlap on small screens (#872) - ([f90b52a](https://github.com/BoltzExchange/boltz-web-app/commit/f90b52adb463bb622eaa63b218de8c5820c879f9))

### Documentation

- add Japanase to URL param documentation (#853) - ([9756756](https://github.com/BoltzExchange/boltz-web-app/commit/97567568d4bfb0d4c47d2613751d5dcfd072381d))

### Features

- add terms (#857) - ([e64bdbb](https://github.com/BoltzExchange/boltz-web-app/commit/e64bdbb51e7c2de81d9c3a965e90ec617740694c))
- add privacy policy (#861) - ([f9af109](https://github.com/BoltzExchange/boltz-web-app/commit/f9af1092ff95bc5277cf48d64116b3df3140bf9a))
- add Rootstock Labs as partner (#862) - ([b501d34](https://github.com/BoltzExchange/boltz-web-app/commit/b501d342d242089c48c7a5ce1958ad494d76c860))
- fetch refundable UTXOs from block explorer (#828) - ([3b74c90](https://github.com/BoltzExchange/boltz-web-app/commit/3b74c907b45647ce2703da99f10e1d1ddba72908))
- refund all UTXOs in one transaction (#864) - ([9a3a970](https://github.com/BoltzExchange/boltz-web-app/commit/9a3a970b3631644bd17d3d72ab60ce06340f107c))
- rename transaction.refunded state (#865) - ([76ed81c](https://github.com/BoltzExchange/boltz-web-app/commit/76ed81cf11ae63f6b21145e6d4fad82efcbef797))
- add loading spinner to CreateButton (#871) - ([44c442f](https://github.com/BoltzExchange/boltz-web-app/commit/44c442f42d6c1df04bd0dd2a5828a1defa3b3584))

### Miscellaneous Chores

- fix CHANGELOG for v1.7.1 - ([993fa7c](https://github.com/BoltzExchange/boltz-web-app/commit/993fa7c0084938453c3d3a362968db5e50e629d7))
- update Aqua logo (#866) - ([db8ef12](https://github.com/BoltzExchange/boltz-web-app/commit/db8ef1296c50f3f43d75c9a156cd8ad8e588b1cc))
- bump LNURL and BOLT12 resolve timeout (#868) - ([0f2bb30](https://github.com/BoltzExchange/boltz-web-app/commit/0f2bb309d61749745a08f2bfe2ab7055f891a1d5))
- update dependencies (#870) - ([3aa44c7](https://github.com/BoltzExchange/boltz-web-app/commit/3aa44c799100faf2b4a0a85d856ad71fda3b486e))
- production builds in Docker - ([e0cbbae](https://github.com/BoltzExchange/boltz-web-app/commit/e0cbbae59b32abda04431e489ccd907e1843b760))
- update regtest - ([273df42](https://github.com/BoltzExchange/boltz-web-app/commit/273df42f808db1163a7b64a6c2556a3603cfdcdb))
- bump version to v1.7.2 - ([d9aa7c4](https://github.com/BoltzExchange/boltz-web-app/commit/d9aa7c4e2136e87363a913d4d33c641f6b35eb06))

### Refactoring

- race invoice timeout - ([56b90b8](https://github.com/BoltzExchange/boltz-web-app/commit/56b90b80c9d3ae4b09539a3da436d8804ab4dca2))
- cleanup promises with timeout - ([8370405](https://github.com/BoltzExchange/boltz-web-app/commit/837040567d4a75f9a0762d84415ee3d10db7aed7))

### Tests

- add E2E tests for refunding multiple UTXOs (#869) - ([b81802d](https://github.com/BoltzExchange/boltz-web-app/commit/b81802d23c1c598caa45b66e448d90dc9911e6a3))

---
## [1.7.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.7.0..v1.7.1) - 2025-03-13

### Miscellaneous Chores

- rescue key file renaming (#848) - ([74edbd7](https://github.com/BoltzExchange/boltz-web-app/commit/74edbd753d25b101ce8a3c2bf13c67e9cb2b5610))
- remove unused refund file name - ([778fc98](https://github.com/BoltzExchange/boltz-web-app/commit/778fc98d3c118ef6ec6103c7ce56eebcaf502ff7))
- bump version to v1.7.1 - ([ae3de15](https://github.com/BoltzExchange/boltz-web-app/commit/ae3de15e8c37d9ff7351d94e7c004e9b33e8fbb7))

### Refactoring

- get last used key index on rescue file import (#844) - ([2b890b1](https://github.com/BoltzExchange/boltz-web-app/commit/2b890b104c851a956384a463a5fc017cd1ca1992))
- remove QR rescue file generation - ([0fa5081](https://github.com/BoltzExchange/boltz-web-app/commit/0fa5081bec1a7fef2e571f7c0106d777758d6ae9))
- enable logs download on iOS - ([ad24b9f](https://github.com/BoltzExchange/boltz-web-app/commit/ad24b9f733dcf26c391ff6af6626c597a022d1d1))
- remove QR rescue file generation (#847) - ([53ba7cb](https://github.com/BoltzExchange/boltz-web-app/commit/53ba7cb40b74936cf1e14d0ac7141d8bf07d553d))

---
## [1.7.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.6.2..v1.7.0) - 2025-03-12

### Bug Fixes

- spending explicit outputs with confidential nonce (#830) - ([3495b74](https://github.com/BoltzExchange/boltz-web-app/commit/3495b747c9fb24f08bced160e772ae48f35cdc26))
- fix E2E tests - ([fd4d306](https://github.com/BoltzExchange/boltz-web-app/commit/fd4d30614477a8499c4d3aee7e711d7d1fbd764c))
- references of changed i18n - ([d7daf2b](https://github.com/BoltzExchange/boltz-web-app/commit/d7daf2bd55f749d1dfae70c9363687d26dcc8c11))

### Features

- swap recovery rescan - ([aa49284](https://github.com/BoltzExchange/boltz-web-app/commit/aa49284a6052d3eed9a59d77f94322ca242d6a2a))
- download rescue key in settings - ([b60ffa7](https://github.com/BoltzExchange/boltz-web-app/commit/b60ffa780502b7190ed63b4db6467ab8af280ef6))
- adjust network fee when RIF is needed - ([53b8111](https://github.com/BoltzExchange/boltz-web-app/commit/53b811106d6a24df3ba6135b297e84f6f01412aa))
- defer swap creation after backup is done - ([6c49820](https://github.com/BoltzExchange/boltz-web-app/commit/6c49820cd6ee97eaaa8089d88840244ae107cb58))

### Miscellaneous Chores

- verify rescue key wording - ([140d79e](https://github.com/BoltzExchange/boltz-web-app/commit/140d79ecb6e762eb0ff449b67f88aa443723f32a))
- rename recovery endpoint to rescue - ([d268113](https://github.com/BoltzExchange/boltz-web-app/commit/d2681131bd306dc6bd339e9d436853347aa993b3))
- add missing strings, minor display adjustments - ([25da0ff](https://github.com/BoltzExchange/boltz-web-app/commit/25da0ff08865595b382e6a2bc9eaeffb9da80711))
- bump vulnerable NPM dependencies - ([42b03e9](https://github.com/BoltzExchange/boltz-web-app/commit/42b03e99643b78818bc5e3abbaa13a7c95390616))
- use Discount CT on mainnet (#825) - ([7ba569a](https://github.com/BoltzExchange/boltz-web-app/commit/7ba569aec3c8c5490217d34bc6552e3dbea27734))
- minor wording adjustments - ([ad8cab1](https://github.com/BoltzExchange/boltz-web-app/commit/ad8cab1fbdc9e2618a5b7f1bb59f412f26bc8061))
- bump dependencies - ([20de41f](https://github.com/BoltzExchange/boltz-web-app/commit/20de41f0f2eaed4b2b5ec52bc83b7ae878303cfe))
- bump dependencies - ([d13ea7d](https://github.com/BoltzExchange/boltz-web-app/commit/d13ea7dfe958e58f41aea575f9f3cfb002109b39))
- bump version to v1.7.0 (#843) - ([1c7ca26](https://github.com/BoltzExchange/boltz-web-app/commit/1c7ca265a9e9bde465a4391d574fbea561442045))

### Refactoring

- rename recovery to refund file - ([9c2fafd](https://github.com/BoltzExchange/boltz-web-app/commit/9c2fafdb2f03600e6e2b2d8302b38fc89ee10e97))
- nested backup/verify paths - ([8a9ef44](https://github.com/BoltzExchange/boltz-web-app/commit/8a9ef44ff1d91e619d2c813ace29da9efeab8ce0))
- save mnemonic instead of xpriv - ([c11cb4a](https://github.com/BoltzExchange/boltz-web-app/commit/c11cb4a735969238a53b3ce4e01f836daa8401c1))
- cleanup rescue refunds - ([0404964](https://github.com/BoltzExchange/boltz-web-app/commit/0404964b74646139a2129f679ccb858991e7b706))
- use vitest instead of jest - ([cfeb2e6](https://github.com/BoltzExchange/boltz-web-app/commit/cfeb2e6d5a0c4944028010c375d160ede51b3abd))
- use Web Locks API for claim lock (#837) - ([e62af4d](https://github.com/BoltzExchange/boltz-web-app/commit/e62af4d662dee15cc64d06e8a51e2739258c0fc1))
- external refund rescue key wording (#840) - ([c6f6067](https://github.com/BoltzExchange/boltz-web-app/commit/c6f606788f1f816fa436b3fc612fd30e33044dc4))
- add loading spinner to backup verification - ([e526169](https://github.com/BoltzExchange/boltz-web-app/commit/e5261695b29495f76a29e5b2d6c2b47998b644ca))

### Tests

- E2E tests for rescue files - ([439fadf](https://github.com/BoltzExchange/boltz-web-app/commit/439fadfbc9e241c3f6d1d5d472099395e37d6c36))

---
## [1.6.2](https://github.com/BoltzExchange/boltz-web-app/compare/v1.6.1..v1.6.2) - 2025-02-26

### Bug Fixes

- make vite version detection more reliable - ([c2d2458](https://github.com/BoltzExchange/boltz-web-app/commit/c2d24586e3e80efffce9bf9f0a40ca0bd808e165))
- clean address input on direction switch (#801) - ([3b3dc42](https://github.com/BoltzExchange/boltz-web-app/commit/3b3dc42da99d87cf305650ba03b9acaa5faf850b))
- do not show swaps as 'refundable' when there was no lockup tx (#811) - ([371f9d1](https://github.com/BoltzExchange/boltz-web-app/commit/371f9d1fdd88555981b80304f50c85b86ce8d922))
- init secp-zkp for legacy refunds (#822) - ([27da26e](https://github.com/BoltzExchange/boltz-web-app/commit/27da26efe7f450b72eec469921ad4db79742ea50))
- concurrent EVM claims (#826) - ([a6152ed](https://github.com/BoltzExchange/boltz-web-app/commit/a6152ed47840b55bec1231434451e1015d1bfb5e))

### Features

- transaction broadcasts via block explorer (#802) - ([47f89db](https://github.com/BoltzExchange/boltz-web-app/commit/47f89db8e63aca8b957512ae9b80045e3ad58ba4))
- add tropykus and speed as integrations (#812) - ([9893fea](https://github.com/BoltzExchange/boltz-web-app/commit/9893fea15fff837a08a677a1bee9c104b27be437))

### Miscellaneous Chores

- minor dependency bumps (#795) - ([75d834f](https://github.com/BoltzExchange/boltz-web-app/commit/75d834fb0e42528b0f93e4850a065b43dbc9cd17))
- bump dnssec-prover to v0.6.6 (#798) - ([5be91f0](https://github.com/BoltzExchange/boltz-web-app/commit/5be91f009469420f5dae2e0b4068fc870e00fd55))
- disable amounts input autocomplete (#800) - ([326c111](https://github.com/BoltzExchange/boltz-web-app/commit/326c1111b86f3af91df8dccaa77beab8bd2ebadf))
- make swap not found page look nicer (#803) - ([01e82e9](https://github.com/BoltzExchange/boltz-web-app/commit/01e82e9b138d315f9502d216c5b841eb7785f00c))
- update regtest (#808) - ([93f301e](https://github.com/BoltzExchange/boltz-web-app/commit/93f301ec58d770466d98f78a8f2bf32a5c050da3))
- minor dependency updates (#810) - ([cf96270](https://github.com/BoltzExchange/boltz-web-app/commit/cf9627089d9e813b4fff74d35eba7f181085c9b5))
- minor dependency updates (#818) - ([71ff293](https://github.com/BoltzExchange/boltz-web-app/commit/71ff293f97e0cfac427a556df3372cf6ea072005))
- use new testnet API endpoint (#819) - ([552c770](https://github.com/BoltzExchange/boltz-web-app/commit/552c77005b4107e1ac78cc35c2d2a4c557716480))
- update regtest (#821) - ([8d618bf](https://github.com/BoltzExchange/boltz-web-app/commit/8d618bf2bf2fda342862ae6a55528e036f22eea1))
- update Vite dependencies - ([b709538](https://github.com/BoltzExchange/boltz-web-app/commit/b709538049a2d827f54674ea4efe69900bc5cb3e))
- minor dependency updates - ([313448c](https://github.com/BoltzExchange/boltz-web-app/commit/313448cee9890cebad4c36e255ebcd08a32339b7))
- bump version to v1.6.2 (#827) - ([051d2bd](https://github.com/BoltzExchange/boltz-web-app/commit/051d2bda5ee1f9683df79932043067029e90d5f9))

### Refactoring

- refund address input (#796) - ([53b7d18](https://github.com/BoltzExchange/boltz-web-app/commit/53b7d182fdc7f6975f0e896232b97d5ed87918e6))
- cleanup external broadcast (#804) - ([aaf3254](https://github.com/BoltzExchange/boltz-web-app/commit/aaf3254ff29b56201eb2d5409f7fd0a66c77e32c))

---
## [1.6.1](https://github.com/BoltzExchange/boltz-web-app/compare/v1.6.0..v1.6.1) - 2025-01-10

### Bug Fixes

- ignore error when server does not want to claim cooperatively (#783) - ([0285e79](https://github.com/BoltzExchange/boltz-web-app/commit/0285e79af4e7fd8f60510e25008437588e8ceb11))
- no ref URL param on pro site (#782) - ([c721763](https://github.com/BoltzExchange/boltz-web-app/commit/c721763b2bb805905a7e425574d0f33bb0110da3))
- remove buggy QR code probe - ([7f90b7b](https://github.com/BoltzExchange/boltz-web-app/commit/7f90b7bcf7101e365fc321334f13788c1c20853c))
- bump refund QR code size - ([1cfa933](https://github.com/BoltzExchange/boltz-web-app/commit/1cfa9331bb53b0811e8503c8892b6999f2b739bd))
- default browser language detection (#792) - ([34edb7b](https://github.com/BoltzExchange/boltz-web-app/commit/34edb7bc495a7237533b901ba13894e4cef6ffde))

### Features

- pro build configuration (#780) - ([14ff825](https://github.com/BoltzExchange/boltz-web-app/commit/14ff8250fc5ec5e5802747d6d20c0d83cd6f28b4))
- safety check before calculating fees (#786) - ([02b2823](https://github.com/BoltzExchange/boltz-web-app/commit/02b28230a5670dfe50eb8f120aa7918bd8437315))
- show when no lockup can be found for refund (#789) - ([c76bd47](https://github.com/BoltzExchange/boltz-web-app/commit/c76bd470bea93e878470cc8e840f69978f3e345f))
- show routing fees (#791) - ([dfcccba](https://github.com/BoltzExchange/boltz-web-app/commit/dfcccba0285f169cab9682e3759e5e6d7bc8e728))

### Miscellaneous Chores

- include transaction.refunded in final swap states (#777) - ([6cdf23c](https://github.com/BoltzExchange/boltz-web-app/commit/6cdf23cb8bd6b964f72a5df3793578167f316a9b))
- use orange heart (#778) - ([45ae3c9](https://github.com/BoltzExchange/boltz-web-app/commit/45ae3c935307710af133c7ae27e9410620c0ee6a))
- add ark labs to partner section (#781) - ([7ece218](https://github.com/BoltzExchange/boltz-web-app/commit/7ece218b92f301a1661bd26a50dc84f7484ae236))
- bump version to v1.6.1 - ([a858be2](https://github.com/BoltzExchange/boltz-web-app/commit/a858be2f35aab38bb321a5913508bcf512ae041b))

### Refactoring

- cleanup JSON error handling (#787) - ([7ec2580](https://github.com/BoltzExchange/boltz-web-app/commit/7ec258062a84ffd543dd08d516b44e33bb6584ee))
- cleanup refund page (#785) - ([88b969c](https://github.com/BoltzExchange/boltz-web-app/commit/88b969c357c625ad0621b229d69cba31b24b791e))

### Tests

- E2E for refund files (#794) - ([e962389](https://github.com/BoltzExchange/boltz-web-app/commit/e962389a4a62ae5c8df698292f795ab246060ed3))

---
## [1.6.0](https://github.com/BoltzExchange/boltz-web-app/compare/v1.5.4..v1.6.0) - 2024-12-18

### Bug Fixes

- exit build script when coop signatures are disabled - ([ef20340](https://github.com/BoltzExchange/boltz-web-app/commit/ef20340e05f056c08d06be1bb8e41829697b7c5f))
- JPEG refund files (#765) - ([ef48ad4](https://github.com/BoltzExchange/boltz-web-app/commit/ef48ad4e1d31ea645a181e8261913d2d82034a0d))
- only sign coop claims for submarine swaps - ([3e0032c](https://github.com/BoltzExchange/boltz-web-app/commit/3e0032c9e99c73cb790b683bef8920b6416439a8))
- web3 add chain prompt (#771) - ([c98503d](https://github.com/BoltzExchange/boltz-web-app/commit/c98503d7458b1fd045898673dcede7db7e47c583))
- refund files for non RBTC pairs in mobile EVM browsers (#776) - ([d22238c](https://github.com/BoltzExchange/boltz-web-app/commit/d22238cd1028e5364c4bb826306e394b9f8fcb94))

### Features

- add WalletConnect - ([7cf02a1](https://github.com/BoltzExchange/boltz-web-app/commit/7cf02a171c17758861e1a21a6253331ba4d7de3a))
- show error when QR scanning is not supported in browser (#768) - ([e64874d](https://github.com/BoltzExchange/boltz-web-app/commit/e64874db43e71d2d988fabe9564e01c85e933488))
- help server claim Chain Swaps that receive on EVM - ([2c61f54](https://github.com/BoltzExchange/boltz-web-app/commit/2c61f5423c6adb29f39bc92e4a6ef7b59d0cff2c))

### Miscellaneous Chores

- update contract hashes - ([bcfa6b1](https://github.com/BoltzExchange/boltz-web-app/commit/bcfa6b14f3a61cb075c0342e1e67b62a54560d8f))
- minor dependency updates - ([74f0a54](https://github.com/BoltzExchange/boltz-web-app/commit/74f0a540652d6e9cbdb94a5895bf88cf98148770))
- only load WalletConnect when configured - ([04a5a27](https://github.com/BoltzExchange/boltz-web-app/commit/04a5a273e41f061e150a076b90b3b4577b93f331))
- pass referral id in every request header (#773) - ([835a841](https://github.com/BoltzExchange/boltz-web-app/commit/835a841c7c77b90230d0f302de8cb78701e7385d))
- contract hash for EtherSwap v4 on mainnet - ([d43ad11](https://github.com/BoltzExchange/boltz-web-app/commit/d43ad1150a1270a449de7d780019a7aa9cf54e6b))
- bump version to v1.6.0 - ([aaafe08](https://github.com/BoltzExchange/boltz-web-app/commit/aaafe08dd9686a4aba42e0d62cb049d5757a95ca))

### Refactoring

- nicer WebSocket debugging logs - ([164f535](https://github.com/BoltzExchange/boltz-web-app/commit/164f535035327795fc31b0a8361f2eaaefddeb8d))

---
## [1.5.4](https://github.com/BoltzExchange/boltz-web-app/compare/v1.5.3..v1.5.4) - 2024-12-04

### Miscellaneous Chores

- switch to Blockstream Liquid explorer (#764) - ([042c05f](https://github.com/BoltzExchange/boltz-web-app/commit/042c05f61ce20ee7c47ca8dcab02336e0220cc8c))
- bump version to v1.5.4 - ([be2edba](https://github.com/BoltzExchange/boltz-web-app/commit/be2edbaddbf822a144b0c8d861f56faefb9eaf92))

### Refactoring

- make RSK log scan endpoint optional (#761) - ([89d3f6a](https://github.com/BoltzExchange/boltz-web-app/commit/89d3f6a7e0a33742246eb804ec1bec1151f14501))
- show transaction.claim.pending as success (#763) - ([80685e8](https://github.com/BoltzExchange/boltz-web-app/commit/80685e81b1edd5ebf7ce64bd01b6b20d6f8407b6))

---
## [1.5.3](https://github.com/BoltzExchange/boltz-web-app/compare/v1.5.2..v1.5.3) - 2024-12-02

### Bug Fixes

- address parsing for new quote (#753) - ([125cfd5](https://github.com/BoltzExchange/boltz-web-app/commit/125cfd58e2899e8eb62eb3e9e0e48fa27cc1cc4b))
- Ledger signature parsing (#756) - ([0bdbe67](https://github.com/BoltzExchange/boltz-web-app/commit/0bdbe6748d086a9cc05cd7aa887017f51091ced0))
- no refund file download in mobile EVM browser (#760) - ([6c514dc](https://github.com/BoltzExchange/boltz-web-app/commit/6c514dc3fe5db1540cb7258882fe8344442e2611))

### Features

- nicer HWW derivation path selection (#755) - ([a5f46e3](https://github.com/BoltzExchange/boltz-web-app/commit/a5f46e34c63ca15c4e02e62fd3e54718a347c55f))

### Miscellaneous Chores

- minor dependency updates (#750) - ([37420ad](https://github.com/BoltzExchange/boltz-web-app/commit/37420ad5056917f14af11195e0e0b2c8ddf9d420))
- switch RSK explorer to Blockscout (#759) - ([dfc9e89](https://github.com/BoltzExchange/boltz-web-app/commit/dfc9e897b50c5839d44f92a88fa39e64bd44ab7d))
- bump version to v1.5.3 - ([811e7e2](https://github.com/BoltzExchange/boltz-web-app/commit/811e7e29da300cf2211e4ea0bc01946eb73472dc))

### Refactoring

- nicer screen for logs refunds (#752) - ([a162f67](https://github.com/BoltzExchange/boltz-web-app/commit/a162f6757ac9ba124e7a18206e9a8a4816151e63))

---
## [1.5.2](https://github.com/BoltzExchange/boltz-web-app/compare/v1.5.1..v1.5.2) - 2024-11-28

### Features

- Submarine Swap preimage copy button (#734) - ([8f6e924](https://github.com/BoltzExchange/boltz-web-app/commit/8f6e924dc88a23d0fb33b016978acda5d6daf5bf))
- show when no browser wallet found (#742) - ([93464ac](https://github.com/BoltzExchange/boltz-web-app/commit/93464aca56b3a84401b523739d4efbff7f6a1009))
- 0-amount chain swaps (#741) - ([ebd7714](https://github.com/BoltzExchange/boltz-web-app/commit/ebd7714e2b6e7229ea2bbc7c676976636d1862f1))
- validate-payment.com instead of copy preimage (#748) - ([ca8059f](https://github.com/BoltzExchange/boltz-web-app/commit/ca8059f68c363144d15df418bf4574d7461319f8))
- add Chatwoot (#745) - ([32810e6](https://github.com/BoltzExchange/boltz-web-app/commit/32810e6618b87e66fec023f8029b1b636eaae943))

### Miscellaneous Chores

- update changelog for v1.5.1 - ([76d1833](https://github.com/BoltzExchange/boltz-web-app/commit/76d18336a164173f966e5f77a84454738609cef3))
- bump version to v1.5.2 - ([aaaa66e](https://github.com/BoltzExchange/boltz-web-app/commit/aaaa66ef3fc1f14c7daebbb1b2b635f4526a0442))

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
