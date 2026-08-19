window.__ModuleLoader__.load({ id: "dsh-tool-web-search", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let react = require("react");
react = __toESM(react, 1);
//#region src/client.ts
const NAMESPACE = "dsh-web-search";
const DEFAULTS = {
	enabled: true,
	announceToAgent: true,
	fetch: true,
	engine: "bing",
	maxResults: 10,
	timeoutMs: 3e4,
	fetchTimeoutMs: 3e4,
	maxResponseBytes: 2e6,
	fetchMaxOutputChars: 2e5,
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
const styles = {
	card: {
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 8,
		background: "var(--dsw-alias-bg-layer-3)",
		overflow: "hidden"
	},
	cardOpen: {
		background: "var(--dsw-alias-bg-layer-2)",
		borderColor: "var(--dsw-alias-label-dimmed)"
	},
	header: {
		appearance: "none",
		width: "100%",
		boxSizing: "border-box",
		font: "inherit",
		color: "inherit",
		textAlign: "left",
		cursor: "pointer",
		background: "transparent",
		border: 0,
		display: "flex",
		alignItems: "center",
		gap: 12,
		padding: "14px 16px"
	},
	headText: {
		display: "flex",
		flexDirection: "column",
		flex: 1,
		gap: 4,
		minWidth: 0
	},
	title: {
		margin: 0,
		color: "var(--dsw-alias-label-primary)",
		fontSize: 15,
		fontWeight: 600,
		lineHeight: 1.4
	},
	description: {
		margin: 0,
		color: "var(--dsw-alias-label-tertiary)",
		fontSize: 13,
		lineHeight: 1.5
	},
	chevron: {
		color: "var(--dsw-alias-label-tertiary)",
		flex: "none",
		fontSize: 18,
		lineHeight: 1,
		transition: "transform .16s"
	},
	chevronOpen: { transform: "rotate(180deg)" },
	pending: {
		whiteSpace: "nowrap",
		background: "var(--dsw-alias-bg-module-platform)",
		color: "var(--dsw-alias-label-secondary)",
		borderRadius: 999,
		padding: "1px 8px",
		fontSize: 11,
		fontWeight: 500,
		lineHeight: "17px",
		flex: "none"
	},
	body: {
		borderTop: "1px solid var(--dsw-alias-border-l2)",
		margin: "0 16px",
		padding: "14px 0 8px",
		display: "grid",
		gap: 14
	},
	grid: {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
		gap: 12
	},
	field: {
		display: "grid",
		gap: 5
	},
	label: {
		fontSize: 13,
		fontWeight: 500
	},
	hint: {
		color: "var(--dsw-alias-label-tertiary)",
		fontSize: 12
	},
	input: {
		minHeight: 34,
		boxSizing: "border-box",
		padding: "6px 8px",
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 4,
		background: "var(--dsw-alias-fill-control)",
		color: "var(--dsw-alias-label-primary)"
	},
	actions: {
		display: "flex",
		justifyContent: "flex-end",
		gap: 8
	},
	button: {
		minHeight: 34,
		padding: "6px 12px",
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 4,
		background: "var(--dsw-alias-fill-control)",
		color: "var(--dsw-alias-label-primary)",
		cursor: "pointer"
	},
	primary: {
		background: "var(--dsw-alias-state-business-primary)",
		color: "white",
		borderColor: "var(--dsw-alias-state-business-primary)"
	},
	error: {
		color: "var(--dsw-alias-state-danger)",
		fontSize: 13
	}
};
function mergeConfig(value) {
	return {
		...DEFAULTS,
		...value || {},
		bing: {
			...DEFAULTS.bing,
			...value?.bing || {}
		},
		searxng: {
			...DEFAULTS.searxng,
			...value?.searxng || {}
		}
	};
}
function InputField(props) {
	const { label, hint, value, onChange, type = "text", min, max, step = 1 } = props;
	return react.default.createElement("label", { style: styles.field }, react.default.createElement("span", { style: styles.label }, label), react.default.createElement("input", {
		style: styles.input,
		type,
		value: value ?? "",
		min,
		max,
		step,
		onChange: (event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)
	}), hint ? react.default.createElement("span", { style: styles.hint }, hint) : null);
}
function CheckField(props) {
	const { label, checked, onChange } = props;
	return react.default.createElement("label", { style: {
		...styles.field,
		display: "flex",
		gridTemplateColumns: "auto 1fr",
		alignItems: "center",
		gap: 8
	} }, react.default.createElement("input", {
		type: "checkbox",
		checked: Boolean(checked),
		onChange: (event) => onChange(event.target.checked)
	}), react.default.createElement("span", { style: styles.label }, label));
}
function WebSearchSettingsCard(props) {
	const { scope } = props;
	const snapshot = scope.getSnapshot();
	const [draft, setDraft] = react.default.useState(() => mergeConfig(snapshot.value));
	const [open, setOpen] = react.default.useState(false);
	const [dirty, setDirty] = react.default.useState(false);
	const [status, setStatus] = react.default.useState("");
	const [error, setError] = react.default.useState("");
	react.default.useEffect(() => scope.subscribe(() => {
		const next = scope.getSnapshot();
		if (next.value) {
			setDraft(mergeConfig(next.value));
			setDirty(false);
		}
	}), [scope]);
	const update = (path, value) => {
		setDraft((current) => {
			if (path === "bing" || path === "searxng") return {
				...current,
				[path]: value
			};
			return {
				...current,
				[path]: value
			};
		});
		setDirty(true);
		setStatus("");
		setError("");
	};
	const save = async () => {
		setError("");
		setStatus("");
		try {
			for (const field of [
				"enabled",
				"announceToAgent",
				"fetch",
				"engine",
				"maxResults",
				"timeoutMs",
				"fetchTimeoutMs",
				"maxResponseBytes",
				"fetchMaxOutputChars",
				"bing",
				"searxng"
			]) await scope.set(field, draft[field]);
			setDirty(false);
			setStatus("已保存");
		} catch {
			setError("保存失败，请检查配置值。");
		}
	};
	const discard = () => {
		const next = scope.getSnapshot();
		setDraft(mergeConfig(next.value));
		setDirty(false);
		setError("");
		setStatus("");
	};
	const disabled = snapshot.status !== "ready" || !snapshot.writable;
	return react.default.createElement("article", { style: {
		...styles.card,
		...open ? styles.cardOpen : {}
	} }, react.default.createElement("button", {
		type: "button",
		style: styles.header,
		"aria-expanded": open,
		"aria-label": `${open ? "收起" : "展开"}：网页搜索与抓取`,
		onClick: () => setOpen(!open)
	}, react.default.createElement("span", { style: styles.headText }, react.default.createElement("span", { style: styles.title }, "网页搜索与抓取"), react.default.createElement("span", { style: styles.description }, "配置 Bing / SearXNG 搜索后端、返回限制和网页抓取行为。")), dirty ? react.default.createElement("span", { style: styles.pending }, "未保存") : null, react.default.createElement("span", {
		style: {
			...styles.chevron,
			...open ? styles.chevronOpen : {}
		},
		"aria-hidden": true
	}, "⌄")), open ? react.default.createElement("div", { style: styles.body }, react.default.createElement("div", { style: styles.grid }, react.default.createElement(CheckField, {
		label: "启用工具",
		checked: draft.enabled,
		onChange: (value) => update("enabled", value)
	}), react.default.createElement(CheckField, {
		label: "启用 Agent 操作提示",
		checked: draft.announceToAgent,
		onChange: (value) => update("announceToAgent", value)
	}), react.default.createElement(CheckField, {
		label: "启用网页抓取",
		checked: draft.fetch,
		onChange: (value) => update("fetch", value)
	}), react.default.createElement("label", { style: styles.field }, react.default.createElement("span", { style: styles.label }, "搜索引擎"), react.default.createElement("select", {
		style: styles.input,
		value: draft.engine,
		onChange: (event) => update("engine", event.target.value)
	}, react.default.createElement("option", { value: "bing" }, "Bing"), react.default.createElement("option", { value: "searxng" }, "SearXNG"))), react.default.createElement(InputField, {
		label: "最大搜索结果",
		hint: "1 到 10",
		type: "number",
		min: 1,
		max: 10,
		value: draft.maxResults,
		onChange: (value) => update("maxResults", value)
	}), react.default.createElement(InputField, {
		label: "搜索超时（毫秒）",
		type: "number",
		min: 1,
		value: draft.timeoutMs,
		onChange: (value) => update("timeoutMs", value)
	}), react.default.createElement(InputField, {
		label: "抓取超时（毫秒）",
		type: "number",
		min: 1,
		value: draft.fetchTimeoutMs,
		onChange: (value) => update("fetchTimeoutMs", value)
	}), react.default.createElement(InputField, {
		label: "最大响应字节",
		type: "number",
		min: 1,
		value: draft.maxResponseBytes,
		onChange: (value) => update("maxResponseBytes", value)
	}), react.default.createElement(InputField, {
		label: "抓取输出上限",
		type: "number",
		min: 1,
		value: draft.fetchMaxOutputChars,
		onChange: (value) => update("fetchMaxOutputChars", value)
	})), react.default.createElement("div", { style: styles.grid }, react.default.createElement("h4", { style: {
		margin: 0,
		gridColumn: "1 / -1"
	} }, "Bing"), react.default.createElement(InputField, {
		label: "市场",
		value: draft.bing.market,
		onChange: (value) => update("bing", {
			...draft.bing,
			market: value
		})
	}), react.default.createElement(InputField, {
		label: "界面语言",
		value: draft.bing.setLang,
		onChange: (value) => update("bing", {
			...draft.bing,
			setLang: value
		})
	}), react.default.createElement(InputField, {
		label: "User-Agent（可选）",
		value: draft.bing.userAgent,
		onChange: (value) => update("bing", {
			...draft.bing,
			userAgent: value
		})
	})), react.default.createElement("div", { style: styles.grid }, react.default.createElement("h4", { style: {
		margin: 0,
		gridColumn: "1 / -1"
	} }, "SearXNG"), react.default.createElement(InputField, {
		label: "实例地址",
		value: draft.searxng.baseUrl,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			baseUrl: value
		})
	}), react.default.createElement(InputField, {
		label: "凭据引用",
		hint: "只填写引用名，不要填写密钥本身",
		value: draft.searxng.apiKeyRef,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			apiKeyRef: value
		})
	}), react.default.createElement(InputField, {
		label: "凭据 Header",
		value: draft.searxng.apiKeyHeader,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			apiKeyHeader: value
		})
	}), react.default.createElement(InputField, {
		label: "凭据前缀",
		value: draft.searxng.apiKeyPrefix,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			apiKeyPrefix: value
		})
	}), react.default.createElement(InputField, {
		label: "引擎列表",
		hint: "逗号分隔，可留空",
		value: draft.searxng.engines.join(", "),
		onChange: (value) => update("searxng", {
			...draft.searxng,
			engines: value.split(",").map((item) => item.trim()).filter(Boolean)
		})
	}), react.default.createElement(InputField, {
		label: "分类列表",
		hint: "逗号分隔，可留空",
		value: draft.searxng.categories.join(", "),
		onChange: (value) => update("searxng", {
			...draft.searxng,
			categories: value.split(",").map((item) => item.trim()).filter(Boolean)
		})
	})), status ? react.default.createElement("span", { role: "status" }, status) : null, error ? react.default.createElement("span", {
		role: "alert",
		style: styles.error
	}, error) : null, react.default.createElement("div", { style: styles.actions }, react.default.createElement("button", {
		type: "button",
		style: styles.button,
		disabled,
		onClick: discard
	}, "放弃修改"), react.default.createElement("button", {
		type: "button",
		style: {
			...styles.button,
			...styles.primary
		},
		disabled,
		onClick: save
	}, "保存"))) : null);
}
const inject = ["slots", "settingsScope"];
function apply(ctx) {
	const scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
	ctx.slots.inject("web-ui.plugin.item", () => {
		return ctx.slots.register({
			name: "web-ui.plugin.item",
			id: NAMESPACE,
			order: 120,
			inject: () => ({ scope })
		}, WebSearchSettingsCard);
	});
	ctx.slots.inject("settings.plugin.item", () => {
		return ctx.slots.register({
			name: "settings.plugin.item",
			key: NAMESPACE,
			inject: () => ({ scope })
		}, WebSearchSettingsCard);
	});
}
//#endregion
exports.apply = apply;
exports.inject = inject;

//# sourceMappingURL=client.cjs.map
return module.exports; } });
