# MoveMint — Path to Mainnet Launch

This is the execution plan that ties together the three workstreams: the **audit checklist**
(`AUDIT_CHECKLIST.md`), the **graduation fix**, and the broader **contract changes**. It
sequences everything from "where we are now" (polished testnet prototype) to "live on
mainnet with real APT."

Read `AUDIT_CHECKLIST.md` for the detailed per-issue breakdown; this document is the
ordering, dependencies, and decision gates.

---

## ⚠️ The contract must be correct before mainnet — there is no undo

Unlike a web app, a smart contract deployed to mainnet cannot be patched like pushing a hotfix. Changing it requires publishing a new version of the code to the same address (an "upgrade"), which works fine if you planned for it — but every change to live code carries risk, requires the upgrade key, and must not break the compatibility rules. A mistake that locks funds, or a bug that drains the vault, cannot be reversed. User funds can be permanently lost.

**What this means in practice:**

- Do not deploy to mainnet until Phases 1–5 are complete and the external audit (Phase 4) has returned a clean result. The audit exists precisely to catch what we miss.
- Every contract change gets compiled, unit-tested, and end-to-end tested on a fresh testnet deploy before it is considered done (Phase 3).
- The upgrade/deploy key must be held on a hardware wallet or multisig before mainnet — if that key is lost or compromised, the ability to push any future fix is gone.
- "Ship it and fix it later" is not an option when "later" means a published upgrade to a live system that holds real user funds.

This is why the plan exists and why the sequence matters.

---

## Decisions

### Locked ✅

| Decision | Resolution |
|---|---|
| **DEX model** | **External DEX (Option A).** Delete the homegrown AMM (`create_liquidity_pool`, `internal_swap`, `dex_pools`, etc.) entirely. |
| **Graduation trigger** | **In-contract atomic (B1).** The threshold-crossing `buy_tokens` call seeds the DEX pool and locks LP in one transaction. No off-chain keeper, no client-side migration. |

### Open ⬜

**Treasury/admin custody** — Decide before Phase 1a engineering starts. Affects how
`withdraw_apt` is gated and who can rotate the treasury address. Recommended: 2-of-3
multisig on a hardware wallet.

**Where token images are hosted** — ✅ **Decided: Vercel Blob** (free on Hobby plan).
`api/upload.js` implemented. Add `BLOB_READ_WRITE_TOKEN` in Vercel dashboard to activate.

**Boost APT destination** (treasury / creator-split / burn) — Deferred. Not needed
until the Boost release (Phase 7). Decide then.

---

## Phase 0 — Do now, no dependencies

- [ ] **Rotate the 4 leaked private keys.** Addresses derived from `fresh_module_6.key`,
      `generic_dev4.key`, `new-key`, `new-key.pem` (`0xf378…`, `0x4470…`, `0x320d…`,
      `0xab58…`) are permanently compromised. Move any funds, rotate any admin/treasury
      roles, treat the keypairs as burned regardless of repo visibility.
- [ ] Confirm no `.env` files or secrets are tracked anywhere in the repo or its history.
- [ ] Stand up the chosen treasury/admin custody (multisig / hardware wallet) so Phase 1
      contract changes can hard-code the right custody model.

---

## Phase 1 — Contract changes (the engineering core)

The contract design must be **frozen** at the end of this phase so legal and audit can
begin. All items are from `AUDIT_CHECKLIST.md` Part 1.

**1a. Custody & safety** *(also unblocks the legal posture)*
- [x] Remove `withdraw_apt` entirely — no one, including the admin, can manually pull
      APT from the vault. The only way funds leave is through coded sell/graduation paths.
- [x] Make `PLATFORM_TREASURY_ADDRESS` a mutable `ModuleState` field (`treasury_address`)
      initialized to the existing constant. Add `set_treasury_address(admin, new_addr)`
      entry function (admin-only). All four fee-transfer sites now read from
      `state.treasury_address` at runtime.
      *Note: no timelock on the setter yet — flagged as optional hardening before mainnet.*
- [x] Add admin checks to `initialize` and `register_resource_account`.
      *(All three items coded on branch; pending compile + testnet verification.)*
- [ ] **Timelock on `set_treasury_address` (hardening, before mainnet).** Right now an
      admin can change the fee destination instantly. A timelock makes it a two-step
      change with a delay (e.g. propose now, execute after 48h), so if the admin key is
      ever stolen there's a window to notice and react before fees get redirected. Only
      affects fee routing, not user funds — so it's hardening, not a blocker. Do it during
      the pre-mainnet hardening pass.

**1b. Correctness**
- [x] Unify the bonding-curve price formula into one shared function. Replaced the
      divergent `calculate_price` with `unit_price` using module-level constants so
      the slippage guard and the cost calc use identical math.
