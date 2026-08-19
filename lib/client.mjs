import React from "react";
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
		padding: 16,
		display: "grid",
		gap: 14
	},
	title: {
		margin: 0,
		fontSize: 16,
		fontWeight: 600
	},
	description: {
		margin: 0,
		color: "var(--dsw-alias-label-tertiary)",
		fontSize: 13
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
	return React.createElement("label", { style: styles.field }, React.createElement("span", { style: styles.label }, label), React.createElement("input", {
		style: styles.input,
		type,
		value: value ?? "",
		min,
		max,
		step,
		onChange: (event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)
	}), hint ? React.createElement("span", { style: styles.hint }, hint) : null);
}
function CheckField(props) {
	const { label, checked, onChange } = props;
	return React.createElement("label", { style: {
		...styles.field,
		display: "flex",
		gridTemplateColumns: "auto 1fr",
		alignItems: "center",
		gap: 8
	} }, React.createElement("input", {
		type: "checkbox",
		checked: Boolean(checked),
		onChange: (event) => onChange(event.target.checked)
	}), React.createElement("span", { style: styles.label }, label));
}
function WebSearchSettingsCard(props) {
	const { scope } = props;
	const snapshot = scope.getSnapshot();
	const [draft, setDraft] = React.useState(() => mergeConfig(snapshot.value));
	const [status, setStatus] = React.useState("");
	const [error, setError] = React.useState("");
	React.useEffect(() => scope.subscribe(() => {
		const next = scope.getSnapshot();
		if (next.value) setDraft(mergeConfig(next.value));
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
			setStatus("已保存");
		} catch {
			setError("保存失败，请检查配置值。");
		}
	};
	const discard = () => {
		const next = scope.getSnapshot();
		setDraft(mergeConfig(next.value));
		setError("");
		setStatus("");
	};
	const disabled = snapshot.status !== "ready" || !snapshot.writable;
	return React.createElement("article", { style: styles.card }, React.createElement("div", null, React.createElement("h3", { style: styles.title }, "网页搜索与抓取"), React.createElement("p", { style: styles.description }, "配置 Bing / SearXNG 搜索后端、返回限制和网页抓取行为。")), React.createElement("div", { style: styles.grid }, React.createElement(CheckField, {
		label: "启用工具",
		checked: draft.enabled,
		onChange: (value) => update("enabled", value)
	}), React.createElement(CheckField, {
		label: "启用 Agent 操作提示",
		checked: draft.announceToAgent,
		onChange: (value) => update("announceToAgent", value)
	}), React.createElement(CheckField, {
		label: "启用网页抓取",
		checked: draft.fetch,
		onChange: (value) => update("fetch", value)
	}), React.createElement("label", { style: styles.field }, React.createElement("span", { style: styles.label }, "搜索引擎"), React.createElement("select", {
		style: styles.input,
		value: draft.engine,
		onChange: (event) => update("engine", event.target.value)
	}, React.createElement("option", { value: "bing" }, "Bing"), React.createElement("option", { value: "searxng" }, "SearXNG"))), React.createElement(InputField, {
		label: "最大搜索结果",
		hint: "1 到 10",
		type: "number",
		min: 1,
		max: 10,
		value: draft.maxResults,
		onChange: (value) => update("maxResults", value)
	}), React.createElement(InputField, {
		label: "搜索超时（毫秒）",
		type: "number",
		min: 1,
		value: draft.timeoutMs,
		onChange: (value) => update("timeoutMs", value)
	}), React.createElement(InputField, {
		label: "抓取超时（毫秒）",
		type: "number",
		min: 1,
		value: draft.fetchTimeoutMs,
		onChange: (value) => update("fetchTimeoutMs", value)
	}), React.createElement(InputField, {
		label: "最大响应字节",
		type: "number",
		min: 1,
		value: draft.maxResponseBytes,
		onChange: (value) => update("maxResponseBytes", value)
	}), React.createElement(InputField, {
		label: "抓取输出上限",
		type: "number",
		min: 1,
		value: draft.fetchMaxOutputChars,
		onChange: (value) => update("fetchMaxOutputChars", value)
	})), React.createElement("div", { style: styles.grid }, React.createElement("h4", { style: {
		margin: 0,
		gridColumn: "1 / -1"
	} }, "Bing"), React.createElement(InputField, {
		label: "市场",
		value: draft.bing.market,
		onChange: (value) => update("bing", {
			...draft.bing,
			market: value
		})
	}), React.createElement(InputField, {
		label: "界面语言",
		value: draft.bing.setLang,
		onChange: (value) => update("bing", {
			...draft.bing,
			setLang: value
		})
	}), React.createElement(InputField, {
		label: "User-Agent（可选）",
		value: draft.bing.userAgent,
		onChange: (value) => update("bing", {
			...draft.bing,
			userAgent: value
		})
	})), React.createElement("div", { style: styles.grid }, React.createElement("h4", { style: {
		margin: 0,
		gridColumn: "1 / -1"
	} }, "SearXNG"), React.createElement(InputField, {
		label: "实例地址",
		value: draft.searxng.baseUrl,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			baseUrl: value
		})
	}), React.createElement(InputField, {
		label: "凭据引用",
		hint: "只填写引用名，不要填写密钥本身",
		value: draft.searxng.apiKeyRef,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			apiKeyRef: value
		})
	}), React.createElement(InputField, {
		label: "凭据 Header",
		value: draft.searxng.apiKeyHeader,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			apiKeyHeader: value
		})
	}), React.createElement(InputField, {
		label: "凭据前缀",
		value: draft.searxng.apiKeyPrefix,
		onChange: (value) => update("searxng", {
			...draft.searxng,
			apiKeyPrefix: value
		})
	}), React.createElement(InputField, {
		label: "引擎列表",
		hint: "逗号分隔，可留空",
		value: draft.searxng.engines.join(", "),
		onChange: (value) => update("searxng", {
			...draft.searxng,
			engines: value.split(",").map((item) => item.trim()).filter(Boolean)
		})
	}), React.createElement(InputField, {
		label: "分类列表",
		hint: "逗号分隔，可留空",
		value: draft.searxng.categories.join(", "),
		onChange: (value) => update("searxng", {
			...draft.searxng,
			categories: value.split(",").map((item) => item.trim()).filter(Boolean)
		})
	})), status ? React.createElement("span", { role: "status" }, status) : null, error ? React.createElement("span", {
		role: "alert",
		style: styles.error
	}, error) : null, React.createElement("div", { style: styles.actions }, React.createElement("button", {
		type: "button",
		style: styles.button,
		disabled,
		onClick: discard
	}, "放弃修改"), React.createElement("button", {
		type: "button",
		style: {
			...styles.button,
			...styles.primary
		},
		disabled,
		onClick: save
	}, "保存")));
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
export { apply, inject };

//# sourceMappingURL=client.mjs.map