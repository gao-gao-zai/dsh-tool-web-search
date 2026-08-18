import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
import { load } from "cheerio";
//#region src/types.ts
/** Search-related error with a stable model-facing code. */
var SearchError = class extends Error {
	code;
	retryable;
	status;
	constructor(code, message, retryable = false, status) {
		super(message);
		this.name = "SearchError";
		this.code = code;
		this.retryable = retryable;
		if (status !== void 0) this.status = status;
	}
};
//#endregion
//#region src/http.ts
/** Sleep while remaining cancellable by the caller. */
function delay(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
		}, { once: true });
	});
}
/** Read a response body without allowing an unbounded allocation. */
async function readBoundedBody(response, maxBytes) {
	if (response.headers.get("content-length") !== null) {
		const length = Number(response.headers.get("content-length"));
		if (Number.isFinite(length) && length > maxBytes) throw new SearchError("RESPONSE_TOO_LARGE", `response exceeds ${maxBytes} bytes`, false, response.status);
	}
	if (!response.body) return "";
	const reader = response.body.getReader();
	const chunks = [];
	let total = 0;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			total += next.value.byteLength;
			if (total > maxBytes) {
				await reader.cancel("response too large");
				throw new SearchError("RESPONSE_TOO_LARGE", `response exceeds ${maxBytes} bytes`, false, response.status);
			}
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(merged);
}
/** Perform a cancellable GET with bounded body reads and conservative retries. */
async function getText(url, options) {
	const retries = options.retries ?? 1;
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		const controller = new AbortController();
		const onAbort = () => controller.abort(options.signal.reason);
		options.signal.addEventListener("abort", onAbort, { once: true });
		const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), options.timeoutMs);
		try {
			const response = await fetch(url, {
				method: "GET",
				...options.headers === void 0 ? {} : { headers: options.headers },
				signal: controller.signal
			});
			const body = await readBoundedBody(response, options.maxBytes);
			if (response.ok) return {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				body
			};
			const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
			if (!retryable || attempt >= retries) throw new SearchError(response.status === 401 || response.status === 403 ? "AUTHENTICATION_ERROR" : response.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR", `search endpoint returned HTTP ${response.status}`, retryable, response.status);
		} catch (error) {
			if (error instanceof SearchError) {
				if (!error.retryable || attempt >= retries) throw error;
			} else if (options.signal.aborted) throw new SearchError("CANCELLED", "search request was cancelled", false);
			else if (controller.signal.aborted) throw new SearchError("TIMEOUT", "search request timed out", true);
			else if (attempt >= retries) throw new SearchError("HTTP_ERROR", error instanceof Error ? error.message : String(error), true);
		} finally {
			clearTimeout(timer);
			options.signal.removeEventListener("abort", onAbort);
		}
		await delay(250 * 2 ** attempt, options.signal);
	}
	throw new SearchError("INTERNAL_ERROR", "search request did not settle");
}
//#endregion
//#region src/search/bing.ts
const DEFAULT_USER_AGENT = "dsh-web-search/0.1 (+https://github.com/zhu1090093659/dsh-web-ui)";
/** Decode Bing's `ck/a` result wrapper used by its public HTML page. */
function decodeBingUrl(rawUrl) {
	let parsed;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return;
	}
	if (!parsed.hostname.endsWith("bing.com") || !parsed.pathname.includes("/ck/a")) return rawUrl;
	const encoded = parsed.searchParams.get("u") ?? parsed.searchParams.get("url");
	if (!encoded) return void 0;
	const payload = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
	try {
		const decoded = Buffer.from(payload, "base64url").toString("utf8");
		if (/^https?:\/\//i.test(decoded)) return decoded;
	} catch {
		return;
	}
}
/** Extract title, external URL and snippet fields from Bing result HTML. */
function parseBingResults(html) {
	const $ = load(html);
	const results = [];
	$("li.b_algo").each((_, element) => {
		const item = $(element);
		const anchor = item.find("h2 a").first();
		const title = anchor.text().replace(/\s+/g, " ").trim();
		const href = anchor.attr("href");
		const url = href ? decodeBingUrl(href) : void 0;
		const snippet = item.find(".b_caption p, p, .b_lineclamp2").first().text().replace(/\s+/g, " ").trim();
		if (title && url && snippet) results.push({
			title,
			url,
			snippet
		});
	});
	return results;
}
/** Create a Bing HTML search adapter. */
function createBingEngine(config, request) {
	return { async search({ query, limit, language, signal }) {
		return parseBingResults(await request(`https://www.bing.com/search?${new URLSearchParams({
			q: query,
			count: String(Math.min(limit + 5, 20)),
			mkt: language ?? config.market,
			setlang: config.setLang ?? language ?? config.market
		}).toString()}`, {
			Accept: "text/html,application/xhtml+xml",
			"Accept-Language": language ?? config.market,
			"User-Agent": config.userAgent || DEFAULT_USER_AGENT
		}, signal)).slice(0, limit);
	} };
}
/** Default request implementation for the Bing adapter. */
function createBingRequest(timeoutMs, maxResponseBytes) {
	return (url, headers, signal) => getText(url, {
		headers,
		signal,
		timeoutMs,
		maxBytes: maxResponseBytes,
		retries: 1
	}).then((response) => response.body);
}
//#endregion
//#region src/search/searxng.ts
/** Narrow one SearXNG result to the fields this tool exposes. */
function mapResult(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const result = value;
	if (typeof result.title !== "string" || typeof result.url !== "string") return void 0;
	const content = typeof result.content === "string" ? result.content : typeof result.snippet === "string" ? result.snippet : "";
	if (!content) return void 0;
	return {
		title: result.title,
		url: result.url,
		snippet: content
	};
}
/** Parse and project the SearXNG JSON result list. */
function parseSearxngResults(body) {
	let payload;
	try {
		payload = JSON.parse(body);
	} catch {
		throw new SearchError("INVALID_RESPONSE", "SearXNG returned invalid JSON", false);
	}
	if (!Array.isArray(payload.results)) throw new SearchError("INVALID_RESPONSE", "SearXNG response has no results array", false);
	return payload.results.map(mapResult).filter((value) => value !== void 0);
}
/** Create a SearXNG JSON search adapter. */
function createSearxngEngine(config, request, resolveApiKey) {
	return { async search({ query, limit, language, signal }) {
		const base = new URL(config.baseUrl);
		if (base.protocol !== "http:" && base.protocol !== "https:") throw new Error("SearXNG baseUrl must use http or https");
		base.pathname = `${base.pathname.replace(/\/$/, "")}/search`;
		base.search = "";
		base.searchParams.set("q", query);
		base.searchParams.set("format", "json");
		if (language) base.searchParams.set("language", language);
		if (config.engines?.length) base.searchParams.set("engines", config.engines.join(","));
		if (config.categories?.length) base.searchParams.set("categories", config.categories.join(","));
		const headers = {
			Accept: "application/json",
			"User-Agent": "dsh-web-search/0.1"
		};
		if (config.apiKeyRef) {
			const apiKey = await resolveApiKey();
			if (!apiKey) throw new Error(`credential ${config.apiKeyRef} is not configured`);
			headers[config.apiKeyHeader ?? "Authorization"] = `${config.apiKeyPrefix ?? "Bearer "}${apiKey}`;
		}
		return request(base.toString(), headers, signal).then((body) => parseSearxngResults(body).slice(0, limit));
	} };
}
/** Default request implementation for the SearXNG adapter. */
function createSearxngRequest(timeoutMs, maxResponseBytes) {
	return (url, headers, signal) => getText(url, {
		headers,
		signal,
		timeoutMs,
		maxBytes: maxResponseBytes,
		retries: 1
	}).then((response) => response.body);
}
const MAX_OUTPUT_CHARS = 16e3;
/** Trim a string by Unicode code points so surrogate pairs stay intact. */
function truncateChars(value, max) {
	return Array.from(value).slice(0, max).join("");
}
/** Normalize one engine result without exposing engine-specific fields. */
function normalizeResult(result) {
	const title = truncateChars(result.title.replace(/\s+/g, " ").trim(), 300);
	const snippet = truncateChars(result.snippet.replace(/\s+/g, " ").trim(), 200);
	const url = result.url.trim();
	if (!title || !snippet || url.length > 4096) return void 0;
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return void 0;
	return {
		title,
		url: parsed.toString(),
		snippet
	};
}
/** Remove duplicate pages while preserving engine relevance order. */
function deduplicateResults(results) {
	const seen = /* @__PURE__ */ new Set();
	return results.filter((result) => {
		const key = `${new URL(result.url).hostname.replace(/^www\./, "").toLowerCase()}|${result.title.toLocaleLowerCase()}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
/** Apply count and rendered-output bounds to canonical results. */
function boundResults(results, requestedLimit) {
	const limited = results.slice(0, Math.min(10, Math.max(1, requestedLimit)));
	const bounded = [];
	let outputLength = 0;
	let truncated = limited.length < results.length;
	for (const result of limited) {
		const block = `- [${result.title}](${result.url}) — ${result.snippet}`;
		if (outputLength + block.length + (bounded.length > 0 ? 1 : 0) > 16e3) {
			truncated = true;
			break;
		}
		bounded.push(result);
		outputLength += block.length + (bounded.length > 1 ? 1 : 0);
	}
	return {
		results: bounded,
		truncated
	};
}
/** Render only the bounded link-and-snippet projection for the model. */
function renderResults(output) {
	if (output.error) return `Search error [${output.error.code}]: ${truncateChars(output.error.message, 500)}`;
	if (output.results.length === 0) return "No search results found.";
	const lines = output.results.map((result) => `- [${result.title}](${result.url}) — ${result.snippet}`);
	if (output.truncated) lines.push("(Additional results were omitted due to the output limit.)");
	return truncateChars(lines.join("\n"), MAX_OUTPUT_CHARS);
}
//#endregion
//#region src/index.ts
/** Stable Cordis plugin name. */
const name = "web-search";
/** Services required by the model-facing search tool. */
const inject = ["tools", "systemPrompt"];
/** Settings namespace owned by this plugin. */
const WEB_SEARCH_SETTINGS_NAMESPACE = settingsNamespace("dsh-web-search");
/** Schema defaults for the persistent search configuration. */
const Config = z.object({
	enabled: z.boolean().default(true),
	announceToAgent: z.boolean().default(true),
	engine: z.union([z.const("bing"), z.const("searxng")]).default("bing"),
	maxResults: z.number().default(10),
	timeoutMs: z.number().default(3e4),
	maxResponseBytes: z.number().default(2e6),
	bing: z.object({
		market: z.string().default("zh-CN"),
		setLang: z.string().default("zh-CN"),
		userAgent: z.string().default("")
	}).default({
		market: "zh-CN",
		setLang: "zh-CN",
		userAgent: ""
	}),
	searxng: z.object({
		baseUrl: z.string().default(""),
		apiKeyRef: z.string().default("SEARXNG_API_KEY"),
		apiKeyHeader: z.string().default("Authorization"),
		apiKeyPrefix: z.string().default("Bearer "),
		engines: z.array(z.string()).default([]),
		categories: z.array(z.string()).default([])
	}).default({
		baseUrl: "",
		apiKeyRef: "SEARXNG_API_KEY",
		apiKeyHeader: "Authorization",
		apiKeyPrefix: "Bearer ",
		engines: [],
		categories: []
	})
});
const SEARCH_GUIDANCE = "Use web_search_configured to find current information through the configured Bing or SearXNG backend. It returns only page titles, URLs, and search-engine snippets, never webpage content. Respect the result and output limits, and cite relevant URLs as markdown links.";
const DEFAULT_CONFIG = {
	enabled: true,
	announceToAgent: true,
	engine: "bing",
	maxResults: 10,
	timeoutMs: 3e4,
	maxResponseBytes: 2e6,
	bing: {
		market: "zh-CN",
		setLang: "zh-CN",
		userAgent: ""
	},
	searxng: {
		baseUrl: "",
		apiKeyRef: "SEARXNG_API_KEY",
		apiKeyHeader: "Authorization",
		apiKeyPrefix: "Bearer ",
		engines: [],
		categories: []
	}
};
/** Merge composition/settings layers into a complete immutable runtime config. */
function completeConfig(input) {
	return {
		...DEFAULT_CONFIG,
		...input,
		bing: {
			...DEFAULT_CONFIG.bing,
			...input?.bing
		},
		searxng: {
			...DEFAULT_CONFIG.searxng,
			...input?.searxng
		}
	};
}
/** Reject unsafe timeout, response, and result limits before registering a tool. */
function assertConfig(config) {
	if (!Number.isInteger(config.maxResults) || config.maxResults < 1 || config.maxResults > 10) throw new Error("maxResults must be an integer between 1 and 10");
	if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1) throw new Error("timeoutMs must be a positive integer");
	if (!Number.isInteger(config.maxResponseBytes) || config.maxResponseBytes < 1) throw new Error("maxResponseBytes must be a positive integer");
	if (config.engine === "searxng" && !config.searxng.baseUrl) throw new Error("SearXNG baseUrl must be configured");
}
const TOOL_OUTPUT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		results: {
			type: "array",
			required: true,
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					title: {
						type: "string",
						required: true
					},
					url: {
						type: "string",
						required: true
					},
					snippet: {
						type: "string",
						required: true
					}
				}
			}
		},
		truncated: {
			type: "boolean",
			required: true
		},
		error: {
			type: "object",
			additionalProperties: false,
			properties: {
				code: {
					type: "string",
					required: true
				},
				message: {
					type: "string",
					required: true
				},
				retryable: {
					type: "boolean",
					required: true
				}
			}
		}
	}
};
/** Convert an internal failure into the stable model-facing error shape. */
function toSearchError(error) {
	if (error instanceof SearchError) return {
		code: error.code,
		message: error.message,
		retryable: error.retryable
	};
	const message = error instanceof Error ? error.message : String(error);
	if (message.includes("credential")) return {
		code: "MISSING_CREDENTIAL",
		message,
		retryable: false
	};
	if (message.includes("baseUrl")) return {
		code: "INVALID_CONFIG",
		message,
		retryable: false
	};
	return {
		code: "INTERNAL_ERROR",
		message: "search failed unexpectedly",
		retryable: false
	};
}
/** Validate model arguments that are stricter than the JSON schema. */
function parseArgs(args) {
	if (typeof args !== "object" || args === null || Array.isArray(args)) throw new Error("invalid search arguments");
	const value = args;
	if (typeof value.query !== "string" || value.query.trim() === "") throw new Error("query must be a non-empty string");
	const limit = value.limit === void 0 ? 10 : value.limit;
	if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("limit must be an integer between 1 and 10");
	if (value.language !== void 0 && typeof value.language !== "string") throw new Error("language must be a string");
	return {
		query: value.query.trim(),
		limit,
		...value.language === void 0 ? {} : { language: value.language }
	};
}
/** Build the selected concrete engine from one immutable settings snapshot. */
function createEngine(config, resolveApiKey) {
	if (config.engine === "bing") {
		const request = createBingRequest(config.timeoutMs, config.maxResponseBytes);
		return createBingEngine(config.bing, request);
	}
	const request = createSearxngRequest(config.timeoutMs, config.maxResponseBytes);
	return createSearxngEngine(config.searxng, request, resolveApiKey);
}
/** Execute one bounded search and preserve a JSON-only canonical result. */
async function executeSearch(config, args, signal, resolveApiKey) {
	const parsed = parseArgs(args);
	try {
		const bounded = boundResults(deduplicateResults((await createEngine(config, resolveApiKey).search({
			...parsed,
			signal
		})).map(normalizeResult).filter((result) => result !== void 0)), Math.min(parsed.limit, config.maxResults));
		return {
			results: bounded.results,
			truncated: bounded.truncated
		};
	} catch (error) {
		return {
			results: [],
			truncated: false,
			error: toSearchError(error)
		};
	}
}
/** Register the model-facing search tool for one settings snapshot. */
function registerTool(ctx, config, resolveApiKey) {
	return ctx.tools.register(defineTool({
		name: "web_search_configured",
		description: "Search Bing or SearXNG for current information through the configured backend. Returns only titles, URLs, and short snippets; it does not fetch webpage content.",
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "Search keywords."
			},
			limit: {
				type: "integer",
				description: "Maximum results, from 1 to 10. Defaults to 10."
			},
			language: {
				type: "string",
				description: "Optional language or market code, such as zh-CN or en-US."
			}
		},
		output: {
			schema: TOOL_OUTPUT_SCHEMA,
			render: (_args, value) => [{
				type: "text",
				text: renderResults(value)
			}]
		},
		timeoutMs: config.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			return executeSearch(config, args, exec.signal, resolveApiKey);
		}
	}));
}
/** Mount the persistent web search tool and live configuration synchronization. */
function apply(ctx, entry) {
	let current = () => entry ?? {};
	let disposeTool;
	let disposePrompt;
	const credentials = ctx.get("credentials");
	const resolveConfig = () => completeConfig(current());
	const resolveApiKey = async () => {
		const ref = resolveConfig().searxng.apiKeyRef;
		if (!ref) return void 0;
		if (credentials) return (await credentials.resolve(credentialRef(ref)))?.value;
		return process.env[ref] || void 0;
	};
	const sync = () => {
		disposeTool?.();
		disposeTool = void 0;
		disposePrompt?.();
		disposePrompt = void 0;
		const config = resolveConfig();
		assertConfig(config);
		if (!config.enabled) return;
		disposeTool = registerTool(ctx, config, resolveApiKey);
		if (config.announceToAgent) disposePrompt = ctx.systemPrompt.section({
			name: "plugin:dsh-web-search",
			order: 145,
			text: SEARCH_GUIDANCE
		});
	};
	installSettingsSection(ctx, WEB_SEARCH_SETTINGS_NAMESPACE, Config, entry ?? {}, {
		setSource: (source) => {
			current = source;
			sync();
		},
		onChange: sync
	});
	sync();
}
//#endregion
export { Config, WEB_SEARCH_SETTINGS_NAMESPACE, apply, inject, name };

//# sourceMappingURL=index.mjs.map