# Skillnet

A zoomable neon map of hobbies and skills. 24 districts of hex tiles surround a central hub;
scroll into any hobby and its beginner-to-master skill tree appears inside its tile. Track what
you learn as XP and levels.

Built with Vite, Svelte 5 and three.js (as a 2D WebGL renderer). It's a static site with no
backend: progress is saved in the browser.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script            | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `npm run dev`     | Validates content, then starts the dev server                       |
| `npm run build`   | Validates content strictly (fails on errors), then builds to `dist/` |
| `npm run preview` | Serves the built `dist/` folder                                     |
| `npm run check`   | Type-checks TypeScript and Svelte                                   |
| `npm run content` | Validates content and regenerates the index files only              |

`dist/` is a plain static site with relative paths, so it can be deployed as-is to
GitHub Pages, Netlify, Vercel or any static host, including under a subpath.

## Using it

- **Scroll to zoom, drag to pan** (pinch on touch; `+` / `-` keys; `0` for the whole map). Zoom is
  continuous: district names give way to hobby names, then each hobby's skill tree fades in,
  then tier headings and skill names.
- **Click to select.** Clicking a district, hobby or skill opens its panel and frames it. Esc steps the
  selection back up a level, and clicking empty space closes the panel. Scrolling never changes the selection.
- **Search** (`/` to focus) finds hobbies and individual skills, and lights up matches on the map.
- **Filters** narrow the map by start cost, time to competence, solo or social, setting, and what the hobby trains.
- **✦ Party tricks** highlights quick wins you can learn in under an hour and lists them all.
- **Level chip** (top right), or click the "YOU" hub: character sheet with export, import and reset.
- **Deep links:** `#/d/<domain>`, `#/h/<hobby>`, `#/h/<hobby>/<skill>`.

## Project layout

```
scripts/build-index.ts   Content validator; writes src/content/_meta.json + _search.json
src/content/             All content (see below)
src/lib/                 Data loading, hex maths, layouts, stores, search, progress (no rendering)
src/engine/              The map: hex tiles, district borders, in-tile skill trees, labels, 2D camera, picking
src/hud/                 Svelte overlay: header, panels, menus
src/styles/global.css    Theme tokens, label styles and shared HUD styles
```

The engine and HUD only talk through the Svelte stores in `src/lib/stores.ts`:
the HUD calls `nav.*`, and the engine reacts to `focus`.

Layout lives in `src/lib/layout.ts`. Districts are honeycombs sized to their hobby count, placed on
a macro hex lattice around the hub, with each group of eight domains in `domains.json` filling one
120° wedge. Within a district the most popular hobbies take the central tiles. Each skill tree is
laid out inside its tile: tiers run left to right, with circuit-style traces between prerequisites.
The semantic-zoom thresholds (tile height on screen) are the `Z` table in `src/engine/Engine.ts`.

## Content format

Everything lives in `src/content/`. Run `npm run content` after editing to validate it.

There are currently 1,000 hobbies across the 24 districts. Five of them have full skill trees
(juggling, card magic, lockpicking, chess and sourdough); the rest show as uncharted tiles until
their trees are written. The biggest district sets the spacing of the whole lattice: four rings
hold 61 hobbies, and a 62nd adds a ring and spreads every district out. Keep each domain at 61 or fewer.

- **`domains.json`**: the 24 domains in spiral-arm order (three arms of eight, innermost first).
  Each has an `id`, `name`, `color` and `blurb`.
- **`hobbies/<domainId>.json`**: an array of hobbies for that domain:

  ```jsonc
  {
    "id": "juggling",                 // kebab-case, unique across all domains
    "name": "Juggling",
    "pop": 5,                         // 1-5, how widely practised (star size, label priority)
    "summary": "One or two sentences.",
    "stats": {
      "difficulty": 2,                // 1-5
      "hours": 15,                    // rough hours to basic competence
      "cost": 1,                      // 0 free · 1 <$50 · 2 <$250 · 3 <$1k · 4 $1k+
      "gear": ["3 juggling beanbags"],
      "social": "either",             // solo | group | either
      "setting": "either",            // indoor | outdoor | either
      "focus": ["physical", "mental"] // any of physical | mental | creative
    },
    "tags": ["flow arts"],
    "synergies": ["diabolo", "poi"],  // hobby ids; ids not written yet are allowed (warning only)
    "partyTrick": true,               // optional: has quick, impressive wins
    "safety": "Optional safety or legal note."
  }
  ```

- **`trees/<hobbyId>.json`**: the full skill tree, `{ "hobby": "<id>", "nodes": [...] }`:

  ```jsonc
  {
    "id": "cascade",                 // kebab-case, unique within the tree
    "name": "Three-Ball Cascade",
    "tier": 1,                       // 1 Novice · 2 Apprentice · 3 Adept · 4 Expert · 5 Master
    "requires": ["exchange"],        // node ids in this tree, same or lower tier
    "summary": "What it is and why it matters.",
    "steps": ["How to learn it", "..."],   // at least 2
    "drills": ["Practice drills"],         // at least 1
    "mastery": "You've got it when ...",
    "hours": 6,
    "partyTrick": 45                 // optional: minutes to learn, marks a quick win (≤ 120)
  }
  ```

  A hobby is "charted" once its tree file exists. Without one, the hobby still shows on the map
  with its summary and stats.

The validator rejects duplicate ids, unknown or higher-tier prerequisites, prerequisite cycles and
missing fields. It warns about synergies pointing at hobbies that don't exist yet and tiers
with no nodes.

## Progress data

Saved in `localStorage` under `skillnet.progress.v1` as `{ "hobby/node": { s, xp, t } }`.
It stays in one browser, so use Export/Import in the character sheet to move it.
