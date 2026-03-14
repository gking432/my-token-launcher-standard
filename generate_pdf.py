#!/usr/bin/env python3
"""
MoveMint_Business_Case.pdf  — direct ReportLab generation
10-slide deck · Deep Space Crypto palette · Senior product design
"""
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit
import os

# ══════════════════════════════════════════════════════════════════════════════
#  DESIGN CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

PW = 13.33 * inch   # page width
PH = 7.5  * inch    # page height

C = {
    "bg":      HexColor("#0D1117"),
    "card":    HexColor("#161B22"),
    "card2":   HexColor("#1C242E"),
    "blue":    HexColor("#58A6FF"),
    "purple":  HexColor("#BC8CFF"),
    "green":   HexColor("#3FB950"),
    "amber":   HexColor("#F785B2"),  # slightly pink-amber for visibility
    "red":     HexColor("#FF6B6B"),
    "white":   HexColor("#FFFFFF"),
    "light":   HexColor("#E6EDF3"),
    "muted":   HexColor("#8B949E"),
    "divider": HexColor("#212932"),
    "ghost":   HexColor("#1A212B"),
}

# ══════════════════════════════════════════════════════════════════════════════
#  LOW-LEVEL HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def rl(v): return PH - v          # flip Y (reportlab: bottom-left origin)
def t2b(top): return PH - top     # top coord → reportlab bottom

def fill_bg(c, color):
    c.setFillColor(color)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)

def draw_rect(c, x, y, w, h, fill=None, stroke=None, stroke_w=0.5):
    """x,y = top-left in top-origin coords."""
    if fill:   c.setFillColor(fill)
    if stroke: c.setStrokeColor(stroke); c.setLineWidth(stroke_w)
    mode = (1 if fill else 0) + (2 if stroke else 0)
    c.rect(x, t2b(y) - h, w, h,
           fill=(1 if fill else 0),
           stroke=(1 if stroke else 0))

def draw_text(c, text, x, y, font="Helvetica", size=12,
              color=None, align="left", max_width=None):
    """Draw a single line of text. y = top-origin."""
    if color: c.setFillColor(color)
    c.setFont(font, size)
    ry = t2b(y) - size * 0.8
    if align == "center":
        c.drawCentredString(x, ry, text)
    elif align == "right":
        c.drawRightString(x, ry, text)
    else:
        c.drawString(x, ry, text)

def draw_wrapped(c, text, x, y, w, h, font="Helvetica", size=12,
                 color=None, align="left", line_h=None):
    """Draw wrapped text within a box. y = top-origin."""
    if color: c.setFillColor(color)
    c.setFont(font, size)
    lh = line_h or size * 1.35
    lines = simpleSplit(text, font, size, w)
    ry = t2b(y) - size * 0.85
    bottom = t2b(y + h)
    for line in lines:
        if ry < bottom: break
        if align == "center":
            c.drawCentredString(x + w / 2, ry, line)
        elif align == "right":
            c.drawRightString(x + w, ry, line)
        else:
            c.drawString(x, ry, line)
        ry -= lh

# ══════════════════════════════════════════════════════════════════════════════
#  SHARED CHROME
# ══════════════════════════════════════════════════════════════════════════════

FB  = "Helvetica"
FBB = "Helvetica-Bold"
FO  = "Helvetica-Oblique"

def chrome(c, num, section):
    draw_rect(c, 0, 0, 0.055*inch, PH, fill=C["blue"])
    draw_rect(c, PW - 3*inch, 0, 3*inch, 0.055*inch, fill=C["purple"])
    draw_text(c, f"{num} — {section.upper()}",
              0.18*inch, 0.22*inch, FB, 7, color=C["muted"])

def section_lbl(c, text, x, y, color=None):
    draw_text(c, text.upper(), x, y, FBB, 7.5, color=color or C["blue"])

def kpi_card(c, big, label, x, y, w=2.7*inch, h=1.4*inch,
             fill=None, big_color=None):
    fill = fill or C["card"]
    draw_rect(c, x, y, w, h, fill=fill)
    draw_text(c, big, x + 0.2*inch, y + 0.2*inch, FBB, 30,
              color=big_color or C["blue"])
    draw_wrapped(c, label, x + 0.2*inch, y + 0.75*inch,
                 w - 0.35*inch, 0.6*inch, FB, 10, color=C["muted"])

# ══════════════════════════════════════════════════════════════════════════════
#  SLIDE BUILDERS
# ══════════════════════════════════════════════════════════════════════════════

