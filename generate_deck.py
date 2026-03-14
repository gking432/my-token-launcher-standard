#!/usr/bin/env python3
"""
MoveMint Presentation Deck Generator
Professional 16:9 PDF presentation with custom visuals
"""

import math
import os
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, Color, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
import io

# ── Slide dimensions (16:9) ──────────────────────────────────────────────────
W = 13.333 * inch
H = 7.5 * inch

# ── Brand colors ─────────────────────────────────────────────────────────────
DARK_BG    = HexColor("#1a2526")   # deep dark teal-black
PANEL      = HexColor("#434852")   # slate grey panel
ACCENT     = HexColor("#00ff99")   # neon mint
WHITE      = HexColor("#ffffff")
OFF_WHITE  = HexColor("#f5f5f5")
LIGHT_GREY = HexColor("#e8e8e8")
MID_GREY   = HexColor("#8a8f99")
TEXT_DARK  = HexColor("#1a2526")
TEXT_MED   = HexColor("#434852")
ACCENT_DIM = HexColor("#00cc7a")
CARD_BG    = HexColor("#f8f9fa")
DARK_CARD  = HexColor("#243030")
ACCENT2    = HexColor("#00d4ff")   # secondary accent blue

# ── Register fonts ────────────────────────────────────────────────────────────
font_dir = "/tmp/montserrat"
pdfmetrics.registerFont(TTFont("Mont",     f"{font_dir}/Montserrat-Regular.ttf"))
pdfmetrics.registerFont(TTFont("MontB",    f"{font_dir}/Montserrat-Bold.ttf"))
pdfmetrics.registerFont(TTFont("MontSB",   f"{font_dir}/Montserrat-SemiBold.ttf"))
pdfmetrics.registerFont(TTFont("MontL",    f"{font_dir}/Montserrat-Light.ttf"))
pdfmetrics.registerFont(TTFont("MontEB",   f"{font_dir}/Montserrat-ExtraBold.ttf"))

# ── Helpers ───────────────────────────────────────────────────────────────────
def set_fill(c, color):
    c.setFillColor(color)

def set_stroke(c, color):
    c.setStrokeColor(color)

def rect(c, x, y, w, h, fill=None, stroke=None, radius=0, line_width=1):
    if fill:   c.setFillColor(fill)
    if stroke: c.setStrokeColor(stroke)
    c.setLineWidth(line_width)
    if radius > 0:
        c.roundRect(x, y, w, h, radius, fill=1 if fill else 0, stroke=1 if stroke else 0)
    else:
        c.rect(x, y, w, h, fill=1 if fill else 0, stroke=1 if stroke else 0)

def text(c, txt, x, y, font="Mont", size=12, color=None, align="left"):
    if color: c.setFillColor(color)
    c.setFont(font, size)
    if align == "center":
        c.drawCentredString(x, y, txt)
    elif align == "right":
        c.drawRightString(x, y, txt)
    else:
        c.drawString(x, y, txt)

def slide_bg(c, color=WHITE):
    rect(c, 0, 0, W, H, fill=color)

def accent_bar(c, y=None, x=0.5*inch, width=0.45*inch, height=0.055*inch):
    if y is None:
        y = H - 1.1*inch
    rect(c, x, y, width, height, fill=ACCENT)

def tag_pill(c, label, x, y, bg=ACCENT, fg=DARK_BG, font="MontB", size=8.5):
    tw = pdfmetrics.stringWidth(label, font, size)
    pad_h, pad_v = 10, 5
    w = tw + 2*pad_h
    h = size + 2*pad_v
    rect(c, x, y, w, h, fill=bg, radius=h/2)
    text(c, label, x + pad_h, y + pad_v + 1, font=font, size=size, color=fg)
    return w

def slide_number(c, n, total=14):
    text(c, f"{n:02d} / {total:02d}", W - 0.55*inch, 0.25*inch,
         font="Mont", size=7.5, color=MID_GREY, align="right")

def dot_grid(c, x, y, cols=8, rows=5, spacing=14, color=None, alpha=0.06):
    if color is None: color = PANEL
    c.saveState()
    c.setFillColor(color, alpha=alpha)
    for r in range(rows):
        for col in range(cols):
            cx = x + col*spacing
            cy = y + r*spacing
            c.circle(cx, cy, 1.2, fill=1, stroke=0)
    c.restoreState()

def thin_line(c, x1, y1, x2, y2, color=LIGHT_GREY, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)

def hex_shape(c, cx, cy, size, fill_color, stroke_color=None, line_w=1.5):
    """Draw a regular hexagon."""
    points = []
    for i in range(6):
        angle = math.pi/6 + i * math.pi/3
        px = cx + size * math.cos(angle)
        py = cy + size * math.sin(angle)
        points.append((px, py))
    path = c.beginPath()
    path.moveTo(points[0][0], points[0][1])
    for px, py in points[1:]:
        path.lineTo(px, py)
    path.close()
    c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(line_w)
        c.drawPath(path, fill=1, stroke=1)
    else:
        c.drawPath(path, fill=1, stroke=0)

def draw_arrow(c, x1, y1, x2, y2, color=ACCENT, width=1.5, head=6):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    # line
    dx = x2 - x1; dy = y2 - y1
    length = math.sqrt(dx*dx + dy*dy)
    ux = dx/length; uy = dy/length
    # shorten to make room for head
    ex = x2 - ux*head*1.2
    ey = y2 - uy*head*1.2
    c.line(x1, y1, ex, ey)
    # arrowhead
    px = -uy; py = ux
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(ex + px*head*0.5, ey + py*head*0.5)
    path.lineTo(ex - px*head*0.5, ey - py*head*0.5)
    path.close()
    c.drawPath(path, fill=1, stroke=0)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE
# ═══════════════════════════════════════════════════════════════════════════════
def slide_title(c):
    slide_bg(c, DARK_BG)

    # subtle dot grid background
    dot_grid(c, 0.3*inch, 0.3*inch, cols=30, rows=18, spacing=22, color=ACCENT, alpha=0.04)

    # large decorative hex cluster (right side)
    c.saveState()
    sizes = [110, 80, 55, 38, 25]
    positions = [
        (W - 2.2*inch, H*0.5),
        (W - 1.3*inch, H*0.72),
        (W - 3.1*inch, H*0.68),
        (W - 1.1*inch, H*0.32),
        (W - 3.0*inch, H*0.32),
    ]
    alphas = [0.08, 0.06, 0.05, 0.07, 0.04]
    for (hx, hy), hs, ha in zip(positions, sizes, alphas):
        hex_shape(c, hx, hy, hs, HexColor("#00ff99"), line_w=0)
        c.setFillColor(HexColor("#00ff99"), alpha=ha)
        hex_shape(c, hx, hy, hs, HexColor("#00ff99"))
    c.restoreState()

    # glowing accent line
    c.saveState()
    c.setStrokeColor(ACCENT, alpha=0.35)
    c.setLineWidth(1.5)
    c.line(0.55*inch, H*0.5 - 0.05*inch, W*0.55, H*0.5 - 0.05*inch)
    c.restoreState()

    # Accent bar
    rect(c, 0.55*inch, H*0.545, 0.52*inch, 0.055*inch, fill=ACCENT)

    # Tag
    tag_pill(c, "MEMECOIN LAUNCHPAD", 0.55*inch, H*0.36,
             bg=HexColor("#243030"), fg=ACCENT, size=8)

    # Main title
    text(c, "Move", 0.55*inch, H*0.595, font="MontEB", size=78, color=WHITE)
    text(c, "Mint", 0.55*inch + pdfmetrics.stringWidth("Move", "MontEB", 78),
         H*0.595, font="MontEB", size=78, color=ACCENT)

    # Tagline
    text(c, "A cleaner memecoin launch platform", 0.55*inch, H*0.30,
         font="MontL", size=19, color=HexColor("#b0bfbf"))
    text(c, "built on Aptos.", 0.55*inch, H*0.23,
         font="MontL", size=19, color=HexColor("#b0bfbf"))

    # Bottom strip
    rect(c, 0, 0, W, 0.055*inch, fill=ACCENT)

    # Footer meta
    text(c, "2024  ·  Aptos Testnet  ·  Prototype",
         0.55*inch, 0.18*inch, font="Mont", size=8, color=MID_GREY)

    slide_number(c, 1)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — THE RISE OF MEMECOINS
