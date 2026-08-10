# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React application showcasing Vercel's Web Interface Guidelines. It displays UI/UX principles with interactive good/bad examples, helping developers understand and apply best practices for accessible, performant web interfaces.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server

# Build & Preview
npm run build        # Build for production (runs generate:llms first via prebuild)
npm run preview      # Preview production build
npm run generate:llms # Regenerate public/llms.txt, llms-full.txt, sitemap.xml

# Code Quality
npm run lint         # ESLint check
npm run typecheck    # TypeScript type checking

# Data / Sources
npm run validate       # Field completeness + example mapping + theme checks
npm run check:sources  # Check upstream skill sources for new/uncovered rules

# Testing
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# E2E Testing (Playwright)
npm run test:e2e           # Run all e2e tests
npm run test:e2e:headed    # Run with visible browser
npm run test:e2e:ui        # Run with Playwright UI
npm run test:e2e:principle # Run principle visual tests only
```

## Architecture

### Data Flow

1. **Principles Data** (`src/data/principles/`): The single source of truth, split into one module per category (`interactions.ts`, `animations.ts`, `layout.ts`, `content.ts`, `forms.ts`, `performance.ts`, `design.ts`, `aesthetics.ts`). `index.ts` is the barrel that re-exports `categories` (from `categories.ts`) and a flat, category-grouped `principles` array. Import from `@/data/principles` — never a category file directly.
2. **Agent Rules** (`src/data/agentRules.ts`): Companion rules for AI agents, keyed by principle ID with type-safe linking
3. **Example Renderer** (`src/components/ExampleRenderer.tsx`): Auto-discovers example components via `import.meta.glob`

### Component Structure

- `App.tsx`: Main layout with keyboard navigation, path-based routing, dynamic page title, sidebar toggle

  **Routing is path-based (`/principles/:id`), and every write goes through `navigate()`.** `popstate` is the only listener needed — with real paths there is no `hashchange` to miss. Two rules keep history honest: `navigate` pushes, so each rule is its own entry, while the mount-time correction for landing on `/` uses `replaceState` so it does not sit behind the user's first Back press as a phantom entry.

  **Legacy hash URLs are rewritten on mount and that code is permanent.** `llms.txt` deep-linked categories by hash and `llms-full.txt` carried a hash permalink for all 411 rules — published, in the wild, uncontrollable. `routeFromLegacyHash` in `src/lib/routes.ts` maps them onto paths. Deleting it breaks citations we made.

  **URLs derive from the principle id, never from `category` + slug.** Hierarchy is derivable (every id is category-prefixed) but it would couple a permanent URL to mutable metadata: recategorise a rule and its page moves. Same reasoning that moved WordPress permalinks off `/category/post`.

  **`isDesktop` must never affect render output.** `useMediaQuery` cannot know the viewport on the server, so branching on it while rendering guarantees a hydration mismatch. Layout is expressed in CSS (`md:` variants); the hook is used only in effects and event handlers. `Sidebar` sets `inert`/`aria-hidden` in an effect for the same reason.
- `PrincipleView.tsx`: Displays principle details with side-by-side good/bad examples
- `ExampleRenderer.tsx`: Lazy-loads examples automatically from `./examples/**/*.tsx`
- `Sidebar.tsx`: Navigation with search, focus trap, and `overscroll-behavior: contain`
- `Navigation.tsx` / `Header.tsx`: Chrome components

### Example Components Pattern

Examples live in `src/components/examples/{category}/` with naming convention:
- `{PrincipleName}Good.tsx` - Correct implementation
- `{PrincipleName}Bad.tsx` - Anti-pattern demonstration

Examples are **automatically discovered** - no manual registration needed. Just:
1. Create the component in the appropriate category folder
2. Export the component as a named export
3. The file path is converted to a key: `forms/EnterSubmitsBad.tsx` → `forms-enter-submits-bad`

To add a new principle:
1. Add the `Principle` object to the matching category module in `src/data/principles/{category}.ts` with example keys
2. Create Good/Bad example components in the appropriate category folder (the derived key must match `badExampleKey`/`goodExampleKey` exactly — beware acronym casing, e.g. `ZIndex` → `zindex`, not `z-index`)
3. Optionally add an agent rule to `src/data/agentRules.ts`
4. Verify: `npm run typecheck && npm run validate`

### Types

`src/types/principle.ts` defines:
- `Principle`: Main data structure for each guideline
- `PrincipleCategory`: Union type for categories
- `PatternSource` / `PatternSourceInfo`: Multi-source tagging system
- `AgentRule` / `AgentRulePriority`: Rule types with MUST/SHOULD/NEVER

### Multi-Source Tagging System

Principles can be tagged with their pattern source for the "brain center" concept:

```typescript
type PatternSource = 'vercel' | 'wcag' | 'aria' | 'design-system' | 'custom';
```

Each principle has an optional `source` field linking it to its origin (Vercel guidelines, WCAG criteria, ARIA practices, etc.). This enables filtering and attribution.

### Agent Rules System

Agent rules in `src/data/agentRules.ts` provide AI-consumable guidelines:

```typescript
type AgentRulePriority = 'MUST' | 'SHOULD' | 'NEVER';

