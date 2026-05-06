// Vercel serverless function — proxies Aptos indexer event queries server-side
// so the browser never needs a CORS-allowlisted API key.
//
// Required env var (server-side only, no REACT_APP_ prefix):
//   APTOS_API_KEY  — any valid Aptos Labs standard-indexer key
//
// Falls back to REACT_APP_GEOMI_API_KEY if present (may or may not work
// for the standard indexer depending on how that key is configured).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const INDEXER = "https://api.testnet.aptoslabs.com/v1/graphql";
const MODULE  = "0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d";
const API_KEY = process.env.APTOS_API_KEY || process.env.REACT_APP_GEOMI_API_KEY || "";

const QUERY = `
  query GetModuleEvents($type: String!, $limit: Int!) {
    events(
      where: { indexed_type: { _eq: $type } }
      order_by: { transaction_version: desc }
      limit: $limit
    ) {
      data
      transaction_version
      event_index
    }
  }
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { type, addr } = req.query;
  if (type !== "purchase" && type !== "sale") {
    return res.status(400).json({ error: "type must be purchase or sale" });
  }

  const eventType = `${MODULE}::token_launcher::Token${type === "purchase" ? "Purchase" : "Sale"}Event`;
  const limit = Math.min(parseInt((req.query.limit as string) || "1000", 10), 1000);

  try {
    const upstream = await fetch(INDEXER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
      },
      body: JSON.stringify({ query: QUERY, variables: { type: eventType, limit } }),
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      return res.status(upstream.status).json({ error: `Upstream: ${upstream.status} ${body}` });
    }

    const result = await upstream.json();
    if (result.errors) return res.status(500).json({ error: result.errors });

    let events: any[] = (result.data?.events || []).map((e: any) => ({
      ...e.data,
      event_index: e.event_index,
      transaction_version: e.transaction_version,
    }));

    if (addr) {
      const addrLower = (addr as string).toLowerCase();
      events = events.filter((e: any) => (e.metadata_addr || "").toLowerCase() === addrLower);
    }

    return res.json({ events });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