- [x] Fix graduation fee accounting so `state.apt_amount` is decremented by the 83 APT
      paid out at graduation.
- [x] Implement `claim_creator_tokens(creator, ticker)` so the 20M creator allocation
      isn't stranded. Added `creator_tokens_claimed: bool` flag to `TokenVault`.
      *(All three items coded on branch; pending compile + testnet verification.)*

**1c. Cleanup / scope reduction**
- [x] Delete `create_liquidity_pool`, `internal_swap`, `swap_token_a_for_token_b`,
      `swap_token_b_for_token_a`, `LiquidityPool`, `DexPool`, `dex_pools`,
      `migrate_to_dex` — the full homegrown AMM. (~278 lines removed; graduation will
      go to Hyperion externally per the locked DEX decision.)
- [x] Remove all `DebugEvent` / `DebugState` emissions. (~23 lines removed.)
- [x] Ticker uniqueness — **decided: pump.fun-style, no global enforcement.** Different
      creators can use the same ticker symbol. Token page already shows contract address
      and creator address for disambiguation. No contract change needed.
- [ ] **No boost contract work in this phase.** `boost_token` is deferred to Phase 7.

**1d. Real image upload** *(decided: Vercel Blob — free on Hobby plan)*
- [x] Off-chain: `api/upload.js` — Vercel serverless function; receives base64 image,
      calls `@vercel/blob` `put()`, returns public URL. **User must add
      `BLOB_READ_WRITE_TOKEN` env var in Vercel dashboard (Storage → Blob → Connect).**
- [x] On-chain: `icon_uri: vector<u8>` added to `create_token` and `initialize_vault`;
      stored in fungible asset metadata instead of `example.com` stub.
- [x] Frontend: `NEWLaunch.tsx` uploads image before the wallet tx, passes the Vercel
      Blob URL as `icon_uri`; `useTokenData.ts` already reads on-chain `icon_uri` first
      and falls back to localStorage for pre-upgrade tokens.
      **Requires contract redeploy to testnet before images go live.**

---

## Phase 1F — Frontend launch scope (hide Boost)

