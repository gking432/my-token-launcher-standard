# MoveMint — Path to Mainnet Launch

This is the execution plan that ties together the three workstreams we've discussed:
the **audit checklist** (`AUDIT_CHECKLIST.md`), the **graduation fix**, and the broader
**contract changes**. It sequences everything from "where we are now" (polished testnet
prototype) to "live on mainnet with real APT."

Read `AUDIT_CHECKLIST.md` for the detailed per-issue breakdown; this document is the
ordering, dependencies, and decision gates.

---

## Decisions needed before engineering starts

These shape the whole plan. Resolve these first.

### Decision 1 — Which DEX model? (BLOCKING)

The codebase currently contains **two contradictory designs** for what happens after a
token graduates:

| Option | What it is | In the code | Trade-off |
|---|---|---|---|
| **A. External DEX** (recommended) | At graduation, seed a pool on an established Aptos DEX (Hyperion, Liquidswap, Econia) and lock the LP | `src/utils/graduation.ts`, `src/hooks/useGraduation.ts` (Hyperion, currently mock) | Battle-tested AMM, far smaller audit surface, real liquidity/routing. Dependency on a third-party DEX + its SDK. |
| **B. In-contract AMM** | Keep the homegrown constant-product AMM inside `token_launcher.move` | `create_liquidity_pool`, `internal_swap`, `dex_pools`, `migrate_to_dex` | No external dependency, but you now own and must audit a full AMM. `internal_swap` is currently buggy (self-transfer). Large audit + maintenance burden. |

**Recommendation: Option A (external DEX).** Maintaining your own AMM is a massive
security liability for no benefit — real launchpads (pump.fun, etc.) migrate to an
established DEX. Choosing A lets us *delete* the homegrown AMM code entirely, shrinking
the contract and the audit scope.

The rest of this plan assumes Option A. If you pick B, Phase 2 changes substantially.

### Decision 2 — Who triggers graduation execution?

Today `GraduationListener.tsx` runs in a random visitor's browser and asks *them* to sign
the migration transaction. That's broken. Pick one:
- **B1. Fully in-contract** — graduation does the migration atomically inside `buy_tokens`
  (the buy that crosses the threshold pays for and executes the pool seeding). Cleanest,
  no off-chain trust, but the threshold-crossing buyer pays the gas.
- **B2. Trusted keeper** — a small backend service holds a dedicated keyed wallet, watches
  for graduation events, and executes the migration. More moving parts, ongoing ops.

**Recommendation: B1 (in-contract atomic migration)** if the chosen DEX exposes an
on-chain entry function for pool creation; otherwise **B2**.

### Decision 3 — Mainnet treasury & admin custody

Decide now whether the platform treasury and module admin will live on a hardware wallet
or a multisig (recommended: multisig). This affects the contract changes in Phase 1
(mutable treasury address, admin gating).

---

## Phase 0 — Immediate, do this week (no dependencies)

These don't block anything and shouldn't wait.