# ─── 01 · HOOK ───────────────────────────────────────────────────────────────
def slide_01(c):
    fill_bg(c, C["bg"])
    chrome(c, "01", "The Opportunity")
    # Ghost grid
    for i in range(1, 8):
        draw_rect(c, 0, i*inch, PW, 0.01*inch, fill=C["divider"])
    # Left accent bar
    draw_rect(c, 0, 0, 0.055*inch, PH, fill=C["blue"])
    # Ghost symbol top-right
    c.setFillColor(C["ghost"])
    c.setFont(FBB, 300)
    c.drawRightString(PW - 0.2*inch, 0.6*inch, "∞")
    # Headlines
    draw_text(c, "Everyone wants to launch a token.",
              0.55*inch, 0.9*inch, FBB, 52, color=C["white"])
    draw_text(c, "Almost no one can.",
              0.55*inch, 1.75*inch, FBB, 44, color=C["blue"])
    # Divider
    draw_rect(c, 0.55*inch, 2.7*inch, 4.5*inch, 0.04*inch, fill=C["purple"])
    draw_wrapped(c,
        "The technical barrier to deploying, trading, and graduating a token "
        "to a decentralized exchange has locked billions in latent creator value.",
        0.55*inch, 2.85*inch, 7.5*inch, 0.9*inch, FB, 15, color=C["muted"])
    # Big ghost number
    draw_text(c, "$2.3B+", 6.5*inch, 3.5*inch, FBB, 64, color=C["ghost"])
    draw_text(c, "est. annual value locked in failed launches",
              6.8*inch, 4.3*inch, FB, 10, color=C["ghost"])
    # Bottom wordmark
    draw_text(c, "MOVEMINT", PW - 0.3*inch, 6.45*inch,
              FBB, 32, color=C["purple"], align="right")
    draw_text(c, "Token Launcher · Aptos Blockchain",
              PW - 0.3*inch, 7.08*inch, FB, 10, color=C["muted"], align="right")

# ─── 02 · THE GAP ────────────────────────────────────────────────────────────
def slide_02(c):
    fill_bg(c, C["bg"])
    draw_rect(c, 0, 0, 7.3*inch, PH, fill=C["card"])
    chrome(c, "02", "The Market Gap")

    section_lbl(c, "Why current solutions fail", 0.55*inch, 0.48*inch)
    draw_text(c, "The Broken Landscape",
              0.55*inch, 0.78*inch, FBB, 26, color=C["white"])

    problems = [
        ("Pump.fun dominance",     "Solana-only — Aptos creators have zero equivalent product."),
        ("High technical barrier", "Deploying Move contracts requires weeks of expertise."),
        ("No liquidity path",      "DIY tokens die on launch — no automated graduation to DEX."),
        ("Opaque price discovery", "No bonding curve means prices are easily manipulated."),
        ("Fragmented UX",          "Creators juggle 4+ tools: wallet, indexer, DEX, explorer."),
    ]
    y = 1.65*inch
    for title, body in problems:
        draw_rect(c, 0.55*inch, y, 0.055*inch, 0.52*inch, fill=C["red"])
        draw_text(c, title, 0.75*inch, y + 0.05*inch, FBB, 12, color=C["light"])
        draw_wrapped(c, body, 0.75*inch, y + 0.32*inch,
                     6.0*inch, 0.32*inch, FB, 10.5, color=C["muted"])
        y += 0.86*inch

    section_lbl(c, "The Macro Tailwind", 7.7*inch, 0.48*inch, C["green"])
    draw_text(c, "Why Now", 7.7*inch, 0.78*inch, FBB, 26, color=C["white"])

    stats = [
        ("$847M+",  "Aptos TVL — fastest-growing L1 in 2024"),
        ("4.2M+",   "monthly active wallets on Aptos"),
        ("ZERO",    "dedicated token launchers on Aptos today"),
        ("$130B",   "memecoin market cap at peak — demand proven"),
    ]
    y = 1.65*inch
    for big, label in stats:
        draw_rect(c, 7.65*inch, y, 5.3*inch, 1.1*inch, fill=C["card2"])
        draw_text(c, big, 7.85*inch, y + 0.15*inch, FBB, 28, color=C["green"])
        draw_wrapped(c, label, 7.85*inch, y + 0.7*inch,
                     4.8*inch, 0.42*inch, FB, 10, color=C["muted"])
        y += 1.22*inch

    # Vertical divider
    draw_rect(c, 7.28*inch, 0.4*inch, 0.04*inch, 6.7*inch, fill=C["blue"])

