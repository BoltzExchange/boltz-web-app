# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2023-12-20

### Bug Fixes

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

### Features

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

### Miscellaneous Tasks

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

### Refactor

- Add social urls and onion into config (#312)
- Move signals into components (#324)
- Convert configs to typscript (#340)
- I18n to TypeScript (#342)
- Invoice extraction (#361)
- Refine homepage design (#325)

### Testing

- Comment RSK contract verification tests

## [1.1.2] - 2023-10-20

### Bug Fixes

- Invoice validation (#282)
- Check fee amount instead of pair hash (#283)
- Only claim from inside swapchecker (#284)

### Features

- Change calculated send/receive amount on fee update (#285)
- Save selected send/receive asset in localstorage (#288)

### Miscellaneous Tasks

- V1.1.1 changelog
- Trivial dependency updates
- Remove unused i18n check
- Update i18n
- Decimals handling for 0.000 (#287)
- Release v1.1.2 preparation (#292)

### Refactor

- Remove usages of deprecated createStorageSignal
- Switch to @bitcoinerlab/secp256k1

## [1.1.1] - 2023-10-11

### Bug Fixes

- Default swap direction (#269)
- No # in language selector (#272)

### Documentation

- Add PWA instructions (#275)

### Features

- Use invoice amount from pasted invoice (#276)

### Miscellaneous Tasks

- Update CHANGELOG.md for v1.1.0
- Add commit template (#267)
- Bump postcss from 8.4.24 to 8.4.31 (#274)
- V1.1.1 release prep (#278)

## [1.1.0] - 2023-10-03

### Bug Fixes

- Grammar issue in German
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
- Docs link (#251)
- Validation of native SegWit normal Swap (#259)
- Issue claiming im background (#260)
- I18n test
- Missing German translations
- German, add missing Spanish strings
- Missing receive string in DE, ES
- DE select_asset
- Extra check if swap was already claim (#261)

### Features

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

### Miscellaneous Tasks

- Add changelog
- BSL Release Update (#265)
- Bump package.json version to v1.1.0

### Refactor

- Improve refund file flow (#209)
- Show full size swap box on landing page (#213)
- WebLN enable callback (#231)
- Remove fee reload button (#235)
- Add SCSS stylesheets (#233)
- Use polling to fetch latest status of background swaps (#266)

### FiX

- Add missing placeholder in DE, ES

### Rm

- Japanese language (#249)

## [1.0.1] - 2023-07-19

### Bug Fixes

- Broken links (#186)
- Add GitHub link (#191)
- QR code generation in TOR browser (#195)

### Miscellaneous Tasks

- Remove Vercel script

## [1.0.0] - 2023-06-19

### Bug Fixes

- Invoice has to be reset after the amounts change again (#71)

<!-- generated by git-cliff -->