- [ ] **Rotate the 4 leaked private keys.** Identify what `0xf378…`, `0x4470…`,
      `0x320d…`, `0xab58…` control, move any funds out, rotate any roles. Treat as
      permanently compromised. (Audit checklist Part 2 #1.)
- [ ] Confirm no `.env` secrets are tracked anywhere in the repo or its history.
- [ ] Stand up the mainnet treasury/admin custody chosen in Decision 3 (get the
      multisig/hardware wallet ready; don't deploy with a hot key).

---

## Phase 1 — Contract changes (the engineering core)

All items from `AUDIT_CHECKLIST.md` Part 1, ordered. This is the critical path; the
contract design must be **frozen** at the end of this phase so legal and audit can begin.

**1a. Custody & safety (also unblocks the legal posture):**
- [ ] Remove `withdraw_apt`, or restrict it so it can never touch live bonding-curve
      reserves (Decision 3 multisig + a strict cap on graduated-pool proceeds only).
      *This is the single highest-leverage change — security AND the money-transmitter
      argument both hinge on it.*
- [ ] Make `PLATFORM_TREASURY_ADDRESS` a mutable `ModuleState` field with an admin-only
      setter (timelocked).
- [ ] Add admin checks to `initialize` and `register_resource_account`.

**1b. Correctness:**
- [ ] Unify the bonding-curve price formula into one shared function. Delete the
      divergent `calculate_price` (line 274) and have the slippage guard and the cost
      calc use the *same* math. Add a test asserting they agree.
- [ ] Fix graduation fee accounting so `state.apt_amount` is decremented by the 83 APT
      paid out at graduation.
- [ ] Implement `claim_creator_tokens(creator, ticker)` so the 20M creator allocation
      isn't stranded.

**1c. Cleanup / scope reduction:**
- [ ] Remove all `DebugEvent` / `DebugState` emissions.
- [ ] If Decision 1 = A: **delete** `create_liquidity_pool`, `internal_swap`,
      `swap_token_a_for_token_b`, `swap_token_b_for_token_a`, `dex_pools`, and the
      homegrown `LiquidityPool` machinery. If Decision 1 = B: fix the `internal_swap`
      self-transfer bug instead.
- [ ] Pass real icon/project URL into `create_token` instead of the `example.com` stubs.
- [ ] Enforce global ticker uniqueness (or make creator address unmistakable in the UI).

---

## Phase 2 — Graduation, end to end

Depends on Phase 1 and Decisions 1 & 2.

- [ ] Rebuild the graduation execution per Decision 2 (B1 in-contract, or B2 keeper).
- [ ] If Option A + B1: write the on-chain migration that, on the threshold-crossing
      buy, seeds the chosen DEX pool with the 200M reserve + raised APT and locks/burns
      the LP. Make it atomic (revert the whole graduation if pool seeding fails).
- [ ] If keeping any client-side path: replace the mock pieces in `graduation.ts`
      (`getPositionInfoFromPool`, `calculateGraduationPrice`, `lockLPTokens`,
      `getTokenMetadata`) with real DEX SDK calls + real event parsing. Use the unified
      curve price from Phase 1, not the `aptSpent/tokensSold` placeholder.
- [ ] Delete the random-visitor trigger in `GraduationListener.tsx`.
- [ ] Frontend: graduation progress bar already works (`NEWtokenpage.tsx:1679`); wire the
      "graduated → trade on DEX" hand-off so a graduated token routes trades to the pool.

---

## Phase 3 — Testing & internal verification

Depends on Phases 1–2.

- [ ] Move unit tests covering: price formula equivalence, fee math (buy & sell, pre/post
      graduation), slippage enforcement at boundaries, graduation accounting, creator
      claim, admin gating, treasury rotation.
- [ ] Full testnet end-to-end on a fresh deploy: launch → buy up to graduation →
      migration → trade on DEX → creator claims tokens. Verify invariants (no APT
      created/destroyed, supply conserved at 1B).
- [ ] Adversarial passes: try to call admin functions as non-admin, try to exceed
      slippage, try to graduate twice, try to drain reserves.

---

## Phase 4 — External security audit

Depends on Phase 3 (don't pay an auditor to review broken/unfrozen code).

- [ ] Engage a reputable Move/Aptos auditor (e.g. OtterSec, Zellic, MoveBit). Hand them
      `AUDIT_CHECKLIST.md` as the scope/known-issues doc.
- [ ] Budget: typically several weeks lead time + meaningful cost; plan for a fix-and-
      re-review cycle.
- [ ] Remediate all findings; get a clean re-review before mainnet deploy.

---

## Phase 5 — Legal & compliance (can start once contract design is frozen, end of Phase 1)

Runs in parallel with Phases 3–4.

- [ ] **Money-transmitter opinion** from a Wisconsin-licensed fintech/crypto attorney.
      The goal: a written opinion that, post-`withdraw_apt` removal, you are
      *non-custodial* and not a money transmitter federally (FinCEN) or under WI Act 267.
      (See `AUDIT_CHECKLIST.md` Part 3 and the regulatory analysis.)
- [ ] **Securities analysis** — separate from the above. Have counsel review whether the
      tokens (and the Boost/leaderboard framing) create securities exposure; adjust
      marketing/mechanics accordingly.
- [ ] **Terms of Use** additions: governing law & jurisdiction, arbitration clause, 18+
      restriction, explicit securities disclaimer, geographic exclusions, what happens to
      funds if the project winds down.
- [ ] **Privacy Policy** update: disclose that Vercel access logs may capture wallet
      addresses in URL params; GDPR decision (geofence EU or add controller disclosure).
- [ ] Track Wisconsin AB 471 / SB 386 (the software/non-custodial exemption bill); if it
      passes it further strengthens your position.

---

## Phase 6 — Mainnet launch

Depends on Phases 4 & 5 both clearing.

- [ ] Deploy audited contract to mainnet; admin/treasury on multisig (Decision 3).
- [ ] Switch all endpoints to mainnet (per `ROADMAP.md` Stage 1).
- [ ] Add Vercel KV shared cache, Sentry monitoring, `/api/*` rate limiting.
- [ ] Final dry run on testnet using a mainnet-mirroring config.
- [ ] Publish updated Terms/Privacy before the first real transaction.
- [ ] Launch.

---

## Critical path at a glance

```
Phase 0 (keys, custody)        ── now, parallel
Decisions 1–3                  ── now, blocking
        │
Phase 1 (contract changes)     ── freeze design at end ──┐
        │                                                │
Phase 2 (graduation)                                     ├─► Phase 5 (legal) starts here
        │                                                │
Phase 3 (testing)                                        │
        │                                                │
Phase 4 (external audit) ◄───────────────────────────────┘
        │
Phase 6 (mainnet launch)
```

**The gating insight:** almost everything funnels through Phase 1. The `withdraw_apt`
removal in Phase 1a simultaneously closes the worst security hole, fixes the legal
posture, and is a prerequisite for the attorney's non-custodial opinion. Start there.
