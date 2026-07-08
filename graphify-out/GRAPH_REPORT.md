# Graph Report - .  (2026-07-07)

## Corpus Check
- Large corpus: 59 files · ~1,008,051 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 205 nodes · 452 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Home Screen, Modals & Game Logic
- Map Controller (SVG interaction)
- Geo Data, Curiosities & Heatmap
- Ranking & Auth (Supabase)
- TypeScript Config
- Package Dependencies
- State Panels & Stats
- App Layout & Metadata
- DropLife Brand Assets
- Brazil Map Assets
- Next.js Config

## God Nodes (most connected - your core abstractions)
1. `MapController` - 44 edges
2. `MapGame()` - 21 edges
3. `formatPop()` - 16 edges
4. `compilerOptions` - 16 edges
5. `keyFor()` - 12 edges
6. `RankingModal()` - 10 edges
7. `SaveData` - 10 edges
8. `curiosityFor()` - 8 edges
9. `MapControllerOptions` - 8 edges
10. `normalize()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `SaveData`  [EXTRACTED]
  components/AchievementsModal.tsx → lib/storage.ts
- `Props` --references--> `SaveData`  [EXTRACTED]
  components/CitydexModal.tsx → lib/storage.ts
- `CitydexModal()` --calls--> `formatPop()`  [EXTRACTED]
  components/CitydexModal.tsx → lib/text.ts
- `CitydexModal()` --calls--> `normalize()`  [EXTRACTED]
  components/CitydexModal.tsx → lib/text.ts
- `MapGame()` --calls--> `getAuthState()`  [EXTRACTED]
  components/MapGame.tsx → lib/online.ts

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "Home Screen, Modals & Game Logic"
Cohesion: 0.09
Nodes (29): Props, CitydexModal(), Props, MapGame(), PanelKind, spawnRipple(), AchievementDef, ACHIEVEMENTS (+21 more)

### Community 1 - "Map Controller (SVG interaction)"
Cohesion: 0.12
Nodes (7): MapController, MapControllerOptions, clamp(), cleanCity(), formatChance(), PickedCity, ViewBox

### Community 2 - "Geo Data, Curiosities & Heatmap"
Cohesion: 0.12
Nodes (28): HeatLegend(), curiosityFor(), CuriosityMap, fallbackExtractCuriosities(), loadCuriosities(), parseCuriosityText(), RawCuriosity, cityAliases (+20 more)

### Community 3 - "Ranking & Auth (Supabase)"
Cohesion: 0.17
Nodes (21): AuthMode, ERROR_MSG, MEDALS, Props, RankingModal(), Tab, AuthError, AuthResult (+13 more)

### Community 4 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 5 - "Package Dependencies"
Cohesion: 0.11
Nodes (17): dependencies, next, react, react-dom, @supabase/supabase-js, devDependencies, @types/node, @types/react (+9 more)

### Community 6 - "State Panels & Stats"
Cohesion: 0.36
Nodes (6): Props, StatePanel(), Props, StatesModal(), formatPop(), StateStats

### Community 8 - "DropLife Brand Assets"
Cohesion: 0.67
Nodes (4): App Icon (icon.png), DropLife 'D' Monogram Icon, DropLife Wordmark Logo, DropLife Brand

### Community 9 - "Brazil Map Assets"
Cohesion: 0.67
Nodes (3): Brazil Map (br.svg), Brazil States Map (MAPAESTADOS.svg), Interactive Brazil Map Game

## Knowledge Gaps
- **51 isolated node(s):** `metadata`, `viewport`, `PanelKind`, `Tab`, `AuthMode` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MapController` connect `Map Controller (SVG interaction)` to `Home Screen, Modals & Game Logic`, `Geo Data, Curiosities & Heatmap`, `State Panels & Stats`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Why does `formatPop()` connect `State Panels & Stats` to `Home Screen, Modals & Game Logic`, `Map Controller (SVG interaction)`, `Geo Data, Curiosities & Heatmap`, `Ranking & Auth (Supabase)`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `MapGame()` connect `Home Screen, Modals & Game Logic` to `Map Controller (SVG interaction)`, `Ranking & Auth (Supabase)`, `State Panels & Stats`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `metadata`, `viewport`, `PanelKind` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Home Screen, Modals & Game Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.08879492600422834 - nodes in this community are weakly interconnected._
- **Should `Map Controller (SVG interaction)` be split into smaller, more focused modules?**
  _Cohesion score 0.11794871794871795 - nodes in this community are weakly interconnected._
- **Should `Geo Data, Curiosities & Heatmap` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._