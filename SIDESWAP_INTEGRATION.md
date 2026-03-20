# SideSwap L-BTC/L-USDt Integration — Agent Context

> This file exists to give a follow-up AI agent session full context.
> Delete it before merging to main.

## Goal

Enable Boltz Web App users to swap any supported asset into **Liquid USDt**
by routing through an L-BTC intermediate hop, then executing an atomic swap
on SideSwap's market API.

## Architecture

```
User sends BTC/LN/RBTC/etc.
        │
        ▼
   Boltz Swap (Submarine/Reverse/Chain)
        │  claims L-BTC to a temporary P2WPKH Liquid wallet
        ▼
   Temp Liquid Wallet (app-derived, non-custodial)
        │  L-BTC UTXO is unblinded, fed to SideSwap
        ▼
   SideSwap Atomic Swap (PSET-based)
        │  signs taker inputs, SideSwap broadcasts
        ▼
   L-USDt arrives (currently to temp wallet address)
```

### Why a temp wallet?

SideSwap does not support Taproot UTXOs. Boltz claims use Taproot by default.
The app derives a temporary **P2WPKH confidential Liquid address** from the
user's rescue file mnemonic, which SideSwap can consume.

### Derivation paths

- Spend key: `m/44/1776/0/0/{index}`
- Blinding key: `m/44/1776/1/0/{index}`

Coin type `1776` is chosen to avoid collision with existing Boltz keys.

## Key Files

### New files

| File | Purpose |
|------|---------|
| `src/utils/sideswap.ts` | SideSwap WebSocket client (singleton), RPC calls, quote estimation, trade execution |
| `src/utils/sideswapHelpers.ts` | Fetches raw tx hex from Liquid block explorers |
| `src/utils/liquidWallet.ts` | Derives temp wallet, unblinds UTXOs, signs PSETs, builds sweep txs |
| `src/status/SideSwapExecution.tsx` | Post-claim state machine: wait confirm → quote → sign → broadcast |
| `src/components/SideSwapRecovery.tsx` | Sweeps intermediate L-BTC to user address if SideSwap trade fails |

### Modified files

| File | Changes |
|------|---------|
| `src/consts/AssetKind.ts` | Added `LiquidToken` |
| `src/consts/Enums.ts` | Added `SwapType.SideSwap` |
| `src/consts/Assets.ts` | Added `LUSDT`, `isLiquidAsset()`, `isLiquidTokenAsset()`, display symbol mapping |
| `src/configs/base.ts` | Extended `Asset` type with `liquidToken` field, `Config` with `sideswapUrl` |
| `src/configs/mainnet.ts` | L-USDt asset definition, SideSwap WebSocket URL |
| `src/configs/testnet.ts` | Same for testnet |
| `src/utils/Pair.ts` | Detects `LiquidToken` routeVia, builds `SwapType.SideSwap` hop, handles in calculate methods |
| `src/utils/swapCreator.ts` | `SideSwapStatus` enum, `SideSwapDetail` type, `sideswap` field on `SwapBase` |
| `src/utils/compat.ts` | `isLiquidAsset()` for address decoding, `"L-USDt"` in `possibleUserInputTypes` |
| `src/utils/denomination.ts` | `LiquidToken` assets use their `precision` (8) for decimal formatting |
| `src/utils/rescue.ts` | `SwapType.SideSwap` in `swapTimeoutBlockHeight` (returns MAX_SAFE_INTEGER) |
| `src/components/CreateButton.tsx` | `buildSideSwapDetail()`, temp wallet claim address override |
| `src/status/TransactionConfirmed.tsx` | Renders `SideSwapExecution` when `swap().sideswap` is defined |
| `src/i18n/i18n.ts` | All SideSwap status/recovery translation keys |
| `src/style/swaplist.scss` | `USDt` icon rule |
| `src/style/qrcode.scss` | `USDt` icon rule |

## SideSwap API

WebSocket JSON-RPC v2.0 at `wss://api.sideswap.io/json-rpc-ws`

- `market.list_markets` — discover available pairs
- `market.start_quotes({ asset_pair, utxos })` — subscribe to streaming quotes (empty utxos for estimation)
- `market.stop_quotes` — unsubscribe
- `market.get_quote({ quote_id, asset_pair, utxos })` — get a tradeable PSET
- `market.taker_sign({ quote_id, pset })` — submit signed PSET for broadcast