# ─── 03 · THESIS ─────────────────────────────────────────────────────────────
def slide_03(c):
    fill_bg(c, C["bg"])
    chrome(c, "03", "Investment Thesis")
    draw_rect(c, 0, 0.52*inch, PW, 0.52*inch, fill=C["card"])
    section_lbl(c, "The Core Thesis", 0.55*inch, 0.6*inch)

    draw_wrapped(c,
        "Aptos is the next home for the token creator economy.",
        0.55*inch, 1.18*inch, PW - 1.0*inch, 0.95*inch, FBB, 34, color=C["white"])
    draw_wrapped(c,
        "MoveMint is the one product that makes that possible — today.",
        0.55*inch, 2.02*inch, PW - 1.0*inch, 0.7*inch, FBB, 22, color=C["blue"])

    pillars = [
        (C["blue"],   "SUPPLY",         "Zero competitors on Aptos",
         "No pump.fun equivalent exists on Aptos. MoveMint captures a completely "
         "open market with no incumbent to displace."),
        (C["purple"], "DEMAND",         "Creators want permissionless tools",
         "Memecoins & micro-cap tokens generated $130B in peak market cap. "
         "Demand is proven — just not yet on Aptos."),
        (C["green"],  "INFRASTRUCTURE", "Aptos is production-ready",
         "Sub-second finality, $847M TVL, Move language safety. The L1 is ready. "
         "The app layer is missing."),
    ]
    cx = 0.38*inch
    cw = 4.0*inch
    for accent, tag, title, body in pillars:
        draw_rect(c, cx, 2.9*inch, cw, 4.2*inch, fill=C["card"])
        draw_rect(c, cx, 2.9*inch, cw, 0.07*inch, fill=accent)
        section_lbl(c, tag, cx + 0.22*inch, 3.07*inch, accent)
        draw_text(c, title, cx + 0.22*inch, 3.42*inch, FBB, 16, color=C["white"])
        draw_wrapped(c, body, cx + 0.22*inch, 3.9*inch,
                     cw - 0.4*inch, 3.0*inch, FB, 12, color=C["muted"])
        cx += 4.44*inch

    draw_rect(c, 0.55*inch, 7.1*inch, PW - 1.0*inch, 0.04*inch, fill=C["divider"])
    draw_text(c, "A defensible first-mover on Aptos has near-zero time left to claim.",
              0.55*inch, 7.2*inch, FO, 10, color=C["muted"])

# ─── 04 · PRODUCT ────────────────────────────────────────────────────────────
def slide_04(c):
    fill_bg(c, C["bg"])
    draw_rect(c, 0, 0, 5.1*inch, PH, fill=C["card"])
    chrome(c, "04", "The Innovation")

    draw_text(c, "MOVEMINT", 0.44*inch, 0.88*inch, FBB, 44, color=C["white"])
    # Pill
    draw_rect(c, 0.44*inch, 1.72*inch, 2.4*inch, 0.26*inch, fill=C["green"])
    draw_text(c, "LIVE ON APTOS TESTNET",
              0.54*inch, 1.77*inch, FBB, 8.5, color=C["bg"])
    draw_wrapped(c,
        "A permissionless platform to create, trade, and graduate "
        "tokens on Aptos — in under 60 seconds.",
        0.44*inch, 2.15*inch, 4.3*inch, 1.35*inch, FB, 15, color=C["light"])

    mini = [("0.2 APT", "launch fee"), ("1%", "trade fee"), ("1,283 APT", "graduation target")]
    ky = 3.7*inch
    for big, lbl in mini:
        draw_text(c, big, 0.44*inch, ky, FBB, 24, color=C["blue"])
        draw_text(c, lbl, 0.44*inch, ky + 0.42*inch, FB, 10, color=C["muted"])
        ky += 0.82*inch

    features = [
        (C["blue"],   "Token Factory",   "Deploy any fungible token in one tx via Move smart contract."),
        (C["purple"], "Bonding Curve",   "Price discovery: buys push price up, sells return APT."),
        (C["green"],  "DEX Graduation",  "1,283 APT raised → auto-migrate to Hyperion DEX."),
        (C["amber"],  "Real-time Feed",  "Live trades, price ticks, leaderboard via Geomi indexer."),
        (C["blue"],   "Multi-wallet",    "Petra, Fewcha, Martian, Rise, MiZu + Google OAuth."),
        (C["purple"], "Watchlist",       "Persistent, per-user watchlist stored in localStorage."),
    ]
    gx = 5.38*inch
    gy = 0.55*inch
    cw = 3.77*inch
    ch = 2.1*inch
    for i, (accent, title, body) in enumerate(features):
        col = i % 2; row = i // 2
        cx = gx + col * 3.95*inch
        cy = gy + row * 2.22*inch
        draw_rect(c, cx, cy, cw, ch, fill=C["card2"])
        draw_rect(c, cx, cy, 0.065*inch, ch, fill=accent)
        draw_text(c, title, cx + 0.2*inch, cy + 0.22*inch, FBB, 14, color=C["light"])
        draw_wrapped(c, body, cx + 0.2*inch, cy + 0.65*inch,
                     cw - 0.32*inch, 1.35*inch, FB, 11.5, color=C["muted"])

    draw_rect(c, 5.1*inch, 0, 0.04*inch, PH, fill=C["divider"])

