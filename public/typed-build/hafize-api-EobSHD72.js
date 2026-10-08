//#region public/typed/hafize-types.ts
var e = class extends Error {
	code;
	status;
	traceId;
	retryable;
	constructor(e, t = {}) {
		super(e), this.name = "HafizeApiError", this.code = t.code ?? "API_ERROR", this.status = t.status ?? 0, this.traceId = t.traceId ?? null, this.retryable = t.retryable ?? !1;
	}
};
function t(e) {
	return typeof e == "object" && !!e;
}
function n(e, t = "") {
	if (typeof e != "string") return t;
	let n = e.trim();
	return n === "__proto__" || n === "prototype" || n === "constructor" ? t : e;
}
function r(e, t = !1) {
	return typeof e == "boolean" ? e : t;
}
function i(e, t = 0) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function a(e) {
	let r = t(e) ? e : {}, i = Array.isArray(r.agents) ? r.agents.flatMap((e) => {
		if (!t(e) || typeof e.id != "string" || typeof e.name != "string") return [];
		let n = typeof e.description == "string" ? e.description.slice(0, 320) : void 0, r = Array.isArray(e.tools) ? e.tools.filter((e) => typeof e == "string").slice(0, 64) : void 0;
		return [{
			id: e.id.slice(0, 160),
			name: e.name.slice(0, 160),
			...n ? { description: n } : {},
			...r ? { tools: r } : {}
		}];
	}) : [];
	return Object.freeze({
		defaultAgent: n(r.defaultAgent).slice(0, 160),
		agents: Object.freeze(i)
	});
}
function o(e) {
	let n = t(e) ? e : {}, r = Array.isArray(n.models) ? n.models.filter((e) => typeof e == "string" && e.length > 0).map((e) => e.slice(0, 240)).slice(0, 200) : [];
	return Object.freeze({ models: Object.freeze(r) });
}
function s(e) {
	let a = t(e) ? e : {};
	return Object.freeze({
		status: n(a.status, "unknown").slice(0, 80),
		nvidiaConfigured: r(a.nvidiaConfigured),
		githubReadConfigured: r(a.githubReadConfigured),
		canvaReadConfigured: r(a.canvaReadConfigured),
		gmailReadConfigured: r(a.gmailReadConfigured),
		contextCompactionConfigured: r(a.contextCompactionConfigured),
		scheduleWorkerConfigured: r(a.scheduleWorkerConfigured),
		scheduleApiConfigured: r(a.scheduleApiConfigured),
		scheduleStorageDurable: r(a.scheduleStorageDurable),
		scheduleLeaseConfigured: r(a.scheduleLeaseConfigured),
		agents: Math.max(0, Math.floor(i(a.agents)))
	});
}
function c(e, t) {
	return t ? e ? e.status === "ok" && e.nvidiaConfigured ? "online" : "degraded" : "unknown" : "offline";
}
//#endregion
//#region public/typed/hafize-api.ts
var l = 12e3, u = 6e4, d = 3, f = 1500;
function p(e, t) {
	return new Promise((n, r) => {
		let i = globalThis.setTimeout(n, e);
		if (!t) return;
		let a = () => {
			globalThis.clearTimeout(i), r(t.reason ?? new DOMException("Aborted", "AbortError"));
		};
		if (t.aborted) return a();
		t.addEventListener("abort", a, { once: !0 });
	});
}
function m(e) {
	let t = Math.floor(Math.random() * 120);
	return Math.min(f, 300 * (e + 1) + t);
}
function h(e) {
	return e.headers.get("X-Hafize-Trace-Id") || null;
}
async function g(e) {
	try {
		return await e.clone().json();
	} catch {
		return null;
	}
}
function _(r, i) {
	let a = t(i) ? i : {}, o = n(a.error, "API_ERROR").slice(0, 100), s = n(a.message, "İstek işlenemedi.").slice(0, 240), c = r.status === 408 || r.status === 425 || r.status === 429 || r.status >= 500;
	return new e(s, {
		code: o,
		status: r.status,
		traceId: h(r),
		retryable: c
	});
}
var v = new class {
	baseUrl;
	fetchImpl;
	constructor(e = "", t = globalThis.fetch.bind(globalThis)) {
		this.baseUrl = e.replace(/\/+$/, ""), this.fetchImpl = t;
	}
	buildUrl(e) {
		return `${this.baseUrl}${e.startsWith("/") ? e : `/${e}`}`;
	}
	async request(t, n = {}) {
		let r = Math.min(u, Math.max(1e3, n.timeoutMs ?? l)), i = Math.min(d, Math.max(0, n.retry ?? 1)), a = new Headers(n.headers);
		a.set("Accept", a.get("Accept") || "application/json");
		for (let o = 0; o <= i; o += 1) {
			let s = new AbortController(), c = globalThis.setTimeout(() => s.abort(new DOMException("Request timeout", "TimeoutError")), r), l = n.signal, u = () => s.abort(l?.reason ?? new DOMException("Aborted", "AbortError"));
			try {
				l?.aborted ? u() : l?.addEventListener("abort", u, { once: !0 });
				let e = await this.fetchImpl(this.buildUrl(t), {
					...n,
					signal: s.signal,
					headers: a
				});
				if (!e.ok) throw _(e, await g(e));
				return await e.json();
			} catch (t) {
				let n = t instanceof e ? t : new e(t instanceof Error ? t.message : "Ağ isteği başarısız.", {
					code: t instanceof DOMException && t.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR",
					retryable: !0
				});
				if (!n.retryable || o >= i) throw n;
				await p(m(o), l);
			} finally {
				globalThis.clearTimeout(c), l?.removeEventListener("abort", u);
			}
		}
		throw new e("Ağ isteği başarısız.");
	}
	health(e) {
		return this.request("/api/health", {
			signal: e,
			timeoutMs: 8e3,
			retry: 1
		}).then(s);
	}
	models(e) {
		return this.request("/api/models", {
			signal: e,
			timeoutMs: 12e3,
			retry: 1
		}).then(o);
	}
	agents(e) {
		return this.request("/api/agents", {
			signal: e,
			timeoutMs: 8e3,
			retry: 1
		}).then(a);
	}
}();
//#endregion
export { c as n, v as t };

//# sourceMappingURL=hafize-api-EobSHD72.js.map