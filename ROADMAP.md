# Token Launcher — Architecture Roadmap

## Data Architecture Principle

All chain data is available for free via two sources:
- **Standard Aptos Indexer** (`api.testnet/mainnet.aptoslabs.com/v1/graphql`) — indexed
  tables for account transactions, fungible asset activities, etc. Unauthenticated
  requests use a public pool with no monthly credit cap.
- **Aptos Fullnode** (`fullnode.testnet/mainnet.aptoslabs.com`) — raw transaction and
  resource data. No API key required, no rate cap for normal usage.

These two sources together can answer every question the app needs to ask:
- Which tokens were created? → `account_transactions` for module address + fullnode events
- What trades happened for a token? → `account_transactions` for token address + fullnode events
- What is the current price/supply? → fullnode resource read

**Geomi (Aptos NoCode Indexer) is not required at any stage.** Geomi is a convenience
product that pre-indexes custom events into typed tables. It costs ~$10/month in
Transaction Stream fees just to keep the processor running — before any queries.
For a project without revenue, that fixed cost is not worth it. The standard
indexer + fullnode pattern achieves identical results for free.

---

## Prototype (now → testnet demo, ~dozen users)

**Goal:** Working demo on testnet. No revenue, no SLA, just showing it works.

**Architecture:**
- Frontend: Create React App → Vercel static hosting
- API: Vercel serverless functions (`/api/*`) with in-memory caching
- All data: Standard Aptos indexer (unauthenticated) + Aptos fullnode
- No Geomi. No paid services. No database.

**Data flow:**
```
Browser → Vercel /api/* → Standard Indexer (account_transactions)
                        → Fullnode (by_version, resource reads)
```

**Cache TTLs:**
- Token catalog: 5 min (tokens are rarely created)
- Trade history: 60s (chart/transactions tab)
- Live vault state: 5s (price, bonding curve — fullnode reads are cheap)

**Cost:** $0/month (Vercel hobby tier is free for low traffic)

**Limitation:** Vercel serverless functions don't share in-memory state between
instances. Under concurrent load, multiple cold instances can each make indexer
calls before any cache warms. Acceptable for a demo; fix in Stage 1.

---

## Stage 1 — MVP Production (mainnet, ~100-500 users)

**Goal:** Real users, real APT. Reliability matters. Still no ops burden.

**Changes from Prototype:**
- Deploy contract to **mainnet**, switch all endpoints to mainnet URLs
- **Vercel KV** (managed Redis, ~$0-20/month) — shared cache across all
  serverless instances. Eliminates the cold-instance stampede problem.
  One warm cache entry serves all concurrent users for a given token.
- Basic error monitoring: Sentry free tier
- Rate limiting on `/api/*`: Vercel middleware or Upstash Ratelimit (free tier)
- Separate env vars for mainnet vs testnet (staging vs production)

**Cost:** ~$0-30/month (Vercel hobby/pro + Vercel KV starter)

**Still no Geomi, no database, no self-hosted infrastructure.**

---

## Stage 2 — Scale (mainnet, ~1k-10k users)

**Goal:** Real-time UX, own your data, predictable performance at scale.

**Key change:** Replace the indexer + fullnode fan-out pattern with a
**self-hosted Aptos Indexer SDK processor** writing to your own Postgres.

This is what Geomi does internally — but you own it, it's free to run, and
you control the schema and query performance.

**Architecture:**
- **Aptos Indexer SDK** (TypeScript) — custom processor subscribes to
  transaction stream, extracts `TokenCreatedEvent`, `TokenPurchaseEvent`,
  `TokenSaleEvent`, writes to Postgres
- **Postgres** (Supabase free → paid, or Neon, or Railway) — your event tables
  with proper indexes on `metadata_addr`, `transaction_version`, `timestamp`
- **API layer** queries Postgres directly — single fast query, no fullnode fan-out
- **WebSocket server** — push trade updates to connected clients instead of
  polling. Chart and transactions tab update in real-time.
- Drop the `useTokenTrades` polling pattern entirely; replace with subscriptions.

**Reference implementation:** [emojicoin-dot-fun](https://github.com/econia-labs/emojicoin-dot-fun)

**Cost:** ~$50-150/month fixed (Postgres + indexer VM + Redis). No per-query cost,
no monthly credit cap, scales to any traffic level.

**Why this beats Geomi at this stage:**
- Geomi Transaction Stream: ~$10-50/month fixed + per-query costs
- Self-hosted: ~$10-30/month for a small VM, own the data, no vendor dependency

---

## Stage 3 — Full Production (10k+ users)

**Goal:** Own every layer. No external data dependencies on critical path.

**Additional changes from Stage 2:**
- **Own Aptos fullnode** — eliminates dependency on Aptos Labs fullnode for
  vault reads. Also reduces indexer lag (processor reads from local node).
- **Multi-region Postgres** read replicas for low-latency global reads
- **CDN** (Cloudflare) for API response caching at the edge
- **Monitoring** — Grafana + Prometheus for indexer lag, query p95, sync status
- **Kubernetes** or similar for API layer auto-scaling
- **Graduation DEX integration** — Liquidswap/Econia LP management (significant
  additional smart contract + backend work)

**Cost:** $500-2000+/month. Justified only with real traction and revenue.

---

## Summary

```
Prototype  →  $0/month   — Vercel + standard indexer + fullnode
Stage 1    →  $0-30/mo   — add Vercel KV shared cache, deploy mainnet
Stage 2    →  $50-150/mo — self-hosted indexer SDK + Postgres + WebSockets
Stage 3    →  $500+/mo   — own fullnode, multi-region, full observability
```

**Geomi is not in any stage.** It costs ~$10/month in Transaction Stream fees
before any queries, provides no advantage over the standard indexer + fullnode
pattern for low-to-medium traffic, and introduces a vendor dependency with a
monthly credit cliff. The self-hosted indexer SDK at Stage 2 is the correct
upgrade path — you build what Geomi does, own it, and pay only for compute.