# ─── 05 · TECH ───────────────────────────────────────────────────────────────
def slide_05(c):
    fill_bg(c, C["bg"])
    chrome(c, "05", "Technical Architecture")
    for i in range(1, 9):
        draw_rect(c, i*1.55*inch, 0, 0.01*inch, PH, fill=C["divider"])

    draw_text(c, "How It Works Under the Hood",
              0.55*inch, 0.48*inch, FBB, 28, color=C["white"])

    layers = [
        {
            "accent": C["blue"],   "tag": "LAYER 1 · SMART CONTRACTS",
            "title":  "Move Contracts",
            "items": [
                "1,089-line Move module on Aptos",
                "Bonding curve formula:",
                "  price = 19,029,514,756 /",
                "  (800M - tokens_sold) + 61.9",
                "Events: Created, Purchase,",
                "Sale, Graduated, Debug",
                "Pre-grad: 0.9% platform fee",
                "+ 0.1% creator fee",
            ],
        },
        {
            "accent": C["purple"], "tag": "LAYER 2 · DATA LAYER",
            "title":  "Indexer + RPC",
            "items": [
                "Geomi No-Code Indexer (GraphQL)",
                "Aptos Fullnode RPC for balances",
                "10-min TTL cache + dedup",
                "Page-visibility stops polling",
                "Custom hooks:",
                "  useTokenData",
                "  useGraduation",
                "  useTokenMarketData",
            ],
        },
        {
            "accent": C["green"],  "tag": "LAYER 3 · DEX INTEGRATION",
            "title":  "Hyperion DEX",
            "items": [
                "Hyperion SDK full-range pool",
                "Threshold: 1,283 APT raised",
                "→ 1,200 APT migrated to DEX",
                "LP tokens burned (dead addr)",
                "Post-grad: 0.05% platform",
                "0.2% creator  0.05% LP",
                "GraduationListener monitors",
                "events continuously",
            ],
        },
    ]
    bx = 0.38*inch
    bw = 4.1*inch
    for lyr in layers:
        draw_rect(c, bx, 1.25*inch, bw, 5.9*inch, fill=C["card"])
        draw_rect(c, bx, 1.25*inch, bw, 0.065*inch, fill=lyr["accent"])
        section_lbl(c, lyr["tag"], bx + 0.2*inch, 1.42*inch, lyr["accent"])
        draw_text(c, lyr["title"], bx + 0.2*inch, 1.78*inch, FBB, 20, color=C["white"])
        iy = 2.28*inch
        for item in lyr["items"]:
            indent = item.startswith("  ")
            col = C["muted"] if indent else C["light"]
            font = FB
            draw_text(c, ("• " if not indent else "  ") + item.strip(),
                      bx + (0.35 if indent else 0.2)*inch, iy, font, 11, color=col)
            iy += 0.41*inch
        bx += 4.44*inch

    for ax in [4.5*inch, 8.94*inch]:
        draw_text(c, "→", ax, 3.95*inch, FBB, 22, color=C["blue"], align="center")

    draw_text(c, "Stack: React 18 · TypeScript · @aptos-labs/ts-sdk v1.39.0 · Geomi GraphQL",
              0.55*inch, 7.18*inch, FB, 9.5, color=C["muted"])

