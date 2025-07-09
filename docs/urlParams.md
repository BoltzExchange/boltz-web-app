---
next: false
---

# 🔍 URL query parameters

To prefill certain inputs of the the site, URL query parameters can be used.
Those parameters are documented here.

## Embedding

When `embed` is set to `1`, only the swap box will be shown.

## Destination

`destination` prefills either the onchain address or invoice input field. The
inferred asset takes precedence over `receiveAsset` and in case a lightning
invoice is set, its amount takes precedence over all other inputs to set the
amount.

## Assets

`sendAsset` and `receiveAsset` can be used to set the assets. Possible values
are:

- `LN`
- `BTC`
- `L-BTC`
- `RBTC`

## Amounts

`sendAmount` or `receiveAmount` set the respective amounts. Value is denominated
in satoshis and `sendAmount` takes precedence.

## Language

When no language has been set before, the default can be set with `lang`.
Available values are:

- English: `en`
- German: `de`
- Spanish: `es`
- Portuguese: `pt`
- Chinese: `zh`
- Japanese: `ja`
