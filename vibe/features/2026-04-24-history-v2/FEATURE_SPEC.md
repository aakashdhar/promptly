# FEATURE-020 — History Panel v2

## Problem
The history panel shows prompts but gives no way to mark favourites, filter
by quality, or understand which modes and structures produce the best results.
Users have no way to quickly find their best prompts.

## Solution
Four additions to the existing history panel:
1. Bookmarks — save/unsave any prompt, separate Saved tab
2. Ratings — thumbs up/down + one-tap quality tag per prompt
3. Filters — filter list by rating status
4. Stats — prompt count + rating percentage summary

## Visual design — implement exactly as specified

### Left panel additions:

TAB SWITCHER — two tabs at top of left panel:
  Container: display flex, padding 12px 12px 0, gap 4px
  Each tab: flex:1, height 28px, border-radius 8px, cursor pointer

  All tab (active state):
    background: rgba(10,132,255,0.12)
    border: 0.5px solid rgba(10,132,255,0.25)
    font-size 11px, font-weight 500, color rgba(100,180,255,0.9)

  All tab (inactive state):
    background: rgba(255,255,255,0.04)
    border: 0.5px solid rgba(255,255,255,0.08)
    font-size 11px, color rgba(255,255,255,0.35)

  Saved tab (active state):
    background: rgba(255,189,46,0.12)
    border: 0.5px solid rgba(255,189,46,0.28)
    font-size 11px, font-weight 500, color rgba(255,189,46,0.9)
    Shows bookmark SVG icon before label

  Saved tab (inactive state):
    background: rgba(255,255,255,0.04)
    border: 0.5px solid rgba(255,255,255,0.08)
    color rgba(255,255,255,0.35)
    Shows bookmark SVG icon before label (dimmed)

  Bookmark SVG icon (10x13 viewBox 0 0 10 13):
  <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z" stroke-width="1.2" stroke-linejoin="round"/>
  Fill + stroke when active tab: rgba(255,189,46,0.85)
  Fill + stroke when inactive: rgba(255,255,255,0.3) fill none, stroke only

FILTER CHIPS — below tab switcher:
  Container: display flex, gap 4px, padding 10px 12px, flex-wrap wrap

  All chip (active):
    padding 2px 8px, border-radius 20px, font-size 9px, font-weight 600
    background rgba(255,255,255,0.08), border 0.5px solid rgba(255,255,255,0.14)
    color rgba(255,255,255,0.55)

  👍 chip (inactive default):
    background rgba(255,255,255,0.04), border 0.5px solid rgba(255,255,255,0.08)
    color rgba(255,255,255,0.3)
  👍 chip (active):
    background rgba(48,209,88,0.10), border 0.5px solid rgba(48,209,88,0.25)
    color rgba(100,220,130,0.8)

  👎 chip (inactive/active same pattern with rgba(255,59,48) colours)

  Unrated chip: same inactive pattern as 👍 inactive

STATS BAR — below filter chips:
  Container: margin 0 12px 10px, padding 8px 10px
  background rgba(255,255,255,0.03), border 0.5px solid rgba(255,255,255,0.06)
  border-radius 8px, display flex, justify-content space-between, align-items center

  Left: "{n} prompts" — font-size 10px, color rgba(255,255,255,0.3)
  Right: "👍 {x}%" divider "👎 {y}%" — font-size 10px
    👍 percentage: color rgba(100,220,130,0.7)
    divider: width 0.5px, height 10px, background rgba(255,255,255,0.1)
    👎 percentage: color rgba(255,100,90,0.65)
  Only show if at least 1 rated prompt exists, otherwise show just count

ENTRY LIST — bookmark icon in entries:
  Bookmarked entries show filled amber bookmark SVG top-right of entry
  (same SVG as tab, fill rgba(255,189,46,0.8), stroke rgba(255,189,46,0.8))
  Position absolute top 10px right 12px on entry container
  Entry container needs position relative

  Rated entries show rating emoji alongside bookmark:
    Both bookmark + emoji: gap 4px flex row
    Just emoji: same position top-right

  Tag pill in meta row:
    Thumbs up tag: background rgba(48,209,88,0.08), border rgba(48,209,88,0.2), color rgba(100,220,130,0.7)
    Thumbs down tag: background rgba(255,59,48,0.08), border rgba(255,59,48,0.2), color rgba(255,100,90,0.7)
    font-size 9px, padding 1px 5px, border-radius 4px