# ─── 06 · USER JOURNEY ───────────────────────────────────────────────────────
def slide_06(c):
    fill_bg(c, C["bg"])
    chrome(c, "06", "User Journey")
    draw_text(c, "From Idea to DEX Listing in 5 Steps",
              0.55*inch, 0.48*inch, FBB, 28, color=C["white"])
    draw_wrapped(c,
        "Total elapsed time: < 60 seconds to launch · < 1 hour to graduate (market-dependent)",
        0.55*inch, 0.98*inch, PW - 1.0*inch, 0.42*inch, FB, 12, color=C["muted"])

    steps = [
        (C["blue"],   "01", "Connect\nWallet",      "Petra / Google\nOAuth",           "< 10s"),
        (C["purple"], "02", "Create\nToken",         "Name, symbol,\nsupply, image",    "0.2 APT"),
        (C["amber"],  "03", "Community\nBuys",       "Bonding curve\ndrives discovery", "Auto"),
        (C["green"],  "04", "Graduation",            "1,283 APT →\nHyperion pool",      "83 APT"),
        (C["blue"],   "05", "DEX\nTrading",          "Full AMM,\nLP locked forever",    "∞"),
    ]
    sw = 2.35*inch
    sh = 4.55*inch
    sx = 0.33*inch
    sy = 1.55*inch

    for i, (accent, num, title, detail, time_) in enumerate(steps):
        draw_rect(c, sx, sy, sw, sh, fill=C["card"])
        draw_rect(c, sx, sy, sw, 0.07*inch, fill=accent)
        # Ghost number
        c.setFillColor(C["ghost"])
        c.setFont(FBB, 64)
        c.drawString(sx + 0.12*inch, t2b(sy + 0.18*inch) - 64*0.8, num)
        draw_wrapped(c, title, sx + 0.18*inch, sy + 1.1*inch,
                     sw - 0.3*inch, 0.6*inch, FBB, 16, color=C["white"])
        draw_wrapped(c, detail, sx + 0.18*inch, sy + 1.75*inch,
                     sw - 0.3*inch, 1.45*inch, FB, 12, color=C["muted"])
        # Time pill
        draw_rect(c, sx + 0.18*inch, sy + sh - 0.62*inch,
                  1.6*inch, 0.37*inch, fill=accent)
        draw_text(c, time_, sx + 0.28*inch, sy + sh - 0.57*inch,
                  FBB, 11, color=C["bg"])
        # Arrow
        if i < 4:
            draw_text(c, ">", sx + sw + 0.07*inch, sy + 1.85*inch,
                      FBB, 24, color=C["blue"])
        sx += sw + 0.27*inch

    draw_rect(c, 0.33*inch, 6.72*inch, PW - 0.6*inch, 0.52*inch, fill=C["card2"])
    draw_text(c, "⚡  GraduationListener runs in background — creators never manually trigger DEX migration.",
              0.55*inch, 6.8*inch, FB, 11.5, color=C["light"])

# ─── 07 · REVENUE ────────────────────────────────────────────────────────────
def slide_07(c):
    fill_bg(c, C["bg"])
    chrome(c, "07", "Market Strategy & Revenue")
    draw_text(c, "A Self-Sustaining Fee Engine",
              0.55*inch, 0.48*inch, FBB, 28, color=C["white"])

    draw_rect(c, 0.38*inch, 1.35*inch, 6.2*inch, 5.75*inch, fill=C["card"])
    section_lbl(c, "Fee Structure", 0.62*inch, 1.52*inch, C["amber"])

    rows = [
        ("Launch Fee",       "0.2 APT",            "Per token created",             C["amber"]),
        ("Pre-grad Trade",   "0.9% + 0.1%",        "Platform + creator royalty",    C["blue"]),
        ("Post-grad Trade",  "0.05% + 0.2% + 0.05%","Platform / Creator / LP",     C["green"]),
        ("Graduation Fee",   "83 APT",              "60 platform + 23 creator",     C["purple"]),
    ]
    ry = 2.0*inch
    for label, fee, note, color in rows:
        draw_rect(c, 0.58*inch, ry, 0.055*inch, 0.72*inch, fill=color)
        draw_text(c, label, 0.78*inch, ry + 0.06*inch, FBB, 12, color=C["light"])
        draw_text(c, fee,   3.2*inch,  ry + 0.06*inch, FBB, 15, color=color)
        draw_text(c, note,  0.78*inch, ry + 0.42*inch, FB,  10, color=C["muted"])
        ry += 1.02*inch

    draw_rect(c, 6.85*inch, 1.35*inch, 6.1*inch, 5.75*inch, fill=C["card2"])
    section_lbl(c, "Revenue Scenarios (APT @ $8)", 7.08*inch, 1.52*inch, C["green"])

    scenarios = [
        ("Conservative", "50 tokens/mo",    "~$2,800/mo",   "~$34K ARR",   C["muted"]),
        ("Base Case",    "300 tokens/mo",   "~$18,400/mo",  "~$220K ARR",  C["blue"]),
        ("Growth",       "1,000 tokens/mo", "~$72,000/mo",  "~$864K ARR",  C["green"]),
        ("Viral (1%)",   "10K tokens/mo",   "~$680,000/mo", "~$8.2M ARR",  C["amber"]),
    ]
    ry = 2.02*inch
    for name, vol, monthly, arr, color in scenarios:
        draw_rect(c, 6.98*inch, ry, 5.88*inch, 1.04*inch, fill=C["card"])
        draw_rect(c, 6.98*inch, ry, 0.055*inch, 1.04*inch, fill=color)
        draw_text(c, name,    7.18*inch, ry + 0.1*inch,  FBB, 14, color=color)
        draw_text(c, vol,     7.18*inch, ry + 0.55*inch, FB,  10, color=C["muted"])
        draw_text(c, monthly, 9.65*inch, ry + 0.1*inch,  FBB, 15, color=C["white"])
        draw_text(c, arr,     11.4*inch, ry + 0.1*inch,  FBB, 13, color=color)
        ry += 1.18*inch

    draw_text(c,
        "* Estimates assume 300 APT avg raise/token. Excludes post-graduation ongoing trade volume.",
        0.55*inch, 7.2*inch, FO, 9, color=C["muted"])

