import z from '@deepseek-ai/schemastery';
import type { WebSearchConfig } from './types.js';
/** Stable Cordis plugin name. */
export declare const name = "web-search";
/** Services required by the model-facing search tool. */
export declare const inject: string[];
/** Settings namespace owned by this plugin. */
export declare const WEB_SEARCH_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Schema defaults for the persistent search configuration. */
export declare const Config: z<Schemastery.ObjectS<{
    enabled: z<boolean, boolean>;
    announceToAgent: z<boolean, boolean>;
    engine: z<"bing" | "searxng", "bing" | "searxng">;
    maxResults: z<number, number>;
    timeoutMs: z<number, number>;
    maxResponseBytes: z<number, number>;
    bing: z<Schemastery.ObjectS<{
        market: z<string, string>;
        setLang: z<string, string>;
        userAgent: z<string, string>;
    }>, Schemastery.ObjectT<{
        market: z<string, string>;
        setLang: z<string, string>;
        userAgent: z<string, string>;
    }>>;
    searxng: z<Schemastery.ObjectS<{
        baseUrl: z<string, string>;
        apiKeyRef: z<string, string>;
        apiKeyHeader: z<string, string>;
        apiKeyPrefix: z<string, string>;
        engines: z<string[], string[]>;
        categories: z<string[], string[]>;
    }>, Schemastery.ObjectT<{
        baseUrl: z<string, string>;
        apiKeyRef: z<string, string>;
        apiKeyHeader: z<string, string>;
        apiKeyPrefix: z<string, string>;
        engines: z<string[], string[]>;
        categories: z<string[], string[]>;
    }>>;
}>, Schemastery.ObjectT<{
    enabled: z<boolean, boolean>;
    announceToAgent: z<boolean, boolean>;
    engine: z<"bing" | "searxng", "bing" | "searxng">;
    maxResults: z<number, number>;
    timeoutMs: z<number, number>;
    maxResponseBytes: z<number, number>;
    bing: z<Schemastery.ObjectS<{
        market: z<string, string>;
        setLang: z<string, string>;
        userAgent: z<string, string>;
    }>, Schemastery.ObjectT<{
        market: z<string, string>;
        setLang: z<string, string>;
        userAgent: z<string, string>;
    }>>;
    searxng: z<Schemastery.ObjectS<{
        baseUrl: z<string, string>;
        apiKeyRef: z<string, string>;
        apiKeyHeader: z<string, string>;
        apiKeyPrefix: z<string, string>;
        engines: z<string[], string[]>;
        categories: z<string[], string[]>;
    }>, Schemastery.ObjectT<{
        baseUrl: z<string, string>;
        apiKeyRef: z<string, string>;
        apiKeyHeader: z<string, string>;
        apiKeyPrefix: z<string, string>;
        engines: z<string[], string[]>;
        categories: z<string[], string[]>;
    }>>;
}>>;
/** Mount the persistent web search tool and live configuration synchronization. */
export declare function apply(ctx: any, entry?: Partial<WebSearchConfig>): void;
//# sourceMappingURL=index.d.ts.map