# ═══════════════════════════════════════════════════════════════════════════════
def slide_rise_of_memecoins(c):
    slide_bg(c, WHITE)

    # left dark panel
    rect(c, 0, 0, W*0.42, H, fill=DARK_BG)
    dot_grid(c, 0.1*inch, 0.3*inch, cols=12, rows=14, spacing=22, color=ACCENT, alpha=0.05)

    accent_bar(c, y=H - 1.12*inch, x=0.55*inch)

    # Section label
    text(c, "MARKET CONTEXT", 0.55*inch, H - 0.85*inch, font="MontSB", size=8, color=ACCENT)

    # Left heading
    text(c, "The Rise of", 0.55*inch, H*0.64, font="MontEB", size=36, color=WHITE)
    text(c, "Memecoins", 0.55*inch, H*0.50, font="MontEB", size=36, color=ACCENT)

    text(c, "From Dogecoin joke to",  0.55*inch, H*0.38, font="Mont", size=12, color=HexColor("#b0bfbf"))
    text(c, "billion-dollar ecosystems.", 0.55*inch, H*0.31, font="Mont", size=12, color=HexColor("#b0bfbf"))

    # Right content — stat cards
    stats = [
        ("$60B+",  "Total memecoin market cap at peak (2024)"),
        ("1M+",    "Tokens launched on Pump.fun in first year"),
        ("500%",   "Growth in memecoin trading volume, 2023–2024"),
        ("#1",     "Pump.fun became Solana's top revenue generator"),
    ]
    col_x = W*0.455
    start_y = H - 1.0*inch
    card_h = 0.95*inch
    card_gap = 0.16*inch
    card_w = W - col_x - 0.45*inch

    for i, (val, desc) in enumerate(stats):
        cy = start_y - i*(card_h + card_gap)
        rect(c, col_x, cy - card_h, card_w, card_h, fill=CARD_BG, radius=8)
        # accent left edge
        rect(c, col_x, cy - card_h, 0.04*inch, card_h, fill=ACCENT)
        text(c, val, col_x + 0.22*inch, cy - card_h + 0.52*inch,
             font="MontEB", size=22, color=DARK_BG)
        text(c, desc, col_x + 0.22*inch, cy - card_h + 0.22*inch,
             font="Mont", size=9.5, color=TEXT_MED)

    # bottom bar
    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 2)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — PROBLEMS WITH EXISTING ECOSYSTEMS
# ═══════════════════════════════════════════════════════════════════════════════
def slide_problems(c):
    slide_bg(c, WHITE)

    # Top dark bar
    rect(c, 0, H - 1.4*inch, W, 1.4*inch, fill=DARK_BG)
    dot_grid(c, 0.2*inch, H - 1.35*inch, cols=30, rows=4, spacing=18, color=ACCENT, alpha=0.04)

    text(c, "PROBLEM", 0.55*inch, H - 0.65*inch, font="MontSB", size=8, color=ACCENT)
    text(c, "Chaos in the Current Ecosystem", 0.55*inch, H - 1.12*inch,
         font="MontEB", size=28, color=WHITE)

    # Problem cards — 2 x 2 grid
    problems = [
        ("Rug Pulls & Scams",
         "Over 40% of launched tokens are abandoned within 48 hours. No accountability mechanisms."),
        ("Solana Congestion",
         "Network bottlenecks during high-volume launches. Failed transactions, frustrated users."),
        ("Unfair Price Discovery",
         "Insider buys before public launch. Bots front-run retail traders at token genesis."),
        ("No Liquidity Guarantees",
         "Founders drain liquidity pools post-launch. Investors left holding worthless tokens."),
    ]

    cols = 2
    col_w = (W - 1.3*inch) / cols
    row_h = (H - 1.8*inch - 0.4*inch) / 2
    start_x = 0.55*inch
    start_y = H - 1.6*inch

    icons = ["⚠", "⚡", "📊", "💧"]
    icon_colors = [HexColor("#ff6b6b"), HexColor("#ffa94d"), HexColor("#748ffc"), HexColor("#4dabf7")]

    for i, (title, desc) in enumerate(problems):
        col = i % cols
        row = i // cols
        x = start_x + col * (col_w + 0.2*inch)
        y = start_y - row * (row_h + 0.18*inch) - row_h

        rect(c, x, y, col_w - 0.15*inch, row_h, fill=CARD_BG, radius=10)
        # top accent
        rect(c, x, y + row_h - 0.045*inch, col_w - 0.15*inch, 0.045*inch,
             fill=icon_colors[i], radius=10)

        text(c, title, x + 0.22*inch, y + row_h - 0.45*inch,
             font="MontB", size=13, color=DARK_BG)
        # wrap description
        words = desc.split()
        line1 = " ".join(words[:8])
        line2 = " ".join(words[8:])
        text(c, line1, x + 0.22*inch, y + row_h - 0.72*inch,
             font="Mont", size=9.5, color=TEXT_MED)
        if line2:
            text(c, line2, x + 0.22*inch, y + row_h - 0.92*inch,
                 font="Mont", size=9.5, color=TEXT_MED)

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 3)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — THE OPPORTUNITY
# ═══════════════════════════════════════════════════════════════════════════════
def slide_opportunity(c):
    slide_bg(c, DARK_BG)
    dot_grid(c, 0.2*inch, 0.2*inch, cols=30, rows=18, spacing=22, color=ACCENT, alpha=0.035)

    # center large quote / statement
    text(c, "OPPORTUNITY", W/2, H - 0.85*inch, font="MontSB", size=8,
         color=ACCENT, align="center")
    rect(c, W/2 - 0.26*inch, H - 0.92*inch, 0.52*inch, 0.045*inch, fill=ACCENT)

    text(c, "The market is ready for a", W/2, H*0.66,
         font="MontL", size=28, color=HexColor("#c5d5d5"), align="center")
    text(c, "structured alternative.", W/2, H*0.54,
         font="MontEB", size=38, color=WHITE, align="center")

    # Three pillars
    pillars = [
        ("Multi-Chain Demand",
         "Traders want memecoin culture\noutside Solana's congestion."),
        ("Fairness Premium",
         "Communities reward platforms\nthat enforce launch fairness."),
        ("Ecosystem Growth",
         "Aptos is investing heavily in\nDeFi and consumer apps."),
    ]

    pil_w = (W - 1.6*inch) / 3
    pil_x = 0.65*inch
    pil_y = H*0.1
    pil_h = H*0.28

    for i, (title, desc) in enumerate(pillars):
        x = pil_x + i*(pil_w + 0.18*inch)
        # glass card
        rect(c, x, pil_y, pil_w - 0.1*inch, pil_h, fill=DARK_CARD, radius=10)
        rect(c, x, pil_y + pil_h - 0.045*inch, pil_w - 0.1*inch, 0.045*inch,
             fill=ACCENT, radius=10)
        text(c, f"0{i+1}", x + 0.22*inch, pil_y + pil_h - 0.48*inch,
             font="MontEB", size=22, color=ACCENT)
        text(c, title, x + 0.22*inch, pil_y + pil_h - 0.75*inch,
             font="MontSB", size=12, color=WHITE)
        lines = desc.split("\n")
        for li, ln in enumerate(lines):
            text(c, ln, x + 0.22*inch, pil_y + pil_h - 0.98*inch - li*0.18*inch,
                 font="MontL", size=9.5, color=HexColor("#8ab0b0"))

    rect(c, 0, 0, W, 0.045*inch, fill=ACCENT)
    slide_number(c, 4)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — INTRODUCING MOVEMINT
