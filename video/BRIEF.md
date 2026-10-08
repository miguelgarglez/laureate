---
flow: product-launch
length: 25-35s
resolution: 1080x1080 (square)
narration: none — works muted, on-screen text carries the story
music: none (silent film; must read without sound)
audience: builders and design-minded people on X/Twitter
tone: ceremonial, dry wit, engraved-letterpress elegance
---

# Laureate — launch video brief

**Product:** Laureate — "Mint a Nobel-grade medal and diploma for extremely
specific achievements." A browser toy: type an absurd deed, pick a field of
merit, press MINT, watch a coin press strike a gold medal, spin it, get a
diploma and a shareable link. Live at https://laureate-ivory.vercel.app

**Source of truth:** the running app at http://localhost:4173 — capture the
real UI, never mockups.

**Brand:** deep-green baize/near-black backdrop, parchment paper, gold leaf,
wax-seal red. Type: IM Fell English SC (small-caps display), IM Fell English
(display italic), EB Garamond (body). Motion language: heavy, deliberate,
ceremonial — press descends, light pools, paper unfurls.

**Story (follows the first-run guide, reuses it as script):**
1. Hook (0-2.5s): the gold medal fills frame, slowly rotating — "For extremely
   specific achievements."
2. The deed (2.5-8s): petition card, a deed being typed — "name the deed"
   → "exemplary silence in a meeting that could have been an email"
3. The field (8-11s): wax seals grid, one pressed — "choose the field of merit"
4. The strike (11-19s): SIGNATURE MOMENT — press cocks, light pools on the
   planchet, die falls, relief catches light — "the Committee deliberates"
5. The award (19-26s): medal lifts on its ribbon, spins; diploma unfurls —
   "struck. signed. sealed."
6. End (26-32s): medal + diploma settle — "laureate-ivory.vercel.app —
   mint yours"

**Constraints:** deterministic, no narration track, no BGM (music: none),
every beat readable on a phone muted. Real footage via Playwright capture at
2x. Transitions grow from the product's own motion (unfurl, strike, sweep).
