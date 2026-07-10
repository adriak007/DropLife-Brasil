# Graph Report - DropLife-Brasil  (2026-07-10)

## Corpus Check
- 83 files · ~314,688 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 440 nodes · 771 edges · 84 communities (21 shown, 63 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `76b232b4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Paginas e Componentes do App
- Documentacao Graphify
- Controle do Mapa (MapController)
- Dados Geograficos e Curiosidades
- Dashboard e Ranking
- Sistema de Conquistas
- Configuracao TypeScript
- Dependencias do Projeto
- Integracao Graphify no CLAUDE.md
- Icone do App
- layout.tsx
- Mapa SVG do Brasil
- Politica de Privacidade
- Marca DropLife
- Configuracao Next.js
- Configuracao Vercel
- Autorizacao AdSense
- MapGame.tsx
- What You Must Do When Invoked
- graphify reference: extra exports and benchmark
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- CLAUDE.md
- extraction-spec.md
- Watch Mode (--watch)
- FalkorDB Export
- Graphify MCP Server
- Neo4j Export
- Token Reduction Benchmark
- Wiki Export (--wiki)
- Discrete Confidence Score Rubric
- Hyperedges
- Deterministic Node ID Format
- Verbatim source_file Rule
- Extraction Subagent Prompt
- Cross-Repo Graph Merge (merge-graphs)
- GitHub Clone (graphify clone)
- Native CLAUDE.md Integration
- Post-Commit Auto-Rebuild Hook
- BFS/DFS Graph Traversal
- Node Explain Query (/graphify explain)
- Inline NetworkX Fallback
- Shortest Path Query (/graphify path)
- Constrained Query Expansion
- Work Memory (save-result Feedback Loop)
- Whisper Domain Hint Prompt
- Whisper Video/Audio Transcription
- build_merge Replace-on-Re-extract
- Cluster-Only Rerun (--cluster-only)
- Incremental Update (--update)
- Structural AST Extraction (Part A)
- Community Detection
- Community Labeling
- Cumulative Cost Tracker
- Semantic Extraction Cache
- Fast Path (Existing Graph Query)
- God Nodes
- Graph Health Check
- GRAPH_REPORT.md Audit Report
- Graphify Pipeline
- Interactive HTML Graph Visualization
- Graphify Python Interpreter Detection
- Knowledge Graph
- Semantic Extraction (Part B Subagents)
- Graph Shrink Guard
- graphify skill trigger
- graphify SKILL.md
- Community Structure
- God Nodes
- graphify-out/graph.json
- GRAPH_REPORT.md
- graphify explain command
- graphify path command
- graphify query command
- graphify update command
- Knowledge Graph (graphify-out/)
- graphify-out/wiki/index.md
- formatPop
- CitydexModal.tsx
- shareCard.ts

## God Nodes (most connected - your core abstractions)
1. `MapController` - 49 edges
2. `MapGame()` - 32 edges
3. `formatPop()` - 24 edges
4. `compilerOptions` - 16 edges
5. `keyFor()` - 15 edges
6. `AuthState` - 12 edges
7. `SaveData` - 12 edges
8. `What You Must Do When Invoked` - 12 edges
9. `/graphify` - 11 edges
10. `RankingModal()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AchievementsModal()` --references--> `ACHIEVEMENTS`  [EXTRACTED]
  components/AchievementsModal.tsx → lib/achievements.ts
- `Props` --references--> `SaveData`  [EXTRACTED]
  components/CitydexModal.tsx → lib/storage.ts
- `CitydexModal()` --calls--> `formatPop()`  [EXTRACTED]
  components/CitydexModal.tsx → lib/text.ts
- `Props` --references--> `AuthState`  [EXTRACTED]
  components/HomeDashboard.tsx → lib/online.ts
- `Props` --references--> `StateStats`  [EXTRACTED]
  components/HomeDashboard.tsx → lib/types.ts

## Import Cycles
- None detected.

## Communities (84 total, 63 thin omitted)

### Community 0 - "Paginas e Componentes do App"
Cohesion: 0.21
Nodes (14): __dirname, fetchWithRetry(), findWikidataByIBGE(), formatWikimediaUrl(), getWikidataImage(), getWikipediaImage(), getWikipediaSummary(), isMunicipioArticle() (+6 more)

### Community 2 - "Controle do Mapa (MapController)"
Cohesion: 0.09
Nodes (9): MapController, MapControllerOptions, clamp(), cleanCity(), formatChance(), BBox, CityModalData, PickedCity (+1 more)

### Community 3 - "Dados Geograficos e Curiosidades"
Cohesion: 0.11
Nodes (34): CitydexModal(), HeatLegend(), buildIndex(), CidadeImagem, cityImageFor(), imagens, MunicipioRow, municipios (+26 more)

### Community 4 - "Dashboard e Ranking"
Cohesion: 0.16
Nodes (22): HomeDashboard(), AuthMode, ERROR_MSG, MEDALS, RankingModal(), Tab, AuthError, AuthResult (+14 more)

### Community 5 - "Sistema de Conquistas"
Cohesion: 0.09
Nodes (29): AchievementsModal(), Props, Props, AVATAR_COLORS, MEDAL_TIERS, Props, AchievementCategory, AchievementContext (+21 more)

### Community 6 - "Configuracao TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 7 - "Dependencias do Projeto"
Cohesion: 0.11
Nodes (18): dependencies, next, react, react-dom, @supabase/supabase-js, devDependencies, @types/node, @types/react (+10 more)

### Community 9 - "Icone do App"
Cohesion: 0.83
Nodes (4): DropLife Brasil App Icon (icon.png), DL Monogram (angular L + D letterforms), DropLife Brasil Game Branding, Green Pixelated Map/Terrain Texture

### Community 10 - "layout.tsx"
Cohesion: 0.40
Nodes (3): JSON_LD, metadata, viewport

### Community 11 - "Mapa SVG do Brasil"
Cohesion: 0.67
Nodes (4): Interactive Brazil map asset for the game (loaded by lib/mapController.ts), Brazilian States Map (MAPAESTADOS.svg), Municipality paths (data-name="City, UF" per municipality), State border paths (state-border-UF ids for all 27 states)

### Community 13 - "Marca DropLife"
Cohesion: 0.67
Nodes (3): DropLife 'D' Monogram Icon, DropLife Wordmark Logo, DropLife Brand

### Community 17 - "MapGame.tsx"
Cohesion: 0.14
Nodes (23): AdInterstitial(), Props, buildAccountSave(), MapGame(), spawnRipple(), newlyUnlocked(), bumpBirthCounterAndCheckAd(), mulberry32() (+15 more)

### Community 18 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 19 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 20 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 21 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 22 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 23 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 81 - "formatPop"
Cohesion: 0.18
Nodes (10): __dirname, keyFor(), keys, normalize(), OUT_FILE, sorted, svg, SVG_FILE (+2 more)

### Community 82 - "CitydexModal.tsx"
Cohesion: 0.11
Nodes (22): MobileNav(), Props, ICONS, OnboardingModal(), Props, MEDAL_COLORS, RarityIcon(), Props (+14 more)

### Community 83 - "shareCard.ts"
Cohesion: 0.43
Nodes (7): RarityTier, buildDailyCard(), DailyCardData, darkOf(), drawMedal(), fallbackText(), shareDailyCard()

## Knowledge Gaps
- **181 isolated node(s):** `metadata`, `JSON_LD`, `viewport`, `metadata`, `Props` (+176 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **63 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MapController` connect `Controle do Mapa (MapController)` to `MapGame.tsx`, `Dados Geograficos e Curiosidades`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `formatPop()` connect `CitydexModal.tsx` to `Controle do Mapa (MapController)`, `Dados Geograficos e Curiosidades`, `Dashboard e Ranking`, `Sistema de Conquistas`, `MapGame.tsx`, `shareCard.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `MapGame()` connect `MapGame.tsx` to `Controle do Mapa (MapController)`, `Dados Geograficos e Curiosidades`, `Dashboard e Ranking`, `CitydexModal.tsx`, `shareCard.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `metadata`, `JSON_LD`, `viewport` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Controle do Mapa (MapController)` be split into smaller, more focused modules?**
  _Cohesion score 0.09019607843137255 - nodes in this community are weakly interconnected._
- **Should `Dados Geograficos e Curiosidades` be split into smaller, more focused modules?**
  _Cohesion score 0.10887949260042283 - nodes in this community are weakly interconnected._
- **Should `Sistema de Conquistas` be split into smaller, more focused modules?**
  _Cohesion score 0.08571428571428572 - nodes in this community are weakly interconnected._