Quote responses arrive as `market.quote` notifications (server-push).

### PSET signing

1. Parse base64 PSET via `liquidjs-lib` `Pset.fromBase64()`
2. Find inputs whose `witnessUtxo.script` matches our temp wallet's output script
3. Get sighash via `pset.getInputPreimage(i, 0x01)` (SIGHASH_ALL)
4. Sign with `secp256k1.sign(preimage, privkey, { prehash: false, format: 'der' })`
5. Append `0x01` sighash byte
6. Add via `Signer.addSignature()` with a validator callback

## What's Complete

- [x] `AssetKind.LiquidToken` and `SwapType.SideSwap` enums
- [x] L-USDt asset config (mainnet + testnet), `canSend: false`
- [x] Asset helpers (`isLiquidAsset`, `isLiquidTokenAsset`, display symbol, network)
- [x] Address validation and denomination formatting for L-USDt
- [x] SideSwap WebSocket client with connection management
- [x] Quote estimation via `start_quotes` with rate caching (30s TTL)
- [x] `Pair.ts` routing: detects LiquidToken, builds Boltz + SideSwap hops
- [x] `calculateReceiveAmount` / `calculateSendAmount` for `SwapType.SideSwap`
- [x] Temp Liquid P2WPKH wallet derivation from rescue file
- [x] `CreateButton` overrides claim address to temp wallet for SideSwap hops
- [x] `SideSwapExecution.tsx` state machine (confirm → quote → sign → broadcast)
- [x] PSET signing (`@noble/curves` secp256k1, DER format)
- [x] UTXO unblinding via `liquidjs-lib` confidential API
- [x] `SideSwapRecovery.tsx` sweeps intermediate L-BTC on failure
- [x] Rescue/refund flow handles `SwapType.SideSwap`
- [x] CSS icons for `USDt` in swap list and QR overlays
- [x] i18n keys for all SideSwap statuses
- [x] TypeScript compiles clean (`tsc --noEmit` passes)
- [x] All pre-existing tests still pass
- [x] New tests for asset helpers in `Assets.spec.ts`

## What Remains

### 1. Tests (minor)

- **`tests/utils/Pair.spec.ts`**: Add test for SideSwap routing. Need to mock
  `estimateSideSwapReceive` / `estimateSideSwapSend` from `../../src/utils/sideswap`.
  Add chain pairs for `BTC → L-BTC` to the test `pairs` object, then verify
  `new Pair(pairs, "BTC", "L-USDt")` produces a route with `hasSideSwapHop === true`
  and `requiredInput === RequiredInput.Address`.

- **`tests/utils/denomination.spec.ts`**: Add test cases for L-USDt using
  `Denomination.Sat` with 8-decimal precision (same as existing USDT0 tests but
  verifying the `LiquidToken` code path).

### 2. Post-trade L-USDt sweep (functional gap)

After the SideSwap atomic swap, L-USDt lands in the **temp wallet** (same address
as the L-BTC input). The user's actual destination address is stored in
`swap.sideswap.userAddress` but there's no code to sweep L-USDt from temp wallet
→ user address.

**Problem**: Sweeping requires L-BTC for Liquid tx fees, but all L-BTC was consumed
by the trade. Options to investigate:

1. Check if SideSwap's PSET includes L-BTC change (likely for non-exact amounts)
2. Check if SideSwap API accepts a `receive_address` param in `start_quotes` or
   `get_quote` that directs the L-USDt output elsewhere
3. If neither works, require the user to have a small L-BTC amount for fees, or
   build a "send-all" style L-USDt tx with fee paid from a separate L-BTC UTXO

### 3. End-to-end testing on testnet

Manual testnet verification of the full flow:
1. Select L-USDt as receive, enter Liquid address
2. Send BTC/LN, watch Boltz claim to temp wallet
3. Observe SideSwap execution (quote → sign → broadcast)
4. Verify L-USDt arrives
5. Test failure/recovery path

## Pre-existing Test Failures

`tests/utils/compat.spec.ts` has 10 failures on `main` (verified by stashing
changes). These are unrelated to SideSwap — they involve `probeUserInput` for
regtest addresses/invoices.