interface AgentRule {
  priority: AgentRulePriority;
  rule: string;
  codeExample?: string;
}
```

Rules are keyed by principle ID with type-safe linking to ensure every rule maps to a valid principle.

### Source Sync System

Rules are hand-transcribed from upstream "skill" sources, so a small sync system keeps us aligned. The authority is the **source catalog** `src/data/sources.ts` (`sourceCatalog`), which mirrors the Obsidian provenance report *"UI · Animation · Design Skills — Source Directory 2026"*. It's decoupled from the app's `PatternSource`/badge system: a source can be catalogued (for coverage) before any of its rules are onboarded. Each entry has a `check` mode:
- **`github`** — rules live as raw markdown bullet/numbered lists (`rawUrls`). Verified auto-diffable: Vercel `command.md`, Rauno `README.md`, Emil Kowalski `review-animations/SKILL.md`.
- **`manual`** — no diffable rule file; reminded on a `reviewEveryDays` cadence.

Scripts (shared extraction in `scripts/lib/rules.ts` — tokenize/extract/classify/fetch):
- `npm run check:sources` — freshness. Fetches github sources, extracts rules, fuzzy-diffs against the whole corpus, writes uncovered ones to `doc/pending-rules.json` (flagged `needs-examples`, with auto-classified category + tags). `-- --mark-reviewed=<id>` stamps a manual source (`doc/source-review-state.json`).
- `npm run sources:build -- <id> [--limit=N]` — onboard a source: fetch → extract → classify category + tags → scaffold `status:'draft'` Principle entries into `src/data/principles/drafts.ts`. Requires the source to have `check.mode:'github'` + a `patternSource` (add to the `PatternSource` union + a `source-registry.ts` badge first).
- `npm run sources:catalog` — diffs `sourceCatalog` against the Obsidian report → flags report repos not yet catalogued. `-- --report="/path"` to override.

**Drafts** (`draftPrinciples` in `src/data/principles/drafts.ts`) are NOT in the `principles` array, so they're hidden from the app until promoted: author their Good/Bad examples, move the entry into its category module, drop `status`. Never auto-mutates published data.

**Tags** — `src/data/tags.ts` derives cross-cutting filter tags (motion, a11y, typography, forms, color…) at runtime from category + keywords, merged with explicit `tags`. Applied in the barrel via `withTags()`, surfaced by the sidebar `TagFilter` (alongside `SourceFilter`).

See `doc/specs/2026-07-12-source-freshness-sync.md`.

> Note: the MDX content layer under `content/principles/` was removed — it duplicated `principles.ts` and was never rendered by the app. `principles/**` is now the sole source of truth.

### Discoverability & Attribution

Each rule is a prerendered page at `/principles/<id>` carrying its own title, meta, canonical, OG card and JSON-LD, plus the rule and its reasoning as real text. Three consequences shape this layer:

- **`scripts/generate-llms.ts`** (run by `prebuild`, so `npm run build` always refreshes it) emits `public/llms.txt`, `public/llms-full.txt`, and `public/sitemap.xml` from the principle data. `llms-full.txt` is the **only** machine-readable copy of the corpus — it's what agents actually fetch and cite. Never hand-edit those three files; edit `src/data/principles/*` and regenerate. `public/robots.txt` is hand-written and allows all AI crawlers.

  **`llms.txt` must follow llmstxt.org, and that means Markdown links.** Every section is a list of `- [Name](url): notes` built through the `link()` helper. A section of bare URLs reads fine to a human and gets rejected by validators as "does not appear to contain any links" — which is how this broke once already. The generator asserts an H1 and a link count before writing, so a regression fails the build instead of shipping. Sources with no upstream URL (e.g. `custom`) point at `/#sources` rather than degrading to plain text.

- **`scripts/generate-agent-layers.ts`** (also `prebuild`) emits the sliceable payloads an agent in *another* repo fetches: `public/principles/index.md`, `must.md`, `<id>.md`, `<id>.json`, and `public/categories/<category>.md`. These are **gitignored** — 800+ generated files would drown every diff, and Vite copies `public/` into `dist/` so they ship on the deploy regardless. The three discovery files stay tracked because their diffs are how a corpus change gets reviewed.

  The reason this layer exists is token cost: `llms-full.txt` is ~166k tokens, so it is almost never the right fetch. The ladder is index (~8k) → category (6k–26k) or `must.md` (~11k) → one rule (~1.4k). **The per-rule payload is the only endpoint carrying the example component source** — 823 components, 3.3 MB, otherwise unreachable — and the generator throws if any principle would ship without both, since that code is the reason the payload exists.

  **`index.md` is searched, not read top-to-bottom.** Every rule line ends in match tokens: the *surfaces* it applies to and the *symbols* its examples use. Surfaces are the "what am I building" axis, modelled on the WAI-ARIA APG — an agent works on a dialog or a form, not on "the animations category", and a modal needs focus, motion and ARIA rules that live in three different ones. APG can partition cleanly because each page *is* a component; this corpus cannot — measured, a rule belongs to **2.1 surfaces on average**, so surfaces are labels, not folders. Re-partitioning the files by surface would force false single-parents or duplicate rules on disk. 368/411 carry a surface; the 43 that do not stay reachable by category and symbol, and the index says so.

  **Trigger symbols are the second axis, and that is what makes titles unnecessary.** A title does not tell an agent whether a rule applies to the file in front of it ("Enter Submits" never says `onSubmit`), and the tag vocabulary cannot help — 7 tags across 411 rules, 39% untagged. So each rule is annotated with the concrete symbols its own examples use, mined from the good and bad source plus the rule text, then filtered by document frequency: anything above 16% of the corpus is boilerplate (`onClick`, `useState`, `<button>`) and discriminates nothing. The ceiling is a heuristic and it bites at the boundary — `<label>` sits at 15.1%, so at the original 15% one new example rendering a label silently deleted `label` from all 32 rule lines carrying it, with nothing in the build to catch it. That reaches 264/411 — the mechanical rules; the rest are judgment calls reachable by category. Deriving symbols from the *difference* between good and bad was tried and is worse (it turns `forms-enter-submits` into `onClick`), because the two examples usually share the relevant API and differ only incidentally.

  `scripts/lib/corpus.ts` holds `SITE`/`published`/`loadExampleSources()` so the two generators cannot disagree. Example keys are re-derived through `pathToKey`, never reconstructed from ids — acronym casing makes the reverse lossy.

- **Discovery pointers exist in three places because three different clients look in three different places.** `index.html` has `<link rel="alternate">` for DOM-parsing crawlers; `netlify.toml` sets an HTTP `Link` header for headless fetchers that never read the body; and `Footer.tsx` carries an `sr-only aria-hidden` sentence naming `llms-full.txt`, for the case where a human pastes the URL into a chat model that only sees rendered text. The `.txt` files stay `text/plain` on the wire on purpose — `text/markdown` makes browsers download them, and the footer links a human to `llms-full.txt`.
- **Authorship is expressed by a shared `@id`.** The JSON-LD in `index.html` names the author as `{"@id": "https://glebstroganov.com/#person"}` — the same node glebstroganov.com publishes in its `/about.json`. That is what merges the project into its author's works graph instead of creating a second, unlinked "Gleb Stroganov". `src/components/Footer.tsx` carries the visible credit with `rel="author me"` to the same URL. Keep the footer href, the JSON-LD `@id`/`sameAs`, and the generator's attribution block in sync.

- **`scripts/prerender.ts`** (after both Vite builds) writes `dist/principles/<id>/index.html` for every rule. It renders the **real component tree** via `src/entry-server.tsx`, not a hand-written template — a template would duplicate the JSX and drift from it. `main.tsx` calls `hydrateRoot` when the container already has markup, so React attaches rather than re-rendering.

  Two things are held back from the static HTML so server and client agree, both gated on `useMounted`: the example components (interactive demos, not indexable prose — 823 of them, and making them server-safe would be open-ended work with no payoff), and the sidebar beyond the current rule's category (all 411 links is 340 KB per page, 137 MB across the corpus; one category is ~6% of that and still gives a crawler real links).

**Where this landed:** `sitemap.xml` lists **415 URLs**, up from 3. Per-rule OG *images* are still generic — the metadata is per-rule, the picture is not.

### UI Components (shadcn/ui + Radix)

Uses shadcn/ui (new-york style) with Radix UI primitives in `src/components/ui/`.

**Pattern**: Components use `class-variance-authority` (CVA) for variants, extracted to `.variants.ts` files for fast-refresh compatibility.

**Adding components**: Use `npx shadcn@latest add <component>` - configured in `components.json` with path aliases (@/components, @/lib/utils, etc.)

### Custom Animations

Defined in `src/index.css` using Tailwind v4's `@theme` and `@utility` directives:
- `motion-safe-fade-in-slide`: Respects `prefers-reduced-motion`
- `animate-scale-in`, `animate-scale-in-from-top`: Menu animations
- `transition-transform-shadow`, `transition-transform-opacity`: Compositor-friendly transitions

## Tech Stack

- React 18 with TypeScript (strict mode)
- Vite with `@tailwindcss/vite` plugin
- Tailwind CSS v4 (CSS-based config)
- HUGEICONS for icons (@hugeicons/react)
- Vitest for unit testing
- ESLint with react-hooks and react-refresh plugins

## UI/UX Guidelines Reference

This project implements principles from Vercel's Web Interface Guidelines. When working on this codebase, follow the same principles being demonstrated:

- Full keyboard accessibility with visible focus rings (`:focus-visible`)
- Focus traps in modals with focus return on close
- Hit targets ≥24px (≥44px on mobile)
- Proper form semantics with labels, autocomplete, and validation
- Respect `prefers-reduced-motion`
- Use compositor-friendly animations (`transform`, `opacity`)
- Never `transition: all`
- `overscroll-behavior: contain` in modals/drawers
- Dynamic page titles matching current context

See `doc/vercel-web-guides.md` for the full source guidelines and `doc/vercel-web-guides-agent.md` for the condensed agent rules.