# ═══════════════════════════════════════════════════════════════════════════════
def slide_intro_movemint(c):
    slide_bg(c, WHITE)

    # Right dark panel
    rect(c, W*0.56, 0, W*0.44, H, fill=DARK_BG)
    dot_grid(c, W*0.57, 0.2*inch, cols=14, rows=18, spacing=22, color=ACCENT, alpha=0.04)

    accent_bar(c, y=H - 1.1*inch, x=0.55*inch)
    text(c, "PRODUCT", 0.55*inch, H - 0.85*inch, font="MontSB", size=8, color=MID_GREY)

    text(c, "Introducing", 0.55*inch, H*0.68, font="MontL", size=32, color=DARK_BG)
    text(c, "MoveMint", 0.55*inch, H*0.53, font="MontEB", size=46, color=DARK_BG)
    # accent dot on i
    rect(c, 0.55*inch, H*0.46, 3.2*inch, 0.055*inch, fill=ACCENT)

    text(c, "Fair. Transparent. Built on Aptos.", 0.55*inch, H*0.38,
         font="MontSB", size=14, color=TEXT_MED)

    text(c, "A memecoin launchpad that replaces speculation", 0.55*inch, H*0.27,
         font="Mont", size=11.5, color=TEXT_MED)
    text(c, "with structure — using bonding curves to make", 0.55*inch, H*0.20,
         font="Mont", size=11.5, color=TEXT_MED)
    text(c, "every launch fair and every price discoverable.", 0.55*inch, H*0.13,
         font="Mont", size=11.5, color=TEXT_MED)

    # Right side — product specs
    specs = [
        ("BLOCKCHAIN",  "Aptos"),
        ("CONTRACT",    "Move Language"),
        ("MODEL",       "Bonding Curve"),
        ("LAUNCH FEE",  "0.2 APT"),
        ("STATUS",      "Live on Testnet"),
    ]
    right_x = W*0.62
    sy = H - 0.85*inch
    for label, val in specs:
        thin_line(c, right_x, sy - 0.03*inch, W - 0.45*inch, sy - 0.03*inch,
                  color=HexColor("#2e3d3e"))
        text(c, label, right_x, sy - 0.28*inch, font="Mont", size=8, color=MID_GREY)
        text(c, val, right_x, sy - 0.48*inch, font="MontSB", size=14, color=WHITE)
        sy -= 0.80*inch

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 5)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — PRODUCT OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════
def slide_product_overview(c):
    slide_bg(c, WHITE)

    rect(c, 0, H - 1.35*inch, W, 1.35*inch, fill=DARK_BG)
    text(c, "PRODUCT OVERVIEW", 0.55*inch, H - 0.65*inch, font="MontSB", size=8, color=ACCENT)
    text(c, "Everything you need to launch.", 0.55*inch, H - 1.1*inch,
         font="MontEB", size=26, color=WHITE)

    features = [
        ("🚀", "Token Launch",
         "Create a memecoin in seconds.\n0.2 APT flat fee. No coding required."),
        ("📈", "Bonding Curve Trading",
         "Prices set algorithmically.\nFair entry for every buyer."),
        ("🎓", "Auto-Graduation",
         "Tokens graduate to DEX\nwhen 1,283 APT is raised."),
        ("🔒", "Locked Liquidity",
         "LP tokens permanently locked.\nNo rug pulls possible."),
        ("👛", "Multi-Wallet Support",
         "Petra, Martian, MizuWallet\nand more."),
        ("📊", "Live Price Charts",
         "Real-time bonding curve charts.\nFull trading history."),
    ]

    cols = 3
    fw = (W - 1.3*inch) / cols
    fh = (H - 1.65*inch - 0.3*inch) / 2
    sx = 0.55*inch
    sy = H - 1.55*inch

    for i, (icon, title, desc) in enumerate(features):
        col = i % cols
        row = i // cols
        x = sx + col*(fw + 0.1*inch)
        y = sy - row*(fh + 0.15*inch) - fh

        rect(c, x, y, fw - 0.1*inch, fh, fill=CARD_BG, radius=10)
        # left accent
        rect(c, x, y, 0.04*inch, fh, fill=ACCENT, radius=4)

        text(c, title, x + 0.2*inch, y + fh - 0.42*inch,
             font="MontB", size=13, color=DARK_BG)
        lines = desc.split("\n")
        for li, ln in enumerate(lines):
            text(c, ln, x + 0.2*inch, y + fh - 0.68*inch - li*0.19*inch,
                 font="Mont", size=9.5, color=TEXT_MED)

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 6)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — HOW TOKEN LAUNCHES WORK
# ═══════════════════════════════════════════════════════════════════════════════
def slide_token_launch_flow(c):
    slide_bg(c, DARK_BG)
    dot_grid(c, 0.2*inch, 0.2*inch, cols=30, rows=18, spacing=22, color=ACCENT, alpha=0.03)

    text(c, "PRODUCT FLOW", W/2, H - 0.68*inch, font="MontSB", size=8,
         color=ACCENT, align="center")
    text(c, "How a Token Launch Works", W/2, H - 1.12*inch,
         font="MontEB", size=28, color=WHITE, align="center")
    rect(c, W/2 - 1.75*inch, H - 1.22*inch, 3.5*inch, 0.045*inch, fill=ACCENT)

    # Flow steps
    steps = [
        ("01", "Connect\nWallet", "Petra or any\nAptos wallet"),
        ("02", "Name Your\nToken", "Set name, ticker\n& decimals"),
        ("03", "Pay\n0.2 APT", "Launch fee\nto platform"),
        ("04", "Token\nGoes Live", "800M supply on\nbonding curve"),
        ("05", "Community\nBuys In", "Price rises with\neach purchase"),
        ("06", "Graduation\nat 1,283 APT", "Moves to\nHyperion DEX"),
    ]

    n = len(steps)
    step_w = (W - 1.2*inch) / n
    arrow_y = H*0.48
    box_h = H*0.34
    box_y = arrow_y - box_h/2
    sx = 0.5*inch

    for i, (num, title, desc) in enumerate(steps):
        bx = sx + i*step_w + step_w*0.05
        bw = step_w * 0.82

        # box
        rect(c, bx, box_y, bw, box_h, fill=DARK_CARD, radius=10)

        # Accent top strip
        rect(c, bx, box_y + box_h - 0.04*inch, bw, 0.04*inch, fill=ACCENT)

        # number
        text(c, num, bx + bw/2, box_y + box_h - 0.42*inch,
             font="MontEB", size=18, color=ACCENT, align="center")

        # title lines
        t_lines = title.split("\n")
        text(c, t_lines[0], bx + bw/2, box_y + box_h - 0.66*inch,
             font="MontSB", size=10.5, color=WHITE, align="center")
        if len(t_lines) > 1:
            text(c, t_lines[1], bx + bw/2, box_y + box_h - 0.82*inch,
                 font="MontSB", size=10.5, color=WHITE, align="center")

        # desc
        d_lines = desc.split("\n")
        text(c, d_lines[0], bx + bw/2, box_y + 0.38*inch,
             font="MontL", size=8.5, color=HexColor("#8ab0b0"), align="center")
        if len(d_lines) > 1:
            text(c, d_lines[1], bx + bw/2, box_y + 0.22*inch,
                 font="MontL", size=8.5, color=HexColor("#8ab0b0"), align="center")

        # arrow between steps
        if i < n - 1:
            ax = bx + bw + (step_w*0.18)/2
            draw_arrow(c, ax - 0.18*inch, arrow_y, ax + 0.18*inch, arrow_y,
                      color=ACCENT, width=1.2, head=5)

    # Bottom note
    text(c, "* Liquidity permanently locked at graduation — no rug pulls possible.",
         W/2, 0.22*inch, font="MontL", size=8.5,
         color=HexColor("#668888"), align="center")

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 7)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — BONDING CURVE ECONOMICS
# ═══════════════════════════════════════════════════════════════════════════════
def slide_bonding_curve(c):
    slide_bg(c, WHITE)

    rect(c, 0, H - 1.35*inch, W, 1.35*inch, fill=DARK_BG)
    text(c, "TOKEN ECONOMICS", 0.55*inch, H - 0.65*inch, font="MontSB", size=8, color=ACCENT)
    text(c, "Bonding Curve Pricing", 0.55*inch, H - 1.1*inch,
         font="MontEB", size=28, color=WHITE)

    # Draw bonding curve graph
    graph_x = 0.55*inch
    graph_y = 0.7*inch
    graph_w = W*0.52 - 0.6*inch
    graph_h = H - 1.6*inch - 0.7*inch

    # Graph background
    rect(c, graph_x, graph_y, graph_w, graph_h, fill=CARD_BG, radius=8)

    # Axes
    ax_x = graph_x + 0.45*inch
    ax_y = graph_y + 0.38*inch
    ax_w = graph_w - 0.6*inch
    ax_h = graph_h - 0.58*inch

    c.setStrokeColor(LIGHT_GREY)
    c.setLineWidth(0.5)
    # Gridlines
    for gi in range(5):
        gy = ax_y + gi*(ax_h/4)
        c.line(ax_x, gy, ax_x + ax_w, gy)
    for gi in range(5):
        gx = ax_x + gi*(ax_w/4)
        c.line(gx, ax_y, gx, ax_y + ax_h)

    # Axis labels
    text(c, "Token Supply Sold →", ax_x + ax_w/2, graph_y + 0.08*inch,
         font="Mont", size=8, color=TEXT_MED, align="center")
    c.saveState()
    c.translate(graph_x + 0.12*inch, ax_y + ax_h/2)
    c.rotate(90)
    text(c, "Price per Token (APT) →", 0, 0, font="Mont", size=8, color=TEXT_MED, align="center")
    c.restoreState()

    # Bonding curve: hyperbolic p = a/(max-x) + b
    # Normalised to graph space
    PRICE_NUM = 19029514756.0
    PRICE_CON = 61.9053276
    MAX_TOK = 800_000_000.0

    def price_at(frac):  # frac in [0,1)
        x = frac * MAX_TOK * 0.97
        return PRICE_NUM / (MAX_TOK - x) + PRICE_CON

    p_min = price_at(0)
    p_max = price_at(0.97)

    def to_graph(frac, price):
        px = ax_x + frac * ax_w
        py = ax_y + ((price - p_min) / (p_max - p_min)) * ax_h
        return px, py

    # Draw curve
    c.saveState()
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2.5)
    path = c.beginPath()
    n_pts = 120
    for i in range(n_pts + 1):
        frac = i / n_pts * 0.97
        px, py = to_graph(frac, price_at(frac))
        if i == 0:
            path.moveTo(px, py)
        else:
            path.lineTo(px, py)
    c.drawPath(path, fill=0, stroke=1)
    c.restoreState()

    # Fill under curve
    c.saveState()
    c.setFillColor(ACCENT, alpha=0.08)
    path2 = c.beginPath()
    path2.moveTo(ax_x, ax_y)
    for i in range(n_pts + 1):
        frac = i / n_pts * 0.97
        px, py = to_graph(frac, price_at(frac))
        path2.lineTo(px, py)
    path2.lineTo(ax_x + ax_w*0.97, ax_y)
    path2.close()
    c.drawPath(path2, fill=1, stroke=0)
    c.restoreState()

    # Graduation line
    grad_frac = 0.75
    gx, gy_top = to_graph(grad_frac, price_at(grad_frac))
    gx2, gy_bot = to_graph(grad_frac, p_min)
    c.setStrokeColor(HexColor("#ff6b6b"))
    c.setLineWidth(1.2)
    c.setDash(4, 3)
    c.line(gx, ax_y, gx, gy_top)
    c.setDash()
    tag_pill(c, "GRADUATION", gx - 0.42*inch, ax_y - 0.32*inch,
             bg=HexColor("#ff6b6b"), fg=WHITE, size=7.5)

    # X-axis ticks
    for ti, label in enumerate(["0%", "25%", "50%", "75%", "100%"]):
        tx = ax_x + ti*(ax_w/4)
        text(c, label, tx, ax_y - 0.18*inch, font="Mont", size=7.5,
             color=TEXT_MED, align="center")

    # Right side — key points
    right_x = W*0.54
    points = [
        ("Hyperbolic Formula",
         "Price = 19,029,514,756 / (800M − sold) + 61.9",
         "Price rises as supply depletes."),
        ("Floor Price",
         "~62 Octas at launch",
         "Always a minimum non-zero entry price."),
        ("Fair Averaging",
         "Cost = avg(price_before, price_after) × qty",
         "No single-block front-running advantage."),
        ("Auto-Graduation",
         "Triggers at 1,283 APT raised",
         "Token moves to live DEX pool automatically."),
    ]
    py_start = H - 1.6*inch
    for i, (title, formula, note) in enumerate(points):
        py = py_start - i * 1.3*inch
        rect(c, right_x, py - 1.1*inch, W - right_x - 0.45*inch, 1.05*inch,
             fill=CARD_BG, radius=8)
        rect(c, right_x, py - 1.1*inch, 0.04*inch, 1.05*inch, fill=ACCENT)
        text(c, title, right_x + 0.2*inch, py - 0.38*inch,
             font="MontB", size=11, color=DARK_BG)
        text(c, formula, right_x + 0.2*inch, py - 0.62*inch,
             font="Mont", size=8.5, color=HexColor("#5a6a7a"))
        text(c, note, right_x + 0.2*inch, py - 0.85*inch,
             font="MontL", size=8.5, color=TEXT_MED)

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 8)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — SMART CONTRACT ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════════════════
def slide_smart_contract(c):
    slide_bg(c, DARK_BG)
    dot_grid(c, 0.2*inch, 0.2*inch, cols=30, rows=18, spacing=22, color=ACCENT, alpha=0.025)

    text(c, "ARCHITECTURE", W/2, H - 0.68*inch, font="MontSB", size=8,
         color=ACCENT, align="center")
    text(c, "Smart Contract Architecture", W/2, H - 1.12*inch,
         font="MontEB", size=28, color=WHITE, align="center")
    rect(c, W/2 - 1.85*inch, H - 1.22*inch, 3.7*inch, 0.045*inch, fill=ACCENT)

    # Architecture diagram — layered boxes

    # Layer 1: User
    user_x = W/2 - 0.7*inch
    user_y = H - 1.7*inch
    user_w = 1.4*inch
    user_h = 0.45*inch
    rect(c, user_x, user_y - user_h, user_w, user_h, fill=PANEL, radius=6)
    text(c, "👤  User Wallet (Aptos)", user_x + user_w/2, user_y - user_h*0.42,
         font="MontSB", size=9.5, color=WHITE, align="center")

    # Arrow down
    draw_arrow(c, W/2, user_y - user_h - 0.01*inch, W/2, user_y - user_h - 0.42*inch,
               color=ACCENT, width=1.5, head=6)

    # Layer 2: Entry functions
    ef_y = user_y - user_h - 0.42*inch
    ef_w = 4.8*inch
    ef_h = 0.52*inch
    ef_x = W/2 - ef_w/2
    rect(c, ef_x, ef_y - ef_h, ef_w, ef_h, fill=DARK_CARD, radius=8)
    rect(c, ef_x, ef_y - ef_h, ef_w, 0.045*inch, fill=ACCENT)
    text(c, "Entry Functions  ·  create_token()   buy_tokens()   sell_tokens()",
         ef_x + ef_w/2, ef_y - ef_h*0.52,
         font="Mont", size=9, color=HexColor("#8ab0b0"), align="center")

    # Arrow down
    draw_arrow(c, W/2, ef_y - ef_h - 0.01*inch, W/2, ef_y - ef_h - 0.4*inch,
               color=ACCENT, width=1.5, head=6)

    # Layer 3: Core modules side by side
    mod_y = ef_y - ef_h - 0.4*inch
    modules = [
        ("ModuleState\n(Global)", "Token registry\nLiquidity pools\nDEX pools"),
        ("TokenVault\n(Per Token)", "Supply & price\nBonding state\nGraduation flag"),
        ("BuyerStore\n(Per User)", "Token holdings\nFungible stores\nBalance tracking"),
    ]
    mod_count = len(modules)
    mod_w = 2.1*inch
    mod_h = 1.4*inch
    mod_gap = 0.2*inch
    total_mod_w = mod_count*(mod_w + mod_gap) - mod_gap
    mod_sx = W/2 - total_mod_w/2

    for i, (title, desc) in enumerate(modules):
        mx = mod_sx + i*(mod_w + mod_gap)
        my = mod_y - mod_h
        rect(c, mx, my, mod_w, mod_h, fill=PANEL, radius=8)
        rect(c, mx, my + mod_h - 0.04*inch, mod_w, 0.04*inch, fill=ACCENT)
        t_lines = title.split("\n")
        text(c, t_lines[0], mx + mod_w/2, my + mod_h - 0.4*inch,
             font="MontSB", size=11, color=WHITE, align="center")
        if len(t_lines) > 1:
            text(c, t_lines[1], mx + mod_w/2, my + mod_h - 0.58*inch,
                 font="Mont", size=8, color=ACCENT, align="center")
        d_lines = desc.split("\n")
        for li, ln in enumerate(d_lines):
            text(c, f"• {ln}", mx + 0.22*inch, my + mod_h - 0.85*inch - li*0.2*inch,
                 font="MontL", size=9, color=HexColor("#8ab0b0"))

    # Arrow down
    draw_arrow(c, W/2, mod_y - mod_h - 0.01*inch, W/2, mod_y - mod_h - 0.38*inch,
               color=ACCENT, width=1.5, head=6)

    # Layer 4: Aptos framework
    fw_y = mod_y - mod_h - 0.38*inch
    fw_w = 5.5*inch
    fw_h = 0.52*inch
    fw_x = W/2 - fw_w/2
    rect(c, fw_x, fw_y - fw_h, fw_w, fw_h, fill=HexColor("#0a1515"), radius=8)
    rect(c, fw_x, fw_y - 0.045*inch, fw_w, 0.045*inch, fill=HexColor("#4dabf7"))
    text(c, "Aptos Framework  ·  Fungible Assets  ·  Move VM  ·  Testnet",
         fw_x + fw_w/2, fw_y - fw_h*0.52,
         font="Mont", size=9, color=HexColor("#4dabf7"), align="center")

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 9)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — PRODUCT EXPERIENCE / UI MOCKUP
# ═══════════════════════════════════════════════════════════════════════════════
def slide_ui_mockup(c):
    slide_bg(c, WHITE)

    rect(c, 0, H - 1.35*inch, W, 1.35*inch, fill=DARK_BG)
    text(c, "PRODUCT EXPERIENCE", 0.55*inch, H - 0.65*inch, font="MontSB", size=8, color=ACCENT)
    text(c, "Built for traders. Designed for clarity.", 0.55*inch, H - 1.1*inch,
         font="MontEB", size=26, color=WHITE)

    # Draw UI mockup panels
    # Left: Marketplace list panel
    lp_x = 0.45*inch
    lp_y = 0.4*inch
    lp_w = W*0.38
    lp_h = H - 1.65*inch

    rect(c, lp_x, lp_y, lp_w, lp_h, fill=DARK_BG, radius=12)

    # Nav bar mock
    rect(c, lp_x, lp_y + lp_h - 0.4*inch, lp_w, 0.4*inch, fill=DARK_CARD, radius=12)
    text(c, "MoveMint", lp_x + 0.2*inch, lp_y + lp_h - 0.27*inch,
         font="MontB", size=12, color=ACCENT)
    text(c, "● Live", lp_x + lp_w - 0.85*inch, lp_y + lp_h - 0.27*inch,
         font="Mont", size=9, color=ACCENT)

    # Search bar
    rect(c, lp_x + 0.18*inch, lp_y + lp_h - 0.75*inch, lp_w - 0.36*inch, 0.28*inch,
         fill=PANEL, radius=14)
    text(c, "🔍  Search tokens...", lp_x + 0.36*inch, lp_y + lp_h - 0.65*inch,
         font="Mont", size=8.5, color=MID_GREY)

    # Token list items
    mock_tokens = [
        ("PEPE", "PepeCoin", "+142%", True),
        ("DOGE2", "Doge2Aptos", "+38%", False),
        ("MOON", "MoonShot", "+91%", True),
        ("APE", "ApeToken", "-12%", False),
        ("CHAD", "ChadCoin", "+267%", True),
    ]
    item_h = 0.5*inch
    item_y = lp_y + lp_h - 1.12*inch

    for ticker, name, change, is_up in mock_tokens:
        change_color = ACCENT if is_up else HexColor("#ff6b6b")
        rect(c, lp_x + 0.12*inch, item_y - item_h + 0.06*inch,
             lp_w - 0.24*inch, item_h - 0.08*inch, fill=DARK_CARD, radius=6)
        # avatar circle
        c.setFillColor(PANEL)
        c.circle(lp_x + 0.38*inch, item_y - item_h/2 + 0.05*inch, 0.14*inch, fill=1, stroke=0)
        text(c, ticker[0], lp_x + 0.38*inch, item_y - item_h/2 - 0.01*inch,
             font="MontB", size=8, color=ACCENT, align="center")
        text(c, ticker, lp_x + 0.58*inch, item_y - item_h/2 + 0.1*inch,
             font="MontSB", size=10, color=WHITE)
        text(c, name, lp_x + 0.58*inch, item_y - item_h/2 - 0.1*inch,
             font="MontL", size=7.5, color=MID_GREY)
        text(c, change, lp_x + lp_w - 0.65*inch, item_y - item_h/2 + 0.05*inch,
             font="MontB", size=10, color=change_color, align="right")
        item_y -= item_h

    # Right panel: Trading interface
    rp_x = lp_x + lp_w + 0.25*inch
    rp_y = lp_y
    rp_w = W - rp_x - 0.45*inch
    rp_h = lp_h

    rect(c, rp_x, rp_y, rp_w, rp_h, fill=DARK_BG, radius=12)

    # Token header
    rect(c, rp_x, rp_y + rp_h - 0.5*inch, rp_w, 0.5*inch, fill=DARK_CARD, radius=12)
    c.setFillColor(ACCENT)
    c.circle(rp_x + 0.42*inch, rp_y + rp_h - 0.25*inch, 0.16*inch, fill=1, stroke=0)
    text(c, "PEPE", rp_x + 0.66*inch, rp_y + rp_h - 0.2*inch,
         font="MontB", size=13, color=WHITE)
    tag_pill(c, "Bonding Curve", rp_x + rp_w - 1.4*inch, rp_y + rp_h - 0.38*inch,
             bg=PANEL, fg=ACCENT, size=7)

    # Mini chart area
    chart_x = rp_x + 0.18*inch
    chart_y = rp_y + rp_h - 2.0*inch
    chart_w = rp_w - 0.36*inch
    chart_h = 1.3*inch
    rect(c, chart_x, chart_y, chart_w, chart_h, fill=HexColor("#0e1e1e"), radius=6)
    # Draw mini bonding curve
    c.saveState()
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.5)
    path = c.beginPath()
    for i in range(40):
        frac = i / 39
        px2 = chart_x + frac * chart_w
        p = 1/(1 - frac*0.8)
        py2 = chart_y + 0.12*inch + (p - 1)/4 * (chart_h - 0.24*inch)
        py2 = min(py2, chart_y + chart_h - 0.08*inch)
        if i == 0: path.moveTo(px2, py2)
        else:      path.lineTo(px2, py2)
    c.drawPath(path, fill=0, stroke=1)
    c.restoreState()
    text(c, "Price History  ·  24h", chart_x + 0.12*inch, chart_y + chart_h - 0.2*inch,
         font="Mont", size=7.5, color=MID_GREY)

    # Buy / sell tabs
    tab_y = rp_y + rp_h - 2.22*inch
    tab_h = 0.28*inch
    rect(c, rp_x + 0.18*inch, tab_y - tab_h, rp_w*0.45, tab_h, fill=ACCENT, radius=6)
    text(c, "BUY", rp_x + 0.18*inch + rp_w*0.225, tab_y - tab_h*0.42,
         font="MontB", size=10, color=DARK_BG, align="center")
    rect(c, rp_x + 0.18*inch + rp_w*0.45 + 0.06*inch, tab_y - tab_h,
         rp_w*0.45, tab_h, fill=PANEL, radius=6)
    text(c, "SELL", rp_x + 0.18*inch + rp_w*0.45 + 0.06*inch + rp_w*0.225,
         tab_y - tab_h*0.42, font="MontB", size=10, color=MID_GREY, align="center")

    # Amount input
    inp_y = tab_y - tab_h - 0.2*inch
    inp_h = 0.35*inch
    inp_w = rp_w - 0.36*inch
    rect(c, rp_x + 0.18*inch, inp_y - inp_h, inp_w, inp_h, fill=PANEL, radius=6)
    text(c, "Amount (APT)", rp_x + 0.32*inch, inp_y - inp_h + 0.24*inch,
         font="Mont", size=7.5, color=MID_GREY)
    text(c, "1.00", rp_x + 0.32*inch, inp_y - inp_h + 0.08*inch,
         font="MontSB", size=11, color=WHITE)

    # Slippage
    sl_y = inp_y - inp_h - 0.15*inch
    text(c, "Max Slippage:", rp_x + 0.22*inch, sl_y - 0.05*inch,
         font="Mont", size=8, color=MID_GREY)
    for si, sv in enumerate(["1%", "3%", "5%"]):
        sx2 = rp_x + 1.2*inch + si*0.5*inch
        pill_fill = ACCENT if si == 1 else PANEL
        pill_fg = DARK_BG if si == 1 else MID_GREY
        rect(c, sx2, sl_y - 0.22*inch, 0.38*inch, 0.22*inch,
             fill=pill_fill, radius=4)
        text(c, sv, sx2 + 0.19*inch, sl_y - 0.12*inch,
             font="MontSB", size=8, color=pill_fg, align="center")

    # Confirm button
    btn_y = sl_y - 0.48*inch
    btn_h = 0.38*inch
    btn_w = rp_w - 0.36*inch
    rect(c, rp_x + 0.18*inch, btn_y - btn_h, btn_w, btn_h, fill=ACCENT, radius=8)
    text(c, "Confirm Purchase", rp_x + 0.18*inch + btn_w/2, btn_y - btn_h*0.42,
         font="MontB", size=11, color=DARK_BG, align="center")

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 10)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — COMPETITIVE LANDSCAPE
# ═══════════════════════════════════════════════════════════════════════════════
def slide_competitive(c):
    slide_bg(c, WHITE)

    rect(c, 0, H - 1.35*inch, W, 1.35*inch, fill=DARK_BG)
    text(c, "COMPETITIVE LANDSCAPE", 0.55*inch, H - 0.65*inch,
         font="MontSB", size=8, color=ACCENT)
    text(c, "Where does MoveMint stand?", 0.55*inch, H - 1.1*inch,
         font="MontEB", size=26, color=WHITE)

    # Comparison table
    features = [
        "Fair Launch (Bonding Curve)",
        "No Pre-sales / Insider Allocation",
        "Auto-Graduation to DEX",
        "Locked Liquidity at Launch",
        "Move Language (Safer VM)",
        "Low Fees (< 1%)",
        "Multi-wallet Support",
        "Real-time Price Charts",
    ]

    competitors = [
        ("MoveMint",  ACCENT,               [True,  True,  True,  True,  True,  True,  True,  True ]),
        ("Pump.fun",  HexColor("#a78bfa"),   [True,  True,  True,  False, False, True,  False, False]),
        ("Moonshot",  HexColor("#60a5fa"),   [False, False, False, False, False, True,  True,  True ]),
        ("4.meme",    HexColor("#f97316"),   [True,  True,  False, False, False, True,  False, True ]),
    ]

    table_x = 0.5*inch
    table_y = H - 1.6*inch
    col0_w = 2.55*inch  # feature label width
    col_w = (W - table_x - col0_w - 0.4*inch) / len(competitors)
    row_h = 0.48*inch

    # Header row
    for ci, (name, color, _) in enumerate(competitors):
        hx = table_x + col0_w + ci*col_w
        rect(c, hx + 0.05*inch, table_y - 0.42*inch, col_w - 0.1*inch, 0.42*inch,
             fill=color, radius=6)
        text(c, name, hx + col_w/2, table_y - 0.26*inch,
             font="MontB", size=10, color=DARK_BG if ci == 0 else WHITE, align="center")

    # Feature rows
    for ri, feat in enumerate(features):
        ry = table_y - 0.55*inch - ri*row_h
        row_bg = CARD_BG if ri % 2 == 0 else WHITE
        rect(c, table_x, ry - row_h + 0.05*inch, W - table_x - 0.4*inch, row_h - 0.05*inch,
             fill=row_bg, radius=0)
        text(c, feat, table_x + 0.15*inch, ry - row_h*0.42,
             font="Mont", size=9.5, color=TEXT_DARK)
        for ci, (_, _, checks) in enumerate(competitors):
            cx2 = table_x + col0_w + ci*col_w + col_w/2
            cy2 = ry - row_h*0.5
            if checks[ri]:
                c.setFillColor(ACCENT if ci == 0 else PANEL)
                c.circle(cx2, cy2, 7.5, fill=1, stroke=0)
                c.setFillColor(DARK_BG if ci == 0 else WHITE)
                c.setFont("MontB", 10)
                c.drawCentredString(cx2, cy2 - 3.5, "✓")
            else:
                c.setFillColor(LIGHT_GREY)
                c.circle(cx2, cy2, 7.5, fill=1, stroke=0)
                c.setFillColor(MID_GREY)
                c.setFont("MontB", 10)
                c.drawCentredString(cx2, cy2 - 3.5, "·")

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 11)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — WHY APTOS
# ═══════════════════════════════════════════════════════════════════════════════
def slide_why_aptos(c):
    slide_bg(c, DARK_BG)
    dot_grid(c, 0.2*inch, 0.2*inch, cols=30, rows=18, spacing=22, color=ACCENT, alpha=0.03)

    text(c, "BLOCKCHAIN", W/2, H - 0.68*inch, font="MontSB", size=8,
         color=ACCENT, align="center")
    text(c, "Why Aptos?", W/2, H - 1.12*inch,
         font="MontEB", size=34, color=WHITE, align="center")
    rect(c, W/2 - 0.9*inch, H - 1.22*inch, 1.8*inch, 0.045*inch, fill=ACCENT)

    reasons = [
        ("⚡", "Sub-Second Finality",
         "160,000+ TPS with Block-STM parallel execution.\nTransactions confirm in < 1 second."),
        ("🔐", "Move Language",
         "Resource-oriented programming prevents\nreentrancy, overflow, and asset duplication."),
        ("💰", "Growing DeFi Ecosystem",
         "Aptos DeFi TVL grew 400% in 2024.\nHyperion, Liquidswap, and Echelon leading."),
        ("🌱", "Underserved Memecoin Market",
         "Minimal memecoin infrastructure on Aptos.\nFirst-mover advantage for a launchpad."),
        ("🤝", "Foundation Support",
         "Aptos Foundation actively funds ecosystem\nbuilders with grants up to $500K."),
        ("📱", "Consumer App Focus",
         "Aptos increasingly targets consumer apps\nwith mobile-first developer tooling."),
    ]

    cols = 3
    rw = (W - 1.3*inch) / cols
    rh = (H - 1.65*inch - 0.35*inch) / 2
    sx = 0.55*inch
    sy = H - 1.55*inch

    for i, (icon, title, desc) in enumerate(reasons):
        col = i % cols
        row = i // cols
        x = sx + col*(rw + 0.1*inch)
        y = sy - row*(rh + 0.15*inch) - rh
        rect(c, x, y, rw - 0.1*inch, rh, fill=DARK_CARD, radius=10)
        rect(c, x, y + rh - 0.04*inch, rw - 0.1*inch, 0.04*inch, fill=ACCENT)
        text(c, title, x + 0.2*inch, y + rh - 0.42*inch,
             font="MontSB", size=11, color=WHITE)
        lines = desc.split("\n")
        for li, ln in enumerate(lines):
            text(c, ln, x + 0.2*inch, y + rh - 0.68*inch - li*0.19*inch,
                 font="MontL", size=8.5, color=HexColor("#8ab0b0"))

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 12)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 13 — FUTURE POSSIBILITIES
# ═══════════════════════════════════════════════════════════════════════════════
def slide_future(c):
    slide_bg(c, WHITE)

    # Left accent strip
    rect(c, 0, 0, 0.055*inch, H, fill=ACCENT)

    accent_bar(c, y=H - 1.12*inch, x=0.55*inch)
    text(c, "ROADMAP", 0.55*inch, H - 0.85*inch, font="MontSB", size=8, color=MID_GREY)
    text(c, "What comes next.", 0.55*inch, H - 1.38*inch,
         font="MontEB", size=34, color=DARK_BG)

    # Timeline — horizontal phases
    phases = [
        ("Phase 1", "Foundation",
         ["✓ Bonding curve contract", "✓ Token creation", "✓ Aptos testnet launch",
          "✓ Basic trading UI", "✓ Wallet integrations"],
         HexColor("#00cc7a"), True),
        ("Phase 2", "Growth",
         ["◎ Mainnet deployment", "◎ Mobile-optimized UI", "◎ Social profiles",
          "◎ Creator analytics", "◎ Referral rewards"],
         ACCENT, False),
        ("Phase 3", "Ecosystem",
         ["○ Cross-chain bridges", "○ DAO governance", "○ API for bots & tools",
          "○ Token launchpad SDK", "○ Community token voting"],
         MID_GREY, False),
    ]

    ph_w = (W - 1.5*inch) / len(phases)
    ph_x = 0.65*inch
    ph_y = H*0.12
    ph_h = H - 1.7*inch - ph_y

    # Timeline bar
    tl_y = H - 1.85*inch
    c.setStrokeColor(LIGHT_GREY)
    c.setLineWidth(2)
    c.line(ph_x + 0.2*inch, tl_y, ph_x + ph_w*len(phases) - 0.2*inch, tl_y)

    for i, (phase_label, phase_name, items, color, done) in enumerate(phases):
        x = ph_x + i*ph_w
        y = ph_y

        # Card
        card_w = ph_w - 0.2*inch
        card_h = ph_h
        rect(c, x, y, card_w, card_h, fill=CARD_BG if not done else HexColor("#f0fff8"), radius=10)
        rect(c, x, y + card_h - 0.04*inch, card_w, 0.04*inch, fill=color)

        # Timeline dot
        dot_x = x + card_w/2
        c.setFillColor(color)
        c.circle(dot_x, tl_y, 7, fill=1, stroke=0)

        # Phase label
        text(c, phase_label, x + card_w/2, y + card_h - 0.42*inch,
             font="MontSB", size=9, color=color, align="center")
        text(c, phase_name, x + card_w/2, y + card_h - 0.65*inch,
             font="MontEB", size=15, color=DARK_BG, align="center")

        thin_line(c, x + 0.18*inch, y + card_h - 0.82*inch,
                  x + card_w - 0.18*inch, y + card_h - 0.82*inch,
                  color=LIGHT_GREY)

        for li, item in enumerate(items):
            item_color = ACCENT_DIM if done else (TEXT_MED if i == 1 else MID_GREY)
            text(c, item, x + 0.22*inch, y + card_h - 1.08*inch - li*0.33*inch,
                 font="Mont", size=9, color=item_color)

    rect(c, 0, 0, W, 0.04*inch, fill=ACCENT)
    slide_number(c, 13)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 14 — KEY TAKEAWAYS