FOOTER — update to show saved count:
  "{n} prompts · {m} saved" — font-size 10px, color rgba(255,255,255,0.2)
  Only show "· {m} saved" if m > 0

### Right panel additions:

BOOKMARK TOGGLE — top right of You said section:
  Unsaved state:
    padding 3px 8px, border-radius 6px, cursor pointer, display flex, gap 5px
    background rgba(255,255,255,0.04), border 0.5px solid rgba(255,255,255,0.08)
    SVG stroke only (no fill): rgba(255,255,255,0.3)
    label "Save" — font-size 10px, color rgba(255,255,255,0.35)

  Saved state:
    background rgba(255,189,46,0.10), border 0.5px solid rgba(255,189,46,0.25)
    SVG fill + stroke: rgba(255,189,46,0.8)
    label "Saved" — font-size 10px, color rgba(255,189,46,0.8), font-weight 500

RATING SECTION — below prompt content, above action buttons:
  Container: border-top 0.5px solid rgba(255,255,255,0.06), padding 12px 22px, flex-shrink 0

  Label row: display flex, justify-content space-between, align-items center, margin-bottom 10px
    Left label: "RATE THIS PROMPT" — font-size 10px, font-weight 600, letter-spacing .06em,
      uppercase, color rgba(255,255,255,0.22)
    Right: two thumb buttons

  Thumbs up button:
    width 30px, height 30px, border-radius 8px, font-size 14px
    Inactive: background rgba(255,255,255,0.04), border 0.5px solid rgba(255,255,255,0.1)
    Active: background rgba(48,209,88,0.15), border 0.5px solid rgba(48,209,88,0.35)

  Thumbs down button:
    Same dimensions
    Inactive: same as thumbs up inactive
    Active: background rgba(255,59,48,0.15), border 0.5px solid rgba(255,59,48,0.35)

  Tag chips — appear after rating (display none when no rating):
    Container: display flex, gap 6px, flex-wrap wrap

    Tag active (positive — Perfect, Clear, Detailed):
      background rgba(48,209,88,0.12), border 0.5px solid rgba(48,209,88,0.3)
      color rgba(100,220,130,0.85), font-weight 500

    Tag active (negative — Too long):
      background rgba(255,59,48,0.10), border 0.5px solid rgba(255,59,48,0.3)
      color rgba(255,100,90,0.85), font-weight 500

    Tag inactive (all):
      background rgba(255,255,255,0.04), border 0.5px solid rgba(255,255,255,0.08)
      color rgba(255,255,255,0.35), font-weight 400

    All tags: padding 3px 10px, border-radius 6px, font-size 10px, cursor pointer

## Acceptance criteria
- [ ] Tab switcher shows All and Saved tabs
- [ ] All tab shows all entries with filter chips and stats
- [ ] Saved tab shows only bookmarked entries
- [ ] Filter chips: All, 👍, 👎, Unrated — filter list in real time
- [ ] Stats bar shows prompt count + rating percentages
- [ ] Bookmark button in right panel toggles save state
- [ ] Bookmarked entries show filled amber bookmark icon in list
- [ ] Bookmark persists in localStorage
- [ ] Rating section shows at bottom of right panel
- [ ] 👍 tapped — green highlight, tag chips appear
- [ ] 👎 tapped — red highlight, tag chips appear
- [ ] Tag tapped — highlights in matching colour, single select
- [ ] Tapping active tag deselects it
- [ ] Tapping opposite thumb switches rating and clears tag
- [ ] Rating + tag + bookmark persist in localStorage
- [ ] Rated entries show emoji top-right in list
- [ ] Thumbs down entries show tag as pill in meta row
- [ ] Footer shows "{n} prompts · {m} saved"
- [ ] Clear all removes ratings, bookmarks and entries together
- [ ] Saved tab empty state: "No saved prompts yet"

## Files in scope
- src/renderer/utils/history.js
- src/renderer/components/HistoryPanel.jsx

## Files out of scope
All other files
