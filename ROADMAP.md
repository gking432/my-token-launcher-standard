# Token Launcher — Architecture Roadmap

## Current Status

Tokens load on the homepage (catalog working). Chart/trades/24h volume require
Geomi, which is blocked until the monthly credit cap resets (June 1) or a new
Aptos Labs account is used.

---

## Prototype (now → ~12 users, testnet demo)

**Goal:** Show a working demo. Not production. Not mainnet.

**Architecture:**
- Frontend: Create React App → Vercel static hosting
- API: Vercel serverless functions (`/api/*`)
- Token catalog: Standard Aptos indexer `account_transactions` (unauthenticated,
  no credit cap) + fullnode `by_version` for event data
- Trade history / chart: Geomi NoCode Indexer (Aptos Labs managed, free tier)
- Live vault state: Aptos fullnode directly (no API key needed)

**To unblock Geomi right now:**
1. Create a new Aptos Labs account at [aptoslabs.com](https://aptoslabs.com)
2. Generate a new API key
3. Update `REACT_APP_GEOMI_API_KEY` in Vercel environment variables
4. Redeploy — fresh monthly free-tier credits, no code changes needed

**Credit budget with current caching:**
- `/api/trades/{addr}`: server cache 60s, client polls 60s → 1 Geomi call/min per token
- `/api/purchases` (homepage 24h volume): server cache 30s → 2 calls/min flat
- Catalog: zero Geomi calls (fully migrated to standard indexer)
- 10 tokens × 1 call/min = ~432,000 Geomi calls/month for a constantly-open app
- For a real demo with 12 occasional users: well within free tier

**What's NOT done here:** real-time updates, WebSockets, production monitoring,
shared cache across serverless instances, mainnet.

---

## Stage 1 — MVP Production (mainnet, ~100-500 users)

**Goal:** Real users, real money (mainnet APT). Reliability matters.

**Changes from Prototype:**
- Deploy contract to **mainnet**
- Switch all API endpoints to mainnet fullnode + mainnet indexer
- **Vercel KV (Redis)** for shared cache across serverless instances — prevents
  cold-instance cache stampedes where 10 concurrent requests all hit Geomi before
  any cache warms
- **Paid Geomi tier** — pay per usage, no monthly cap cliff
- Separate API keys: one for Geomi, one for standard indexer (currently shared,
  causes one exhausted key to break both)
- Basic error monitoring (Sentry free tier)
- Rate limiting on `/api/*` endpoints (Vercel middleware or upstash ratelimit)

**Cost estimate:** ~$50-150/month (Vercel Pro + Geomi usage + Vercel KV)

**Limitation still present:** Geomi is a third-party dependency. If Aptos Labs
changes their NoCode Indexer pricing or sunsets it, everything breaks.

---

## Stage 2 — Scale (mainnet, ~1k-10k users, own your stack)

**Goal:** Remove third-party indexer dependency. Predictable costs. Real-time UX.

**Key change:** Replace Geomi with a self-hosted **Aptos Indexer SDK processor**.

**Architecture:**
- **Aptos Indexer SDK** (TypeScript or Rust) — custom processor that reads
  `TokenCreatedEvent`, `TokenPurchaseEvent`, `TokenSaleEvent` from the chain and
  writes them to your own Postgres
- **Postgres** (Supabase, Neon, or AWS RDS) with proper indexes on
  `metadata_addr`, `timestamp`, `transaction_version`
- **Hasura** in front of Postgres — instant GraphQL API from your schema, no
  custom resolver code
- **Redis** (Upstash or Railway) for hot-path caching (top tokens, recent trades)
- **WebSocket server** — push price updates to connected clients instead of
  polling every 60s. Chart updates in real-time.
- Replace polling architecture (`useTokenTrades`, `useTokenList`) with
  subscriptions or WebSocket listeners

**Indexer SDK reference:** [emojicoin-dot-fun](https://github.com/econia-labs/emojicoin-dot-fun)
has a full open-source reference implementation on Aptos.

**Cost estimate:** ~$100-200/month fixed (Postgres + Redis + indexer VM), no
per-query cost.

**Why this is better at scale:** Stage 1 costs scale linearly with users
(each query = money). Stage 2 has fixed infrastructure cost regardless of
query volume.

---

## Stage 3 — Full Production (10k+ users, emojicoin-level)

**Goal:** Own every layer of the stack. Sub-second latency. No external
dependencies for core data paths.

**Additional changes from Stage 2:**
- **Run your own Aptos fullnode** — eliminates dependency on
  `fullnode.testnet/mainnet.aptoslabs.com`. Also reduces indexer lag since your
  processor reads directly from your local node.
- **Multi-region deployment** — replicate Postgres read replicas, run indexer
  processors in multiple regions
- **CDN caching** (Cloudflare) for API responses and static assets
- **Monitoring stack** — Grafana + Prometheus for indexer lag, query p95,
  fullnode sync status
- **Kubernetes** (or similar) for auto-scaling the API layer
- **Graduation flow** — DEX integration (Liquidswap/Econia), LP position
  management — requires significant additional smart contract work

**Cost estimate:** $500-2000+/month depending on infrastructure provider and
traffic. Justified only with real traction and revenue.

---

## Decision Tree

```
Are you showing a demo?
  → Prototype: new Aptos Labs account + existing Vercel setup

Do you have real mainnet users?
  → Stage 1: Vercel KV + paid Geomi + Sentry

Do you have 1k+ users or need real-time UX?
  → Stage 2: self-hosted indexer + Postgres + WebSockets

Are you building a serious DeFi product with 10k+ users?
  → Stage 3: own your fullnode, own every layer
```