# ═══════════════════════════════════════════════════════════════════════════════
def slide_takeaways(c):
    slide_bg(c, DARK_BG)
    dot_grid(c, 0.2*inch, 0.2*inch, cols=30, rows=18, spacing=22, color=ACCENT, alpha=0.04)

    # Bottom accent bar
    rect(c, 0, 0, W, 0.055*inch, fill=ACCENT)

    text(c, "KEY TAKEAWAYS", W/2, H - 0.68*inch, font="MontSB", size=8,
         color=ACCENT, align="center")
    text(c, "Why MoveMint matters.", W/2, H - 1.12*inch,
         font="MontEB", size=32, color=WHITE, align="center")
    rect(c, W/2 - 1.62*inch, H - 1.22*inch, 3.24*inch, 0.045*inch, fill=ACCENT)

    takeaways = [
        ("Market Timing",
         "Memecoins are not a fad — they're a permanent feature of crypto culture. "
         "The infrastructure race is just beginning."),
        ("Fair Launch Economics",
         "Bonding curves eliminate insider advantage. "
         "MoveMint makes price discovery transparent and manipulation-resistant."),
        ("Aptos Advantage",
         "Aptos offers speed, safety, and an underserved audience. "
         "MoveMint is positioned as the first serious memecoin launchpad on the chain."),
        ("Composable Architecture",
         "Move smart contracts, auto-graduation, and locked liquidity combine into "
         "a trustless, fully on-chain product."),
    ]

    ta_w = (W - 1.3*inch) / 2
    ta_h = (H - 1.65*inch - 0.35*inch) / 2
    sx = 0.55*inch
    sy = H - 1.55*inch

    number_colors = [ACCENT, HexColor("#4dabf7"), HexColor("#a78bfa"), HexColor("#ff6b6b")]

    for i, (title, body) in enumerate(takeaways):
        col = i % 2
        row = i // 2
        x = sx + col*(ta_w + 0.2*inch)
        y = sy - row*(ta_h + 0.18*inch) - ta_h

        rect(c, x, y, ta_w - 0.1*inch, ta_h, fill=DARK_CARD, radius=10)

        num_color = number_colors[i]
        rect(c, x, y + ta_h - 0.04*inch, ta_w - 0.1*inch, 0.04*inch, fill=num_color)

        text(c, f"0{i+1}", x + 0.22*inch, y + ta_h - 0.44*inch,
             font="MontEB", size=22, color=num_color)
        text(c, title, x + 0.22*inch, y + ta_h - 0.68*inch,
             font="MontSB", size=13, color=WHITE)

        # Wrap body text
        words = body.split()
        lines = []
        current = []
        for w in words:
            test_line = " ".join(current + [w])
            if pdfmetrics.stringWidth(test_line, "MontL", 9.5) > ta_w - 0.5*inch:
                lines.append(" ".join(current))
                current = [w]
            else:
                current.append(w)
        if current:
            lines.append(" ".join(current))

        for li, ln in enumerate(lines[:3]):
            text(c, ln, x + 0.22*inch, y + ta_h - 0.92*inch - li*0.2*inch,
                 font="MontL", size=9.5, color=HexColor("#8ab0b0"))

    # Footer
    text(c, "MoveMint  ·  Aptos Testnet  ·  2024  ·  github.com/movemint",
         W/2, 0.18*inch, font="Mont", size=8, color=MID_GREY, align="center")

    slide_number(c, 14)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN — ASSEMBLE PDF
# ═══════════════════════════════════════════════════════════════════════════════
def build_pdf(output_path):
    c = canvas.Canvas(output_path, pagesize=(W, H))
    c.setTitle("MoveMint — Memecoin Launchpad on Aptos")
    c.setAuthor("MoveMint")
    c.setSubject("Product Presentation Deck")

    slides = [
        slide_title,
        slide_rise_of_memecoins,
        slide_problems,
        slide_opportunity,
        slide_intro_movemint,
        slide_product_overview,
        slide_token_launch_flow,
        slide_bonding_curve,
        slide_smart_contract,
        slide_ui_mockup,
        slide_competitive,
        slide_why_aptos,
        slide_future,
        slide_takeaways,
    ]

    for i, slide_fn in enumerate(slides):
        print(f"  Rendering slide {i+1}/{len(slides)}: {slide_fn.__name__}")
        slide_fn(c)
        c.showPage()

    c.save()
    print(f"\n✅  PDF saved to: {output_path}")


if __name__ == "__main__":
    out = "/tmp/movemint_presentation_deck.pdf"
    build_pdf(out)
    import os
    size = os.path.getsize(out)
    print(f"   File size: {size/1024:.1f} KB")
