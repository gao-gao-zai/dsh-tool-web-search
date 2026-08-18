# DSH Web Search

Persistent Host-side DSH tools that search Bing or SearXNG and fetch specific HTTP(S) pages with bounded output.

## Scope

This package exposes `web_search` and `web_fetch`. It fetches specific HTTP(S) result pages and converts HTML to bounded Markdown with `turndown`; it does not download or interpret images.

## Install

```sh
dsh plugin --profile web add link:/absolute/path/to/WebSearch
```

Before starting a session, disable the shipped official `tool-web` plugin in the DSH plugin/profile settings. The package patch cannot modify a shipped Agent preset after it is mounted. Then restart the profile. This package contributes replacement tools named `web_search` and `web_fetch`.

## Configuration

The plugin uses the `dsh-web-search` settings namespace. The default engine is Bing:

```yaml
engine: bing
maxResults: 10
timeoutMs: 30000
fetch: true
fetchTimeoutMs: 30000
maxResponseBytes: 2000000
fetchMaxOutputChars: 200000
bing:
  market: zh-CN
  setLang: zh-CN
```

For SearXNG:

```yaml
engine: searxng
searxng:
  baseUrl: https://searx.example.com
  apiKeyRef: SEARXNG_API_KEY
  apiKeyHeader: Authorization
  apiKeyPrefix: 'Bearer '
```

The API key is resolved per request through DSH credentials, with an environment-variable fallback when the credentials service is unavailable. It is never placed in the URL or tool output.

## Limits

- Search: up to 10 results per call.
- Search: up to 200 Unicode characters per snippet.
- Search: up to 16K characters in rendered tool output.
- Fetch: up to 200K characters in rendered Markdown/text output.
- Both tools: oversized network responses are rejected before unbounded parsing.

See `docs/requirements.md` for the complete requirements and acceptance criteria.

## License

This project is licensed under the MIT License. See `LICENSE` for the full text, `NOTICE` for third-party references, and `THIRD_PARTY_LICENSES.md` for preserved third-party copyright and license notices.

## Agent Skill

The package also bundles `skills/web-search-operations/SKILL.md`. Its profile patch adds a private Skill filesystem provider for that directory, so the Agent receives operational guidance about result limits, Bing/SearXNG configuration, credential references, and error handling without replacing project or user Skill roots.
