import { n as e, t } from "./hafize-api-D02cTYIK.js";
//#region public/typed/app-runtime.ts
var n = "hafizeRuntimeStatus", r = "hafizeRuntimeDetails", i = 6e4, a = "toast";
function o(e, t) {
	let n = document.createElement("button");
	return n.type = "button", n.className = t, n.textContent = e, n;
}
function s() {
	let e = document.querySelector(".topbar");
	if (!e || document.getElementById(n)) return null;
	let t = o("… Kontrol ediliyor", "runtime-status");
	t.id = n, t.setAttribute("aria-live", "polite"), t.setAttribute("aria-expanded", "false"), t.setAttribute("aria-controls", r);
	let i = document.createElement("section");
	i.id = r, i.className = "runtime-details", i.hidden = !0, i.setAttribute("role", "dialog"), i.setAttribute("aria-modal", "false"), i.setAttribute("aria-labelledby", `${r}Title`);
	let a = document.createElement("div");
	a.className = "runtime-details-head";
	let s = document.createElement("strong");
	s.id = `${r}Title`, s.textContent = "Hafize sistem durumu";
	let c = o("Kapat", "mini-btn");
	c.setAttribute("aria-label", "Sistem durumu panelini kapat"), a.append(s, c);
	let l = document.createElement("div");
	l.className = "runtime-details-body";
	let u = o("Şimdi yenile", "soft-btn");
	u.className += " runtime-details-refresh", i.append(a, l, u);
	let d = e.querySelector("#themeToggle");
	return d ? e.insertBefore(t, d) : e.append(t), e.append(i), {
		status: t,
		details: i,
		body: l,
		close: c,
		refresh: u
	};
}
function c(e) {
	return e === "online" ? "Çevrimiçi" : e === "offline" ? "Çevrimdışı" : e === "degraded" ? "Sınırlı" : "Kontrol ediliyor";
}
function l(e) {
	return e === "online" ? "●" : e === "offline" ? "○" : e === "degraded" ? "◐" : "…";
}
function u(e) {
	return e === "online" ? "success" : e === "degraded" ? "warning" : e === "offline" ? "error" : "info";
}
function d(e, t) {
	let n = document.getElementById(a);
	n && (n.dataset.severity = t, n.textContent = e.slice(0, 180), n.classList.remove("hidden"), globalThis.setTimeout(() => n.classList.add("hidden"), 3200));
}
function f(e, t, n) {
	let r = document.createElement("div");
	r.className = "runtime-details-row";
	let i = document.createElement("span");
	i.className = "runtime-details-label", i.textContent = t;
	let a = document.createElement("span");
	a.className = "runtime-details-value", a.textContent = n, r.append(i, a), e.append(r);
}
function p(e, t) {
	if (e.replaceChildren(), !t) {
		let t = document.createElement("p");
		t.textContent = "Sunucu sağlık bilgisi alınamadı.", e.append(t);
		return;
	}
	f(e, "API", t.status === "ok" ? "Hazır" : "Sınırlı"), f(e, "NVIDIA NIM", t.nvidiaConfigured ? "Hazır" : "Yapılandırılmamış"), f(e, "Ajanlar", String(t.agents)), f(e, "Context compaction", t.contextCompactionConfigured ? "Açık" : "Kapalı"), f(e, "Scheduled worker", t.scheduleWorkerConfigured ? "Hazır" : "Kapalı"), f(e, "Görev depolama", t.scheduleStorageDurable ? "Kalıcı" : "Geçici"), f(e, "Lease koruması", t.scheduleLeaseConfigured ? "Açık" : "Kapalı"), f(e, "GitHub", t.githubReadConfigured ? "Hazır" : "Kapalı"), f(e, "Canva", t.canvaReadConfigured ? "Hazır" : "Kapalı"), f(e, "Gmail", t.gmailReadConfigured ? "Hazır" : "Kapalı");
}
function m(e, t) {
	let n = c(t.connectivity);
	e.status.textContent = `${l(t.connectivity)} ${n}`, e.status.dataset.tone = u(t.connectivity), e.status.title = t.checkedAt ? `Son kontrol: ${new Date(t.checkedAt).toLocaleTimeString("tr-TR")}` : "Henüz kontrol yapılmadı", p(e.body, t.health);
}
function h() {
	let n = s();
	if (!n) return null;
	let r = Object.freeze({
		connectivity: navigator.onLine ? "unknown" : "offline",
		checkedAt: null,
		apiReachable: !1,
		health: null,
		lastErrorCode: null
	}), a, o = !1, c = async () => {
		if (o) return;
		if (!navigator.onLine) {
			r = Object.freeze({
				...r,
				connectivity: "offline",
				apiReachable: !1,
				checkedAt: (/* @__PURE__ */ new Date()).toISOString()
			}), m(n, r);
			return;
		}
		let i = new AbortController();
		try {
			let n = await t.health(i.signal);
			r = Object.freeze({
				connectivity: e(n, !0),
				checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
				apiReachable: !0,
				health: n,
				lastErrorCode: null
			});
		} catch (e) {
			let t = e instanceof Error && "code" in e ? String(e.code) : "NETWORK_ERROR";
			r = Object.freeze({
				...r,
				connectivity: "degraded",
				checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
				apiReachable: !1,
				lastErrorCode: t.slice(0, 80)
			});
		}
		m(n, r);
	}, l = () => {
		n.details.hidden = !n.details.hidden, n.status.setAttribute("aria-expanded", String(!n.details.hidden));
	}, u = () => {
		n.details.hidden = !0, n.status.setAttribute("aria-expanded", "false"), n.status.focus();
	}, f = () => {
		c(), d("Bağlantı geri geldi.", "success");
	}, p = () => {
		r = Object.freeze({
			...r,
			connectivity: "offline",
			apiReachable: !1,
			checkedAt: (/* @__PURE__ */ new Date()).toISOString()
		}), m(n, r), d("İnternet bağlantısı kesildi.", "error");
	}, h = (e) => {
		e.key === "Escape" && !n.details.hidden && u();
	};
	return n.status.addEventListener("click", l), n.close.addEventListener("click", u), n.refresh.addEventListener("click", () => {
		c();
	}), document.addEventListener("keydown", h), globalThis.addEventListener("online", f), globalThis.addEventListener("offline", p), c(), a = globalThis.setInterval(() => {
		c();
	}, i), Object.freeze({
		snapshot: () => r,
		refresh: c,
		destroy: () => {
			o = !0, a !== void 0 && globalThis.clearInterval(a), n.status.removeEventListener("click", l), n.close.removeEventListener("click", u), document.removeEventListener("keydown", h), globalThis.removeEventListener("online", f), globalThis.removeEventListener("offline", p), n.details.remove(), n.status.remove();
		}
	});
}
h() && globalThis.dispatchEvent(new CustomEvent("hafize:runtime-ready"));
//#endregion
export { h as mountHafizeRuntime };

//# sourceMappingURL=app-runtime.js.map