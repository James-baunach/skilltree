# Skilltree

A thousand hobbies as browsable skill trees. Categories open into groups, and groups open into
hobbies. Each hobby opens in place to show its stats, the abilities it trains, its closest
hobbies and its full Novice-to-Master skill tree.

Built with Vite and Svelte 5. It's a static site with no backend; progress is saved in the browser.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script            | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `npm run dev`     | Validates content, rebuilds derived data, starts the dev server      |
| `npm run build`   | Same, but strict (fails on errors), then builds to `dist/`           |
| `npm run content` | Validates content and regenerates `_meta`, `_search` and `_graph` only |
| `npm run check`   | Type-checks TypeScript and Svelte                                    |

## Views

- **Tree** (`#/`): the category → group → hobby → skill tree. Deep links: `#/g/<domain>/<group>`,
  `#/h/<hobby>`, `#/h/<hobby>/<skill>`.
- **Connections** (`#/map`): a 24×24 heat map of how close the categories are. Click a cell to see
  which hobby pairs bridge them.
- **Traits** (`#/traits/<trait>`): the 51 underlying abilities, and which hobbies build each one.
- **Character** (`#/me`): level, XP, progress by hobby, and export/import.

## Content (`src/content/`)

| File                    | What it holds                                                              |
| ----------------------- | -------------------------------------------------------------------------- |
| `domains.json`          | The 24 top-level categories                                                |
| `taxonomy.json`         | Groups for each category. Each group has a default trait profile and its hobby ids |
| `traits.json`           | The ability vocabulary (Body, Mind, Creative, Social, Practical, Spirit, Tech, Word) |
| `hobbies/<domain>.json` | Hobby entries: summary, stats, tags, synergies, optional `traits` override |
| `trees/<hobby>.json`    | Full skill trees. A hobby counts as "charted" once its tree file exists    |

Trait strings are compact: `"dexterity3 precision3 patience3 mechanical2"`. Weights run from 0 to 3.

### How relatedness is computed (`scripts/build-index.ts`)

1. Each hobby's trait vector is its own `traits` string if it has one, otherwise its group's
   default profile.
2. Each vector is then nudged 35% towards the average of the hobby's hand-picked synergies. This way
   two hobbies in the same group still differ by the company they keep.
3. Similarity is 80% cosine similarity and 20% a bonus for a direct synergy link.
4. Each category pair is scored by averaging, both ways, how close each hobby's best match in the
   other category is.

Hobbies in the same group with no per-hobby override score close to 1.0 with each other. Adding
`traits` overrides to hobbies is the main way to sharpen the map.

### Skill node fields

`id`, `name`, `tier` (1 Novice to 5 Master), `requires`, `summary`, `steps` (at least 2),
`drills` (at least 1), `mastery`, and `hours`. The optional fields are `mistakes`,
`resources` (`{ title, kind: book|video|site|course|tool, by?, url? }`) and `partyTrick` (minutes).

## Theming

Every colour and font comes from tokens in `src/styles/global.css`. A skin such as Fallout,
cyberpunk or Skyrim is a new `[data-theme]` block, plus component overrides where needed.

## History

The previous three.js hex-map version is tagged `legacy-hex-map`.