Boost today is a non-functional localStorage prototype. It must not ship visible at
launch. Keep all the code (it's the Phase 7 second-wave feature) — just gate it.

- [x] Add one feature flag: `BOOST_ENABLED = false` in `src/featureFlags.ts`
      (env-driven via `VITE_FEATURE_BOOST` so it can flip without a redeploy).
- [x] Gate every Boost surface behind the flag:
  - Nav link — `src/components/LeftSidebar.tsx`
  - Route — `src/App.tsx` (`/boost` redirects to home when flag is off)
  - `src/components/BoostBar.tsx` (gated in `AppHeader.tsx` — not rendered when off)
  - Boost CTAs/cards in `src/components/HomePage.tsx`, `Marketplace.tsx`,
    `NEWtokenpage.tsx`
  - Boost copy/links in `src/components/SiteFooter.tsx`, `About.tsx`; mobile nav in
    `AppHeader.tsx`
- [x] Grep the full tree for `boost` (case-insensitive) — confirmed nothing leaks through.
- [ ] Verify the `/boost` URL returns a clean redirect (not a broken page) when off.

---

## Phase 2 — Graduation, end to end

Depends on Phase 1 and the two locked decisions.

- [ ] Build the atomic graduation block inside `buy_tokens`: when `total_apt_spent`
      crosses 1283 APT, call the chosen DEX's pool-creation entry function, deposit the
      200M reserve tokens + raised APT, receive and lock the LP, mint creator allocation
      to a claimable store, emit graduation event. Revert the entire buy if any step
      fails.
- [ ] Delete the client-side graduation layer: `src/utils/graduation.ts`,
      `src/hooks/useGraduation.ts`, `src/hooks/useGraduationRetry.ts`,
      `src/utils/graduationStorage.ts`, `src/components/GraduationListener.tsx`.
- [ ] Frontend: graduation progress bar already works (`NEWtokenpage.tsx:1679`); wire
      the "graduated → trade on DEX" hand-off so a graduated token routes trades to the
      DEX pool URL.

---

## Phase 3 — Testing & internal verification

Depends on Phases 1–2.

- [ ] Move unit tests covering: price formula equivalence, fee math (buy & sell, pre/post
      graduation), slippage enforcement at boundaries, graduation accounting, creator
      claim, admin gating, treasury rotation.
- [ ] Full testnet end-to-end on a fresh deploy: launch → buy up to graduation →
      migration → trade on DEX → creator claims tokens. Verify invariants (no APT
      created/destroyed, supply conserved at 1B).
- [ ] Adversarial passes: non-admin calls to admin functions, slippage exceed, double-
      graduate, drain attempts.
- [ ] Confirm Boost is fully hidden with `BOOST_ENABLED=false` — no dead links, no
      `/boost` access, no BoostBar visible.

---

## Phase 4 — External security audit

Depends on Phase 3. Don't pay an auditor to review broken or unfrozen code.

- [ ] Engage a reputable Move/Aptos auditor (e.g. OtterSec, Zellic, MoveBit). Hand them
      `AUDIT_CHECKLIST.md` as the scope/known-issues doc.
- [ ] Boost contract (`boost_token`) is **out of scope** here — it gets its own focused
      audit before the Phase 7 release.
- [ ] Budget: typically several weeks lead time + meaningful cost; plan for a fix-and-
      re-review cycle.
- [ ] Remediate all findings; get a clean re-review before mainnet deploy.

---

## Phase 5 — Legal & compliance

Can start once the contract design is frozen (end of Phase 1). Runs in parallel with
Phases 3–4.

- [ ] **Money-transmitter opinion** from a Wisconsin-licensed fintech/crypto attorney.
      Goal: written opinion that, post-`withdraw_apt` removal, you are non-custodial and
      not a money transmitter federally (FinCEN) or under WI Act 267.
- [ ] **Securities analysis** — Howey test review. The Boost pay-to-win/champion mechanic
      is **excluded** from launch scope so it doesn't need to be resolved now, but flag
      it with counsel as a coming feature so they can advise on design constraints ahead
      of Phase 7.
- [ ] **Terms of Use** additions: governing law & jurisdiction, arbitration clause, 18+
      restriction, explicit securities disclaimer, geographic exclusions, what happens to
      funds if the project winds down.
- [ ] **Privacy Policy** update: disclose that Vercel access logs may capture wallet
      addresses in URL params; GDPR decision (geofence EU or add controller disclosure).
- [ ] Track Wisconsin AB 471 / SB 386 (the software/non-custodial exemption bill).

---

## Phase 6 — Mainnet launch (Boost OFF)

Depends on Phases 4 & 5 both clearing.

- [ ] Deploy audited contract to mainnet; admin/treasury on multisig (custody Decision).
- [ ] Switch all endpoints to mainnet. Launch with `VITE_FEATURE_BOOST=false`.
- [ ] Add Vercel KV shared cache, Sentry monitoring, `/api/*` rate limiting.
- [ ] Final dry run on testnet using a mainnet-mirroring config.
- [ ] Publish updated Terms/Privacy before the first real transaction.
- [ ] Launch.

---

## Phase 7 — Boost release (post-launch second wave)

Self-contained. Schedule whenever you want the marketing moment.

- [ ] **Decide** where boost APT goes (treasury / creator-split / burn). This affects the
      MSB/money-transmitter analysis, since treasury-bound boost APT is platform revenue
      like the 0.9% trade fee.
- [ ] **Contract:** add `boost_token(buyer, token_metadata, amount)` entry function —
      transfers APT per the decision above, emits `BoostEvent { token, wallet, amount,
      timestamp }`. No on-chain ranking/window state needed; the rolling window is
      applied client-side from indexed events.
- [ ] Get the boost contract function audited (small, focused scope — can be done by the
      same auditor as a change-order).
- [ ] **Legal:** get securities sign-off on the pay-to-win "champion" mechanic before
      going live.
- [ ] **Frontend rewire:** `handleBoost` → real `signAndSubmitTransaction` calling
      `boost_token`; replace `getBoostMap` with an indexer query over `BoostEvent`s
      with the rolling 1h/6h/24h/7d window applied client-side; drop the `localStorage`
      store entirely.
- [ ] Flip `VITE_FEATURE_BOOST=true`. Run the reveal as a marketing moment.

---

## Critical path at a glance

```
Phase 0 (keys, custody)           ── now, parallel
Decisions: treasury custody        ── now, blocking Phase 1a
           boost APT dest.         ── deferred to Phase 7
        │
Phase 1 (contract changes)        ── freeze design at end ──┐
Phase 1F (hide Boost)             ── parallel with Phase 1  │
        │                                                    │
Phase 2 (graduation)                                         ├─► Phase 5 (legal) starts here
        │                                                    │
Phase 3 (testing)                                            │
        │                                                    │
Phase 4 (external audit) ◄──────────────────────────────────┘
        │
Phase 6 (mainnet launch — Boost OFF)
        │
Phase 7 (Boost release — second wave)
```

**The gating insight:** almost everything funnels through Phase 1. The `withdraw_apt`
removal in Phase 1a simultaneously closes the worst security hole, fixes the legal
posture, and is a prerequisite for the attorney's non-custodial opinion. Start there.
