# SideSwap L-BTC/L-USDt Integration — Status

## What it does

Allows users to swap any asset (BTC, LN, etc.) to Liquid USDt by chaining a Boltz swap (anything → L-BTC) with a SideSwap trade (L-BTC → L-USDt) via an intermediary temp Liquid wallet.

## Core flow

1. User initiates a swap to L-USDt
2. Boltz swap sends L-BTC to a temporary confidential P2WPKH wallet derived from the rescue mnemonic
3. `SideSwapExecution` detects the claim, waits for confirmation, then executes a SideSwap trade using the L-BTC UTXO
4. SideSwap sends L-USDt directly to the user's destination address

## What works

- Asset selector groups L-USDt under "USDT" with the Liquid icon
- Address input for L-USDt destinations with correct placeholder text
- Quote estimation from SideSwap API (with minimum amount enforcement: 30k sats)
- Pair routing and minimum amount display accounts for SideSwap's higher minimum
- Blinding factor byte-reversal for SideSwap API compatibility
- Error propagation from SideSwap quote notifications (fails fast after 5 consecutive errors)
- Recovery UI (`SideSwapRecovery` component) for refunding L-BTC from the temp wallet when the SideSwap leg fails
- Internal rescue (`/rescue`) detects failed SideSwap swaps and shows "Refund" action
- External rescue (`/rescue/external`) detects stuck temp wallet UTXOs via `enrichSwapsWithTempWalletData`, renders `SideSwapRecovery` with the uploaded rescue file
- Temp wallet sweep transaction: builds, blinds, signs, and broadcasts correctly (mirrors boltz-core's Liquid PSET pattern)

## What has NOT been tested end-to-end successfully

- A complete happy-path swap where the SideSwap trade actually succeeds (L-BTC → L-USDt lands in user's wallet). Previous attempts failed due to: blinding factor issues (fixed), "no matching orders" (was below minimum — fixed with 30k sat floor), and the sweep/refund bugs (now fixed). The trade signing via `signPset` for SideSwap's PSET has never been exercised in production — the validator fix (compact sig format) should make it work but is untested.

## Key files

| File | Purpose |
|------|---------|
| `src/utils/sideswap.ts` | SideSwap WebSocket client, quote estimation, trade execution, min amount constant |
| `src/utils/liquidWallet.ts` | Temp wallet derivation, UTXO unblinding, PSET signing (`signPset` for SideSwap trades), sweep tx building (`buildMultiAssetSweepTransaction`) |
| `src/utils/sideswapHelpers.ts` | Block explorer tx fetching helper |
| `src/status/SideSwapExecution.tsx` | Post-claim SideSwap trade orchestration, retry logic on refresh, failure UI |
| `src/components/SideSwapRecovery.tsx` | Refund UI for sweeping L-BTC from temp wallet (works for both internal and external rescue) |
| `src/utils/rescue.ts` | `createRescueList` detects failed SideSwap legs, `enrichSwapsWithTempWalletData` for external rescue |
| `src/pages/RefundRescue.tsx` | Routes to `SideSwapRecovery` for temp wallet sweeps |
| `src/pages/RescueExternal.tsx` | Wires `enrichSwapsWithTempWalletData` into external rescue flow |
| `src/utils/Pair.ts` | `getMinimum()` enforces `Math.max(boltzMin, SIDESWAP_MIN_LBTC_SATS)` |
| `src/i18n/i18n.ts` | Added keys: `sideswap_refund_description`, `sideswap_amount_too_small` |

## Known issues / remaining work

- **Happy-path test needed**: SideSwap trade needs end-to-end testing with an amount above 30k sats
- **`signPset` untested with SideSwap**: Validator was fixed (compact sig format) but never tested against SideSwap's actual PSET
- **Asset display string**: Uses `"L-BTC"` constant; user requested `"LBTC"` — the constant itself was not renamed
- **Tests**: `tests/utils/liquidWallet.test.ts` may need updating for the removed `buildSweepTransaction` export and the new blinding logic in `buildMultiAssetSweepTransaction`
- **Upstream candidate**: `buildMultiAssetSweepTransaction` duplicates boltz-core's Liquid tx pattern and should ideally be upstreamed (noted in code comment)
