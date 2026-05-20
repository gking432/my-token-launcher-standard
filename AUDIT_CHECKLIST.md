# MoveMint — Pre-Launch Audit Checklist

This checklist covers three areas: (1) smart contract security for a formal auditor,
(2) operational / infrastructure security, and (3) legal / regulatory exposure from the
provider's perspective. Issues are graded **CRITICAL / HIGH / MEDIUM / LOW**.

---

## Part 1 — Smart Contract (`sources/token_launcher.move`)

### CRITICAL: Potential fund-loss or loss-of-funds-access

**1. Admin can drain all bonding curve reserves (`withdraw_apt`, line 775)**

The module admin (`0x8c69…`) can call `withdraw_apt(admin, amount)` to pull any amount
of APT from the resource account. The resource account holds the bonding curve reserves
for *every* token — i.e., all user funds across all tokens. A single admin transaction
can empty the entire protocol.

- What to verify: Is this function intentional? If so, it must be restricted by a
  timelock, multisig, or cap (e.g., only sweep *graduated* pool proceeds, never live
  bonding curve reserves). If not intentional, remove it before mainnet.
- Worst case: Total user fund loss. This is a rug-pull backdoor.
- Recommendation: Remove the function or gate it behind a 48-hour timelock + 2-of-3
  multisig before any real value is at risk.

---

**2. `calculate_price` (slippage guard) and the cost formula are different (`buy_tokens` lines 487–521)**

There are two separate implementations of the bonding curve price formula:

- `calculate_price(tokens_sold)` at line 274 uses unscaled arithmetic:
  `(19_029_514_756 / denom) + (61_905_327 / 100_000_000)` — the constant term integer-
  divides to 0, so the function returns only the hyperbolic term with no constant.

- The actual cost formula inside `buy_tokens` (lines 496–521) scales the numerator by
  `1_000_000` before dividing and adds `61_905_327` as a constant in the scaled space,
  producing a materially different result.

The slippage check at line 489–490 uses `calculate_price` to compare `price_before` and
`price_after`, but those values don't reflect the real prices being charged. This means
the slippage guard may silently pass trades that exceed the user's stated tolerance, or
reject trades that should be allowed.

- What to verify: Confirm that `calculate_price` and the inline cost formula produce
  equivalent results (scaled consistently). One formula should be used everywhere.
- Worst case: Users receive unexpected slippage with no on-chain protection.

---

**3. Creator tokens are permanently locked at graduation (line 608)**

During the automatic graduation block in `buy_tokens`, 20 million tokens earmarked for
the creator are minted to the resource account's `pool_store`:

```
fungible_asset::mint_to(&vault.mint_ref, pool_store, creator_tokens);
```

There is no entry function to let the creator claim these tokens. They are minted but
inaccessible. Multiplied across many graduating tokens, this could represent significant
stuck value.

- What to verify: Implement a `claim_creator_tokens(creator, ticker)` entry function
  before graduation goes live.

---

**4. `migrate_to_dex` always aborts — DEX migration is broken (line 982–1035)**

`migrate_to_dex` requires a `LiquidityPool` to exist for the token (`E_POOL_NOT_FOUND`,
line 996). But the graduation block in `buy_tokens` does NOT create a `LiquidityPool` —
it only sets `is_graduated = true` and mints tokens to the resource store. The only way
a `LiquidityPool` gets created is via `create_liquidity_pool`, which is a separate
permissionless entry function never called in the normal user flow.

Result: After a token graduates, `migrate_to_dex` aborts, the bonding curve is closed
(`is_graduated = true` prevents any more buying/selling), and all APT raised is locked
in the resource account with no path to release.

- What to verify: The graduation block should either (a) create the `LiquidityPool`
  atomically, or (b) `migrate_to_dex` should not depend on a pre-existing pool — it
  should operate directly on the vault's APT reserves.
- Worst case: Token graduates, trading halts, 1283 APT is locked permanently.

---

### HIGH: Functional issues with significant risk

**5. `state.apt_amount` is not updated after graduation fees are paid (lines 592–619)**

The graduation block pays 83 APT in fees (`GRADUATION_PLATFORM_FEE_APT` +
`GRADUATION_CREATOR_FEE_APT`) from the resource signer but never subtracts these from
`state.apt_amount`. `migrate_to_dex` later reads `state.apt_amount` to size the DEX
pool's APT balance (line 1001), so it would overcount by 83 APT, creating an imbalanced
pool.

---

**6. Debug events remain in production code (scattered throughout `buy_tokens`, `sell_tokens`)**

Roughly 20+ `DebugEvent` and `DebugState` emissions are present (e.g., lines 462, 475,
477, 483, 491, 515–517, 522, 539–541, etc.). Each event costs gas. On a high-volume
mainnet this adds meaningful per-trade overhead. They should be removed before
production deployment.