# ─── 08 · SCALABILITY ────────────────────────────────────────────────────────
def slide_08(c):
    fill_bg(c, C["bg"])
    chrome(c, "08", "Scalability")
    draw_text(c, "Built to Handle 100x Growth Without Rewrites",
              0.55*inch, 0.48*inch, FBB, 26, color=C["white"])
    draw_text(c, "3-phase architecture embedded in the codebase — not an afterthought.",
              0.55*inch, 0.98*inch, FB, 13, color=C["muted"])

    phases = [
        {
            "phase": "PHASE 1", "status": "NOW",
            "title": "Smart Polling",  "color": C["blue"],
            "points": [
                "Per-client HTTP polling to Geomi",
                "10-min TTL cache per user",
                "Request deduplication layer",
                "Visibility API pauses polling",
                "when browser tab is hidden",
                "",
                "Capacity: ~500 concurrent users",
            ],
            "cost": "~$0.08 / 1K requests",
        },
        {
            "phase": "PHASE 2", "status": "NEXT",
            "title": "WebSocket Broadcast", "color": C["purple"],
            "points": [
                "1 server polls, pushes to all clients",
                "99.95% reduction in API calls",
                "Sub-second latency for all users",
                "Redis pub/sub for horizontal scale",
                "across multiple server instances",
                "",
                "Capacity: ~50,000 concurrent",
            ],
            "cost": "~$0.0004 / 1K requests",
        },
        {
            "phase": "PHASE 3", "status": "SCALE",
            "title": "gRPC Streaming", "color": C["green"],
            "points": [
                "Direct Aptos gRPC event stream",
                "Zero polling — fully event-driven",
                "Real-time at blockchain speed",
                "Free data from node subscription",
                "Horizontal microservice ready",
                "",
                "Capacity: Unlimited",
            ],
            "cost": "~$0 / event",
        },
    ]
    bx = 0.38*inch
    bw = 4.1*inch
    by = 1.7*inch
    bh = 5.4*inch

    for ph in phases:
        draw_rect(c, bx, by, bw, bh, fill=C["card"])
        draw_rect(c, bx, by, bw, 0.065*inch, fill=ph["color"])
        # Phase + status pills
        draw_rect(c, bx + 0.2*inch, by + 0.2*inch, 0.95*inch, 0.26*inch, fill=ph["color"])
        draw_text(c, ph["phase"], bx + 0.26*inch, by + 0.23*inch, FBB, 8.5, color=C["bg"])
        draw_rect(c, bx + 1.22*inch, by + 0.2*inch, 0.75*inch, 0.26*inch, fill=C["card2"])
        draw_text(c, ph["status"], bx + 1.28*inch, by + 0.23*inch, FBB, 8.5, color=ph["color"])
        draw_text(c, ph["title"], bx + 0.2*inch, by + 0.62*inch, FBB, 20, color=C["white"])
        iy = by + 1.12*inch
        for pt in ph["points"]:
            if pt == "": iy += 0.15*inch; continue
            col = C["light"]
            draw_text(c, "• " + pt, bx + 0.2*inch, iy, FB, 11.5, color=col)
            iy += 0.4*inch
        # Cost badge
        draw_rect(c, bx + 0.2*inch, by + bh - 0.55*inch,
                  bw - 0.4*inch, 0.37*inch, fill=ph["color"])
        draw_text(c, ph["cost"], bx + 0.32*inch, by + bh - 0.51*inch,
                  FBB, 11, color=C["bg"])
        bx += 4.45*inch

    for ax in [4.5*inch, 8.95*inch]:
        draw_text(c, "→", ax, 4.45*inch, FBB, 22, color=C["blue"], align="center")

