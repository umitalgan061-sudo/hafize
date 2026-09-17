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
	return typeof e == "string" ? e : t;
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
				await p(m(o), l ?? void 0);
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
}(), y = "hafizeRuntimeStatus", b = "hafizeRuntimeDetails", x = 6e4, S = "toast";
function C(e, t) {
	let n = document.createElement("button");
	return n.type = "button", n.className = t, n.textContent = e, n;
}
function w() {
	let e = document.querySelector(".topbar");
	if (!e || document.getElementById(y)) return null;
	let t = C("… Kontrol ediliyor", "runtime-status");
	t.id = y, t.setAttribute("aria-live", "polite"), t.setAttribute("aria-expanded", "false"), t.setAttribute("aria-controls", b);
	let n = document.createElement("section");
	n.id = b, n.className = "runtime-details", n.hidden = !0, n.setAttribute("role", "dialog"), n.setAttribute("aria-modal", "false"), n.setAttribute("aria-labelledby", `${b}Title`);
	let r = document.createElement("div");
	r.className = "runtime-details-head";
	let i = document.createElement("strong");
	i.id = `${b}Title`, i.textContent = "Hafize sistem durumu";
	let a = C("Kapat", "mini-btn");
	a.setAttribute("aria-label", "Sistem durumu panelini kapat"), r.append(i, a);
	let o = document.createElement("div");
	o.className = "runtime-details-body";
	let s = C("Şimdi yenile", "soft-btn");
	s.className += " runtime-details-refresh", n.append(r, o, s);
	let c = e.querySelector("#themeToggle");
	return c ? e.insertBefore(t, c) : e.append(t), e.append(n), {
		status: t,
		details: n,
		body: o,
		close: a,
		refresh: s
	};
}
function T(e) {
	return e === "online" ? "Çevrimiçi" : e === "offline" ? "Çevrimdışı" : e === "degraded" ? "Sınırlı" : "Kontrol ediliyor";
}
function E(e) {
	return e === "online" ? "●" : e === "offline" ? "○" : e === "degraded" ? "◐" : "…";
}
function D(e) {
	return e === "online" ? "success" : e === "degraded" ? "warning" : e === "offline" ? "error" : "info";
}
function O(e, t) {
	let n = document.getElementById(S);
	n && (n.dataset.severity = t, n.textContent = e.slice(0, 180), n.classList.remove("hidden"), globalThis.setTimeout(() => n.classList.add("hidden"), 3200));
}
function k(e, t, n) {
	let r = document.createElement("div");
	r.className = "runtime-details-row";
	let i = document.createElement("span");
	i.className = "runtime-details-label", i.textContent = t;
	let a = document.createElement("span");
	a.className = "runtime-details-value", a.textContent = n, r.append(i, a), e.append(r);
}
function A(e, t) {
	if (e.replaceChildren(), !t) {
		let t = document.createElement("p");
		t.textContent = "Sunucu sağlık bilgisi alınamadı.", e.append(t);
		return;
	}
	k(e, "API", t.status === "ok" ? "Hazır" : "Sınırlı"), k(e, "NVIDIA NIM", t.nvidiaConfigured ? "Hazır" : "Yapılandırılmamış"), k(e, "Ajanlar", String(t.agents)), k(e, "Context compaction", t.contextCompactionConfigured ? "Açık" : "Kapalı"), k(e, "Scheduled worker", t.scheduleWorkerConfigured ? "Hazır" : "Kapalı"), k(e, "Görev depolama", t.scheduleStorageDurable ? "Kalıcı" : "Geçici"), k(e, "Lease koruması", t.scheduleLeaseConfigured ? "Açık" : "Kapalı"), k(e, "GitHub", t.githubReadConfigured ? "Hazır" : "Kapalı"), k(e, "Canva", t.canvaReadConfigured ? "Hazır" : "Kapalı"), k(e, "Gmail", t.gmailReadConfigured ? "Hazır" : "Kapalı");
}
function j(e, t) {
	let n = T(t.connectivity);
	e.status.textContent = `${E(t.connectivity)} ${n}`, e.status.dataset.tone = D(t.connectivity), e.status.title = t.checkedAt ? `Son kontrol: ${new Date(t.checkedAt).toLocaleTimeString("tr-TR")}` : "Henüz kontrol yapılmadı", A(e.body, t.health);
}
function M() {
	let e = w();
	if (!e) return null;
	let t = Object.freeze({
		connectivity: navigator.onLine ? "unknown" : "offline",
		checkedAt: null,
		apiReachable: !1,
		health: null,
		lastErrorCode: null
	}), n, r = !1, i = async () => {
		if (r) return;
		if (!navigator.onLine) {
			t = Object.freeze({
				...t,
				connectivity: "offline",
				apiReachable: !1,
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			}), j(e, t);
			return;
		}
		let n = new AbortController();
		try {
			let e = await v.health(n.signal);
			t = Object.freeze({
				connectivity: c(e, !0),
				checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
				apiReachable: !0,
				health: e,
				lastErrorCode: null
			});
		} catch (e) {
			let n = e instanceof Error && "code" in e ? String(e.code) : "NETWORK_ERROR";
			t = Object.freeze({
				...t,
				connectivity: "degraded",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
				apiReachable: !1,
				lastErrorCode: n.slice(0, 80)
			});
		}
		j(e, t);
	}, a = () => {
		e.details.hidden = !e.details.hidden, e.status.setAttribute("aria-expanded", String(!e.details.hidden));
	}, o = () => {
		e.details.hidden = !0, e.status.setAttribute("aria-expanded", "false"), e.status.focus();
	}, s = () => {
		i(), O("Bağlantı geri geldi.", "success");
	}, l = () => {
		t = Object.freeze({
			...t,
			connectivity: "offline",
			apiReachable: !1,
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		}), j(e, t), O("İnternet bağlantısı kesildi.", "error");
	}, u = (t) => {
		t.key === "Escape" && !e.details.hidden && o();
	};
	return e.status.addEventListener("click", a), e.close.addEventListener("click", o), e.refresh.addEventListener("click", () => {
		i();
	}), document.addEventListener("keydown", u), globalThis.addEventListener("online", s), globalThis.addEventListener("offline", l), i(), n = globalThis.setInterval(() => {
		i();
	}, x), Object.freeze({
		snapshot: () => t,
		refresh: i,
		destroy: () => {
			r = !0, n !== void 0 && globalThis.clearInterval(n), e.status.removeEventListener("click", a), e.close.removeEventListener("click", o), document.removeEventListener("keydown", u), globalThis.removeEventListener("online", s), globalThis.removeEventListener("offline", l), e.details.remove(), e.status.remove();
		}
	});
}
M() && globalThis.dispatchEvent(new CustomEvent("hafize:runtime-ready"));
//#endregion
export { M as mountHafizeRuntime };

//# sourceMappingURL=app-runtime.js.map