---

**7. `internal_swap` self-transfer bug (lines 874, 917)**

In the `swap_token_a_for_token_b` path, the APT output is sent via:

```
coin::transfer<AptosCoin>(trader, trader_addr, output_amount)
```

This transfers from `trader` (the signer) to `trader_addr` (same address) — a no-op.
The pool's APT balance is decremented but the trader never receives the APT. The entire
AMM swap mechanism appears non-functional. If it's not yet intended for use, remove it
or gate it with an `abort` to avoid confusion.

---

**8. Ticker uniqueness is per-creator only (lines 352–363)**

Two different creators can launch tokens with the same ticker. The uniqueness check only
prevents the *same* creator from using the same ticker twice. Users could be confused
between `0xabc…::DOGE` and `0xdef…::DOGE`, and the front-end's `find_metadata_addr`
lookup (which takes `creator_addr + ticker`) could surface the wrong one if the UI
doesn't make creator address prominent.

---

**9. On-chain metadata stubs committed to every token (lines 377–378)**

Every token is created with hardcoded icon and project URLs:
```
utf8(b"http://example.com/icon.png")
utf8(b"http://example.com")
```
These are permanent on-chain. Token metadata objects will forever carry wrong URLs.
The actual icon and description should either be passed as parameters to `create_token`
or stored off-chain, not hardcoded stubs.

---

### MEDIUM: Lower-impact issues

**10. `initialize` and `register_resource_account` have no admin check (lines 281, 291)**

Both entry functions accept any signer. `initialize` is protected by idempotency
(`if !exists<ModuleState>(module_addr)`) and the real call happens at deploy time, so
the practical risk is low — but anyone can call them and waste gas or create orphan
resources at their own address.

**11. Price impact in sell slippage guard can underflow (line 662)**

`calculate_price(tokens_sold_before - amount)` — if `tokens_sold_before < amount`,
this underflows u64. Move will abort with an arithmetic error rather than a meaningful
`E_SLIPPAGE_TOO_HIGH` code. The caller balance check at line 649 makes this unlikely in
practice, but the guard ordering should be verified.

**12. No slippage protection on graduation fees**

When a token graduates, 83 APT is paid out as fees before the graduation event is
emitted. There is no check that the resource account holds at least this amount beyond
the bonding curve proceeds. If the resource account balance is tight, graduation could
fail mid-transaction after `is_graduated = true` is set but before fees are paid.
Verify atomic reversal on abort.

---

## Part 2 — Operational / Infrastructure Security

**1. Committed private keys (URGENT — act now)**

Four valid Ed25519 private keys (`fresh_module_6.key`, `generic_dev4.key`, `new-key`,
`new-key.pem`) were committed to git history on `main`. They have been removed from
tracking on the current branch and added to `.gitignore`, but they remain permanently
recoverable from git history by anyone with repo access.

Action required:
- Identify which accounts these keys control (derived addresses: `0xf378…`, `0x4470…`,
  `0x320d…`, `0xab58…`).
- Move any funds out of those accounts immediately.
- If any of these keys hold admin or treasury roles, rotate those roles now.
- Treat all four keypairs as permanently compromised regardless of repo visibility.
- If the repo is or ever becomes public, consider a git history rewrite (BFG /
  `git filter-repo`) — coordinate with all collaborators first.

**2. Treasury address is hardcoded in the contract**

`PLATFORM_TREASURY_ADDRESS = 0xd89c…` is a compile-time constant. If that address is
ever compromised, all future fee payments go to the attacker. There is no on-chain
mechanism to rotate it without redeploying the contract.

Recommendation: Make the treasury address a mutable field in `ModuleState` with an
admin-only setter (with an appropriate timelock).

**3. Module upgrade / redeploy access**

Confirm that the module deployer's private key is stored securely (hardware wallet or
HSM). The module address `0x8c69…` controls all admin functions. If lost, admin
functions (including the treasury address rotation above) become permanently inaccessible.

**4. Aptos API keys in environment variables**

The app uses `process.env` for any API keys. Confirm these are not checked into `.env`
files in the repository (current `.gitignore` covers `.env` at root level — verify all
subdirectories).

---

## Part 3 — Legal / Regulatory (Provider Perspective)

### What we store — honest inventory

| Storage location | What's there | Who can see it |
|---|---|---|
| **Aptos blockchain** | Wallet addresses, token amounts, trade timestamps, fees paid, market cap at graduation | Anyone, permanently |
| **User's browser (`localStorage`)** | Watchlist, boost contributions (token addr + wallet + APT amount), token images, social links, token descriptions | User only (their device) |
| **Our servers (Vercel API functions)** | Nothing persisted. API functions are stateless read-through proxies to the Aptos indexer/fullnode. Wallet addresses are received as URL parameters in read-only lookups. | Not stored |
| **Server access logs** | Standard Vercel access logs may capture IP addresses and URL parameters (which include wallet addresses). Vercel's retention policy applies. | Vercel, us |

