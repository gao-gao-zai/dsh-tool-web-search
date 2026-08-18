---
name: ts-comment-conventions
description: Use when writing TypeScript code, creating or reviewing TypeScript functions/classes/interfaces, or setting up a project's comment and documentation standards. Provides JSDoc and inline comment conventions for TS projects.
---

# TypeScript Comment Conventions

When writing TypeScript code in any project, follow these conventions. The goal: **code tells you what, comments tell you why, types tell you how**.

## The Three Layers

| Layer | Carrier | Reader |
|-------|---------|--------|
| What it does | JSDoc `@param` / `@returns` / `@example` | Caller |
| Field meanings | TS type annotations + field-level `/** */` | IDE hover |
| Why this way | Block comments ("why", not "what") | Maintainer |

## 1. Public API → JSDoc

Every exported function, class method, and interface field gets a concise JSDoc block.

```typescript
/**
 * Submit a search query to the configured engine and return structured results.
 *
 * @param query   - Search keywords. Must not be empty.
 * @param options - Engine selection, result count, and language preferences.
 * @returns Deduplicated results ordered by relevance, or an empty array when no results are found.
 * @throws {NetworkError} When the engine endpoint is unreachable after retries.
 *
 * @example
 * const results = await search('TypeScript', { engine: 'bing', limit: 5 })
 * // => [{ title: '...', url: '...', snippet: '...' }]
 */
export async function search(
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]>
```

### Rules for JSDoc

- **`@param`** — every parameter, even optional ones. Keep descriptions one line.
- **`@returns`** — every function that returns a value. Describe the shape, not just "the result".
- **`@throws`** — only for errors the caller should catch. Don't list every internal `Error`.
- **`@example`** — one short, copy-pasteable snippet. Not a tutorial.
- **`@deprecated`** — add a `@deprecated Use {@link newMethod} instead.` line when removing a function.

### Interface fields

```typescript
export interface SearchConfig {
  /** Which search backend to use. */
  engine: 'bing' | 'searxng'

  /** Bing-specific options (only active when `engine === 'bing'`). */
  bing?: {
    /** Market code such as `zh-CN` or `en-US`. */
    market: string
    /** Whether to route requests through a proxy. */
    proxy?: boolean
  }
}
```

No `@param` / `@returns` on interfaces — only the `/** description */` above each field.

## 2. Complex Logic → Block Comments

When the code does something non-obvious, add a short block comment **before** the block.

```typescript
// Bing wraps every result link through its own redirect:
//   https://www.bing.com/ck/a?url=https%3A%2F%2Freal.url
// Extract the `url` query parameter and decode it to get the real destination.
// Reference: https://github.com/AusertDream/bing-search-cli (MIT)
const realUrl = decodeURIComponent(
  new URL(anchor.href).searchParams.get('url') ?? anchor.href,
)
```

### What deserves a block comment

- URL / protocol format decoding
- Workarounds for third-party quirks or bugs
- Performance tradeoffs (e.g. "we parse eagerly here because the result set is always ≤ 10")
- Deliberately skipped steps (e.g. "we do NOT strip `<em>` because it carries search hit highlighting")
- Magic numbers with a source

## 3. "Why, Not What" → Reason Comments

The most valuable comments explain **why** a choice was made, especially when the "obvious" approach was rejected.

```typescript
// Default `turndown` converts `<em>` to `*text*`, but Bing search snippets use
// `<em>` as a highlight marker, not semantic emphasis. Leaving it as-is
// (stripping the tag, keeping the text) produces cleaner Markdown.
turndownService.addRule('stripEm', {
  filter: 'em',
  replacement: (content) => content,
})
```

```typescript
// We use `parse5` instead of `cheerio` here because the Bing results page is
// 200+ KB of HTML, and `parse5` is ~30% faster on large documents in benchmarks.
import { parse } from 'parse5'
```

## 4. Do Not Comment

| Don't write | Because |
|-------------|---------|
| `// Set limit to 10` above `limit = 10` | Code already says it |
| `/** Get results */` above `getResults()` | Function name says it |
| File-header copyright blocks | Root `LICENSE` and `NOTICE` cover it |
| `// Created by Alice on 2024-01-01` | `git blame` has it |
| `// TODO: fix this` | Open an issue instead; if you must, add a date and owner |
| `// Increment i` above `i++` | Noise |

The only exception to the file-header rule: a one-line `/** @fileoverview <brief purpose> */` when the file's role is not obvious from its name (e.g. `utils.ts` or `helpers.ts`).

## 5. tsconfig & Tooling

### Recommended ESLint plugin

```json
{
  "plugins": ["jsdoc"],
  "rules": {
    "jsdoc/require-param": "warn",
    "jsdoc/require-returns": "warn",
    "jsdoc/require-description": "off",
    "jsdoc/check-param-names": "error"
  }
}
```

### `tsconfig.json` for documentation

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

`declaration` generates `.d.ts` files that carry the JSDoc through to consumers. `declarationMap` lets IDE "Go to Definition" jump to the source.

## 6. Quick Checklist

Before committing, verify:

- [ ] Every exported function has `@param` and `@returns` (or `@throws` if relevant)
- [ ] Every exported interface field has a `/** */` description
- [ ] Every magic number, regex, or URL format has a comment explaining its source
- [ ] Every "why we did it this way and not that way" is documented
- [ ] No `@author`, `@date`, `@since`, or `@version` tags (Git log is the source of truth)
- [ ] No comments that repeat the code on the next line