# ─── 09 · COMPETITIVE MOAT ───────────────────────────────────────────────────
def slide_09(c):
    fill_bg(c, C["bg"])
    chrome(c, "09", "Competitive Moat")
    draw_text(c, "Why MoveMint Wins — and Stays Won",
              0.55*inch, 0.48*inch, FBB, 28, color=C["white"])

    features = [
        "Aptos-native deployment",
        "Bonding curve AMM",
        "Auto DEX graduation",
        "Locked liquidity (LP burn)",
        "Creator royalties on trades",
        "Real-time indexing",
        "Multi-wallet + Google OAuth",
        "Open source contract",
        "Scalable to gRPC",
    ]
    competitors = [
        ("MoveMint",     C["blue"],   [1,1,1,1,1,1,1,1,1]),
        ("Pump.fun",     C["muted"],  [0,1,1,1,0,1,0,0,0]),
        ("Cetus (Apt)",  C["muted"],  [1,0,0,0,0,0,0,1,0]),
        ("DIY / Manual", C["muted"],  [1,0,0,0,0,0,0,0,0]),
    ]

    # Header
    hx = 5.1*inch
    cw = 1.9*inch
    draw_rect(c, 0.38*inch, 1.33*inch, 4.55*inch, 0.52*inch, fill=C["card2"])
    draw_text(c, "Feature", 0.58*inch, 1.42*inch, FBB, 12, color=C["muted"])
    for comp, color, _ in competitors:
        draw_rect(c, hx, 1.33*inch, cw, 0.52*inch, fill=C["card"])
        draw_text(c, comp, hx + cw/2, 1.42*inch, FBB, 12, color=color, align="center")
        hx += cw + 0.1*inch

    ry = 1.92*inch
    for fi, feat in enumerate(features):
        row_fill = C["card"] if fi % 2 == 0 else C["card2"]
        draw_rect(c, 0.38*inch, ry, 4.55*inch, 0.55*inch, fill=row_fill)
        draw_text(c, feat, 0.58*inch, ry + 0.1*inch, FB, 12.5, color=C["light"])

        hx = 5.1*inch
        for comp, color, checks in competitors:
            draw_rect(c, hx, ry, cw, 0.55*inch, fill=row_fill)
            mark = "✓" if checks[fi] else "–"
            mc   = C["green"] if checks[fi] else C["divider"]
            draw_text(c, mark, hx + cw/2, ry + 0.08*inch,
                      FBB, 18, color=mc, align="center")
            hx += cw + 0.1*inch
        ry += 0.62*inch

    # Footer bar
    draw_rect(c, 0.38*inch, 7.05*inch, PW - 0.75*inch, 0.35*inch, fill=C["blue"])
    draw_text(c,
        "Network effects compound: every graduated token increases credibility and creator FOMO.",
        0.55*inch, 7.09*inch, FBB, 12, color=C["bg"])