**What the current Privacy Policy says vs. reality:**
- "No cookies, no tracking pixels" — accurate.
- "On our servers: aggregated read-only caching… no personal data" — mostly accurate, but
  Vercel access logs will capture wallet addresses (passed as URL query params). This is
  not "personal data" under most frameworks but is worth disclosing explicitly.
- "No financial advice" is present in Terms — keep this.

---

### Legal / regulatory checklist

**1. Money Service Business (MSB) registration — US**

The platform collects fees (0.9% platform fee on every trade, 0.2 APT launch fee) via a
hardcoded treasury address. When operating with real APT on mainnet, this fee collection
may qualify you as a Money Service Business under FinCEN rules, requiring registration
and AML program obligations. Testnet-only operation is exempt.

Action: Before mainnet, get a legal opinion on MSB status in your operating jurisdiction.

**2. Securities law exposure**

Tokens launched on this platform could be characterized as investment contracts
(securities) under the Howey test — especially if marketed as investments or if the
Boost/leaderboard mechanics imply speculative value. As the platform provider, you could
face liability as a facilitator even if you didn't launch the tokens yourself.

Action:
- Add an explicit securities disclaimer to Terms: "Tokens launched on this platform are
  not securities. We do not facilitate securities offerings."
- Consider a content policy prohibiting tokens that promise returns or are marketed as
  investments.
- Restrict geographic access (geofence US users) or get US legal counsel before mainnet.

**3. `withdraw_apt` and custodial liability**

The admin's ability to withdraw bonding curve reserves (see contract issue #1) means you
are technically a custodian of user funds with unilateral withdrawal rights. This could
expose you to fiduciary or custodial liability if funds are ever withdrawn — even
accidentally or for operational reasons. Regulators and plaintiffs could argue you're
operating an unregistered custodial exchange.

Action: Remove or restrict `withdraw_apt` before mainnet. This also improves your legal
posture because you can truthfully state "we cannot access user funds."

**4. GDPR / data protection (EU users)**

Wallet addresses can, in some circumstances, be linked to real identities and may
qualify as personal data under GDPR. If EU residents use the platform:
- Vercel access logs capturing wallet addresses in URL parameters may constitute
  personal data processing.
- You may need a Data Processing Agreement with Vercel and a GDPR-compliant privacy
  notice naming a Data Controller.

Action: Either geofence EU users or add a GDPR-specific disclosure and appoint a
data controller.

**5. Intellectual property / content liability**

Token creators can upload any name, symbol, and description. Nothing prevents:
- Trademark impersonation (e.g., "APPLE" ticker with an Apple logo)
- Impersonation of real people
- Pump-and-dump marketing copy

The Terms have a "prohibited use" clause covering this, but terms alone are not a
defense without enforcement mechanisms.

Action: Consider a DMCA takedown process and/or a reporting mechanism. At minimum,
document your notice-and-takedown procedure.

**6. Terms of use — gaps to fill before mainnet**

Current Terms cover: testnet-only, no financial advice, use at your own risk, prohibited
use, liability cap.

Missing before mainnet:
- Governing law and jurisdiction
- Dispute resolution / arbitration clause
- Age restriction (18+)
- Explicit securities disclaimer
- Geographic restrictions (or a statement about which jurisdictions are excluded)
- What happens to user funds if the project shuts down (especially post-graduation
  locked liquidity)

---

## Summary — Priority order

| Priority | Item |
|---|---|
| **Immediate (before any real value)** | Rotate the four compromised private keys |
| **Before mainnet deployment** | Fix or remove `withdraw_apt` backdoor |
| **Before mainnet deployment** | Fix `migrate_to_dex` broken flow (items 3 + 4 above) |
| **Before mainnet deployment** | Verify and unify price formula (item 2 above) |
| **Before mainnet deployment** | Implement creator token claim function |
| **Before mainnet deployment** | Remove all DebugEvent emissions |
| **Before mainnet deployment** | Fix `internal_swap` self-transfer bug |
| **Before mainnet deployment** | Get legal opinion on MSB/securities status |
| **Before mainnet deployment** | Update Terms with governing law, arbitration, 18+, securities disclaimer |
| **Before mainnet deployment** | Consider GDPR disclosure or EU geofence |
| **Before audit engagement** | Consolidate price formula into one implementation |
| **Before audit engagement** | Fix or remove `initialize` / `register_resource_account` access control gaps |
| **Before audit engagement** | Fix graduation fee accounting (`state.apt_amount`) |
| **Before audit engagement** | Make treasury address mutable (not compile-time constant) |
| **Good to have** | Fix ticker global uniqueness |
| **Good to have** | Pass real icon/project URL to `create_token` instead of stubs |
