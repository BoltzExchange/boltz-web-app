# Changelog

All notable changes to this project will be documented in this file.

## [1.3.3] - 2024-04-16

### 🚀 Features

- Add email to footer (#502)
- Telegram icon to footer (#505)
- Dynamic config (#507)
- Add user feedback to copy button (#516)
- Switch assets based on input (#503)
- Localized BTC denomination separator (#538)

### 🐛 Bug Fixes

- Remove RBTC from beta and mainnet (#512)
- Register serviceworker on / (#511)
- Error handling for null swap in pay (#515)
- Show EVM coop refund on lockup failed (#517)
- Bail validation and refactor create button labels (#500)
- CSS for external links in menu (#527)
- Catch exception on refund page (#534)
- QR code placeholder size (#541)
- Remove spaces when copying (#543)
- Multiple tabs local storage issue (#544)
- Hide network in navbar on mainnet (#550)
- Disable until lnurl is fetched and submitted (#553)
- Regtest invoice validtion on mainnet (#554)

### 🚜 Refactor

- Move create button signal to context (#497)
- Build scripts (#508)
- Use solid-icons instead of single SVGs (#510)
- Create swap with lnaddress / lnurl (#535)
- Node stats formatting (#540)

### 📚 Documentation

- Fix "Back to Docs Home" link

### 🧪 Testing

- Set loglevel to error in tests (#514)

### ⚙️ Miscellaneous Tasks

- Bump follow-redirects from 1.15.5 to 1.15.6 (#513)
- Update dependencies (#518)
- Update CI checkout action (#519)
- Change youtube link to playlist (#522)
- Add canary link (#526)
- Use compareTrees function from boltz-core (#532)
- Show return to page only on mobile (#537)
- Prepare release v1.3.2
- Bump vite from 5.2.4 to 5.2.6 (#552)

## [1.3.2] - 2024-03-29

### Bug Fixes

- NPM package version
- Only retry claims of Taproot swaps (#531)
- Node stats when LND is offline (#539)
- Multiple claim transactions being broadcasted (#542)

### Features

- Prevent refunding to lockup address (#523)

## [1.3.1] - 2024-03-11

### 🚀 Features

- Handle WIF encoded private keys (#462)
- Cooperative submarine claims (#463)
- Add boltz status page to footer (#466)
- Switch from SSE to WS
- Cooperative EVM refunds
- Migrate all endpoints to v2
- Fetch node public key
- Add youtube link and create footer nav (#476)
- Add testnet link (#486)
- Show WASM error page if not supported (#485)
- Amount max/min error should have priority (#483)
- Only show refund button when file is uploaded (#471)
- Add loading animation (#493)
- Implement Satcomma formatting for sats amounts (#494)
- Intermediate step when uploading refundjson and proper error (#489)

### 🐛 Bug Fixes

- ReferralId when creating swaps
- Legacy pair miner fee calculation
- Autoswitch off by 1 (#467)
- Broken tests
- Catch error on 0 amount invoices (#477)
- Safety check if swap was found (#484)
- Disable WebLN invoice button on invalid amount (#479)
- Retry Taproot claims (#487)
- Duplicate spacer for BTC swaps (#490)
- Improve pasting (#496)

### 🚜 Refactor

- Switch tests to jest (#473)
- Consistent API V2 endpoint usage (#480)

### ⚙️ Miscellaneous Tasks

- Add aqua and marina as integrations (#461)
- Update dependencies (#472)
- Bump CI Node version
- Remove unused dependencies
- Update dependencies
- Bump @openzeppelin/contracts from 5.0.1 to 5.0.2 (#495)
- Release v1.3.1 (#499)

### Bug

- Address was not validated after assets switch (#475)

## [1.3.0] - 2024-01-25

### 🚀 Features

- QR code scanner (#323)
- Add version footer (#410)
- Placeholders for amounts instead of 0 on load (#394)
- Taproot swaps
- Uncooperative claim fallback
- Use API v2 to fetch pairs
- Automatic denom switcher (#395)
- Deeplinks for wallets (#378)

### 🐛 Bug Fixes

- Refunds on invoice payment failure (#406)
- Network button margin (#407)
- Swap list alignment (#400)
- Invoice with millisats precision amount (#425)
- Use of DOM element references after component cleanup (#421)
- Copy onchain amount (#433)
- Coalesce Boltz fee with 0
- Do not create swap when WASM is not available (#446)
- Pair hash of RSK
- Disable refund button while transaction is being created (#453)
- Refunded status button green (#454)
- Refunds strings (#455)
- Lnurl error message (#457)
- Tweak QR code scanner options (#458)
- Taproot swap refund files
- Undefined asset on refund page (#459)

### 🚜 Refactor

- Buttons width 100% (#379)
- Move signals and ecpair to TypeScript (#408)
- Move components to TypeScript (#409)
- Use strong types for window.webln (#412)
- Remove clickable amount component (#423)
- Amount conversion (#420)
- Amount calculations (#422)
- Fetcher not using global signals (#427)
- FeeChecker not using global signals (#428)
- SwapChecker into component (#431)
- Move feeCheck from helper (#432)
- Use create context for signals (#430)
- Use PayContext for signals (#434)
- Claim and refund logic (#435)
- Use globalcontext remove signals and fetcher (#439)
- Use globalcontext remove signals
- Update boltz-core
- Revert to 0 as placeholder for amounts

### 🧪 Testing

- Fix validation test for Taproot

### ⚙️ Miscellaneous Tasks

- Disable address input autocomplete (#404)
- Move tests to TypeScript (#413)
- Move main components to ts (#415)
- Move utils to TypeScript (#416)
- Move status pages to TypeScript (#417)
- Cleanup src file structure (#424)
- Use blockstream.info on testnet (#429)
- Bump follow-redirects from 1.15.3 to 1.15.5 (#449)
- Bump boltz-core version
- Update vite (#450)
- Clarify wording on refund page (#456)
- Prepare release v1.3.0

## [1.2.1] - 2023-12-22

### 🚀 Features

- Denomination toggle (#398)

### 🐛 Bug Fixes

- Reactive clickable amount label
- Revalidate amounts when address is valid (#393)
- Missing qrcode import (#392)
- Do not setReverse in Pay.jsx (#376)

### ⚙️ Miscellaneous Tasks

- Release v1.2.1 (#401)

### Misc

- Revert to sat as default denomination (#397)

## [1.2.0] - 2023-12-21

### 🚀 Features

- Make min and max clickable (#303)
- Browser language detection (#301)
- Use swapbox on `/` (#289)
- RSK swaps (#306)
- Refund step for normal swaps (#258)
- Embedded swap box for iframes (#328)
- Add Boltz icon to QR codes (#330)
- Improved create swap button (#317)
- Extract from bip21 follow up (#349)
- Add zh (#375)

### 🐛 Bug Fixes

- Handling of LNURLs
- Order of swap history
- Fixes scrollbar jump when clicking into swapbox (#311)
- Alignment past swaps (#310)
- Alignment past swaps (#315)
- Out of context execution of effects/memos (#322)
- Missing space in Create (#326)
- Remove timeout blockheight from swap flow (#309)
- Handle js error when asset is missing on api (#329)
- Disable contract code match check
- Skip refund step for RSK
- ES translations (#333)
- Es lang typo (#336)
- LNURL fetching error handling (#345)
- Webln paste invoice gets deleted (#343)
- Uncaught (in promise) ReferenceError: can't access lexical declaration 'validateAmount' (#350)
- Node.js version in CI (#356)
- Small ES lang fix (#362)
- Only show expiry warning for mainchain (#367)
- Only set onchain address for Reverse Swaps (#371)
- Failure reason gets overwritten (#365)
- Create button label on language change (#364)
- Asset select based on available pairs (#369)
- Empty swaplist on `/refund` (#373)

### 🚜 Refactor

- Add social urls and onion into config (#312)
- Move signals into components (#324)
- Convert configs to typscript (#340)
- I18n to TypeScript (#342)
- Invoice extraction (#361)
- Refine homepage design (#325)

### 🧪 Testing

- Comment RSK contract verification tests

### ⚙️ Miscellaneous Tasks

- V1.1.2 changelog
- Dependency updates
- Bump browserify-sign from 4.2.1 to 4.2.2 (#295)
- Update dependencies (#314)
- Add pre commit config (#319)
- Prettier import order (#320)
- Remove unused test snapshot
- Optimize hr css (#331)
- Update vite security fix (#347)
- Default to BTC denomination (#384)
- V1.2.0 release prep
- Changelog

## [1.1.2] - 2023-10-20

### 🚀 Features

- Change calculated send/receive amount on fee update (#285)
- Save selected send/receive asset in localstorage (#288)

### 🐛 Bug Fixes

- Invoice validation (#282)
- Check fee amount instead of pair hash (#283)
- Only claim from inside swapchecker (#284)

### 🚜 Refactor

- Remove usages of deprecated createStorageSignal
- Switch to @bitcoinerlab/secp256k1

### ⚙️ Miscellaneous Tasks

- V1.1.1 changelog
- Trivial dependency updates
- Remove unused i18n check
- Update i18n
- Release v1.1.2 preparation (#292)

### Bug

- Decimals handling for 0.000 (#287)

## [1.1.1] - 2023-10-11

### 🚀 Features

- Use invoice amount from pasted invoice (#276)

### 🐛 Bug Fixes

- Default swap direction (#269)
- No # in language selector (#272)

### 📚 Documentation

- Add PWA instructions (#275)

### ⚙️ Miscellaneous Tasks

- Update CHANGELOG.md for v1.1.0
- Add commit template (#267)
- Bump postcss from 8.4.24 to 8.4.31 (#274)
- V1.1.1 release prep (#278)

## [1.1.0] - 2023-10-03

### 🚀 Features

- Show logo on loading screen (#210)
- Japanese translation (#184)
- Add german & spanish (#218)
- Add 404 page (#222)
- Add loading indicator for swap status (#211)
- Add timeout to language dropdown menu (#227)
- Different referrals for mobile and desktop (#240)
- Default language in config (#234)
- Better labels for block explorer links (#239)
- API URL configurable per asset (#232)
- History backup and restore (#237)
- Multiple SSE swap update streams (#236)
- Persist send amount on direction switch (#243)
- Gitbook (#228)
- Add cropped invoice and amount to swap screen (#262)
- Refactor asset selector (#257)

### 🐛 Bug Fixes

- Improve language selector (#216)
- Back to home link to / (#223)
- Make labels shorter for more menu room (#225)
- Improve language menu selector (#224)
- Close asset dialog when clicking outside of box (#226)
- WebLN enable() should not expect an object (#230)
- Sort swap history by creation date
- Refund QR generation on mobile Tor browser (#241)
- Remove default amount (#242)
- Dh link (#246)
- Grammar issue in German
- Docs link (#251)
- Validation of native SegWit normal Swap (#259)
- Issue claiming im background (#260)
- I18n test
- Missing German translations
- German, add missing Spanish strings
- Missing receive string in DE, ES
- DE select_asset
- Extra check if swap was already claim (#261)

### 🚜 Refactor

- Improve refund file flow (#209)
- Show full size swap box on landing page (#213)
- WebLN enable callback (#231)
- Remove fee reload button (#235)
- Add SCSS stylesheets (#233)
- Use polling to fetch latest status of background swaps (#266)

### ⚙️ Miscellaneous Tasks

- Add changelog
- BSL Release Update (#265)
- Bump package.json version to v1.1.0

### FiX

- Add missing placeholder in DE, ES

### Rm

- Japanese language (#249)

## [1.0.1] - 2023-07-19

### 🐛 Bug Fixes

- Broken links (#186)
- Add GitHub link (#191)
- QR code generation in TOR browser (#195)

### ⚙️ Miscellaneous Tasks

- Remove Vercel script

## [1.0.0] - 2023-06-19

### 🐛 Bug Fixes

- Invoice has to be reset after the amounts change again (#71)

<!-- generated by git-cliff -->