# ─── 10 · VISION ─────────────────────────────────────────────────────────────
def slide_10(c):
    # Gradient background effect
    for i in range(30):
        alpha = i / 30
        r = int(0x0D + alpha * (0x1C - 0x0D))
        g = int(0x11)
        b = int(0x17 + alpha * (0x2E - 0x17))
        draw_rect(c, 0, i*0.25*inch, PW, 0.26*inch,
                  fill=HexColor(f"#{r:02x}{g:02x}{b:02x}"))
    chrome(c, "10", "Vision")
    draw_rect(c, 0, 0, 0.055*inch, PH, fill=C["purple"])
    draw_rect(c, PW - 3*inch, 0, 3*inch, 0.06*inch, fill=C["blue"])
    draw_rect(c, 0.55*inch, 2.8*inch, 6.0*inch, 0.045*inch, fill=C["purple"])

    draw_text(c, "The future of permissionless",
              0.55*inch, 0.88*inch, FBB, 48, color=C["white"])
    draw_text(c, "finance is being built now.",
              0.55*inch, 1.68*inch, FBB, 48, color=C["blue"])
    draw_text(c, "On Aptos. With Move. With MoveMint.",
              0.55*inch, 2.6*inch, FBB, 22, color=C["purple"])
    draw_wrapped(c,
        "Our 18-month vision: become the canonical token launch infrastructure "
        "for Aptos — expanding to cross-chain graduation, creator DAOs, "
        "launchpad curation, and protocol-owned liquidity.",
        0.55*inch, 3.2*inch, 7.5*inch, 1.4*inch, FB, 15, color=C["muted"])

    kpis = [
        (C["blue"],   "10,000+", "tokens launched\nby end of Year 1"),
        (C["purple"], "$50M+",   "total volume through\nbonding curves"),
        (C["green"],  "3",       "additional Aptos DEXs\nintegrated"),
    ]
    vx = 0.52*inch
    for color, big, label in kpis:
        draw_rect(c, vx, 4.85*inch, 3.88*inch, 1.8*inch, fill=C["card"])
        draw_rect(c, vx, 4.85*inch, 3.88*inch, 0.06*inch, fill=color)
        draw_text(c, big, vx + 0.22*inch, 5.08*inch, FBB, 34, color=color)
        draw_wrapped(c, label, vx + 0.22*inch, 5.65*inch,
                     3.4*inch, 0.95*inch, FB, 12, color=C["muted"])
        vx += 4.1*inch

    draw_rect(c, 0.52*inch, 7.0*inch, 8.5*inch, 0.32*inch, fill=C["card2"])
    draw_text(c, "github.com/gking432/my-token-launcher-standard  ·  Ready for mainnet deployment",
              0.7*inch, 7.04*inch, FB, 10, color=C["muted"])
    draw_text(c, "MOVEMINT",
              PW - 0.3*inch, 6.42*inch, FBB, 36, color=C["purple"], align="right")
    draw_text(c, "Aptos · Move · Open Source",
              PW - 0.3*inch, 7.04*inch, FB, 11, color=C["muted"], align="right")

# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def build():
    out = "/home/user/my-token-launcher-standard/MoveMint_Business_Case.pdf"
    cv = canvas.Canvas(out, pagesize=(PW, PH))
    cv.setTitle("MoveMint Business Case")
    cv.setAuthor("MoveMint · Handshake AI Application")
    cv.setSubject("Token Launcher on Aptos — Business Case & Investment Thesis")

    slides = [
        ("01", "The Hook",               slide_01),
        ("02", "The Gap",                slide_02),
        ("03", "Investment Thesis",      slide_03),
        ("04", "The Innovation",         slide_04),
        ("05", "Technical Deep Dive",    slide_05),
        ("06", "User Journey",           slide_06),
        ("07", "Revenue Model",          slide_07),
        ("08", "Scalability",            slide_08),
        ("09", "Competitive Moat",       slide_09),
        ("10", "Vision",                 slide_10),
    ]

    for num, name, fn in slides:
        fn(cv)
        cv.showPage()
        print(f"  ✓ Slide {num} — {name}")

    cv.save()
    size = os.path.getsize(out) / 1024
    print(f"\n✅  PDF saved: {out}  ({size:.1f} KB)")
    print("\n" + "═"*62)
    print("  📋  5-MINUTE MANUAL CHECK CHECKLIST")
    print("═"*62)
    checks = [
        "Slide 01 — Headline not clipped; ghost '∞' visible",
        "Slide 02 — Left/right panels edge-to-edge, no gap",
        "Slide 03 — 3 pillar cards equal width",
        "Slide 04 — 6 feature cards in 2×3 grid, no overlap",
        "Slide 05 — Arrows between 3 architecture columns",
        "Slide 06 — 5 timeline cards evenly spaced",
        "Slide 07 — Revenue table + scenario columns aligned",
        "Slide 08 — Phase badges (NOW/NEXT/SCALE) visible",
        "Slide 09 — Checkmarks centered in each column",
        "Slide 10 — 3 KPI boxes bottom-aligned",
        "ALL  — Left blue accent bar consistent across slides",
        "ALL  — Slide number labels in top-left corner",
    ]
    for ch in checks:
        print(f"  □  {ch}")
    print("═"*62)

if __name__ == "__main__":
    build()
