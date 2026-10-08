//#region public/system-readiness-panel.ts
var e = "systemReadinessCard", t = {
	auth: "Kimlik doğrulama",
	pwa: "PWA",
	skills: "Ajanlar / Skills",
	memory: "Bellek",
	schedule: "Görev zamanlama",
	connectors: "Bağlantılar",
	model: "Model",
	release: "Sürüm"
}, n = {
	ready: "Hazır",
	warning: "Uyarı",
	degraded: "Kısmen hazır",
	blocked: "Engelli",
	unknown: "Bilinmiyor"
}, r = (e, t, n, r) => {
	let i = e.createElement(t);
	return n && (i.className = n), r !== void 0 && (i.textContent = r), i;
};
async function i(e) {
	let t = await fetch("/api/health", {
		method: "GET",
		headers: { Accept: "application/json" },
		cache: "no-store",
		signal: e
	});
	if (!t.ok) throw Error("HEALTH_HTTP_" + t.status);
	let n = await t.json();
	if (!n || typeof n != "object") throw Error("HEALTH_INVALID_RESPONSE");
	return n;
}
function a(a = document, o = window) {
	let s = a.querySelector(".utility-rail");
	if (!s || a.getElementById(e)) return null;
	let c = r(a, "section", "utility-card system-readiness-card");
	c.id = e, c.setAttribute("aria-labelledby", "systemReadinessTitle");
	let l = r(a, "div", "utility-head system-readiness-head");
	l.append(r(a, "span", "mini-icon", "◈")), l.append(r(a, "strong", "", "Sistem sağlığı"));
	let u = r(a, "button", "mini-btn", "Raporu kopyala");
	u.type = "button", u.setAttribute("aria-label", "Sistem sağlık özetini panoya kopyala");
	let d = r(a, "button", "mini-btn", "Yenile");
	d.type = "button", d.setAttribute("aria-label", "Sistem sağlığı durumunu yenile"), l.append(u, d);
	let f = r(a, "span", "system-readiness-title", "Hafize çalışma durumu");
	f.id = "systemReadinessTitle", f.hidden = !0;
	let p = r(a, "div", "system-readiness-summary");
	p.setAttribute("aria-live", "polite");
	let m = r(a, "span", "system-readiness-state", "Kontrol ediliyor…"), h = r(a, "span", "system-readiness-counts", "");
	p.append(m, h);
	let g = r(a, "div", "system-readiness-list");
	g.setAttribute("role", "list");
	let _ = r(a, "div", "system-readiness-time", ""), v = null, y = r(a, "div", "system-readiness-error", "");
	y.setAttribute("role", "alert"), c.append(l, f, p, g, _, y), s.append(c);
	let b = 0, x = null, S = !1, C = (e) => {
		v = e;
		let i = e.readiness, o = i?.state || "unknown";
		m.textContent = n[o] || "Bilinmiyor", m.dataset.state = o;
		let s = i?.summary || {};
		h.textContent = [
			s.ready || 0,
			s.warning || 0,
			s.blocked || 0,
			s.unknown || 0
		].join(" / "), g.replaceChildren();
		for (let [e, o] of Object.entries(i?.components || {})) {
			let i = r(a, "div", "system-readiness-row");
			i.setAttribute("role", "listitem");
			let s = r(a, "span", "system-readiness-name", t[e] || e), c = r(a, "span", "system-readiness-badge", n[o] || o);
			c.dataset.state = o, i.append(s, c), g.append(i);
		}
		_.textContent = "Son kontrol: " + new Intl.DateTimeFormat("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit"
		}).format(/* @__PURE__ */ new Date()), y.textContent = "";
	}, w = (e) => {
		m.textContent = "Kontrol başarısız", m.dataset.state = "blocked", y.textContent = e;
	}, T = async () => {
		if (S) return;
		x?.abort(), x = new AbortController();
		let e = o.setTimeout(() => x?.abort(), 8e3);
		d.disabled = !0;
		try {
			let e = await i(x.signal);
			C(e);
		} catch {
			w("Sistem sağlık bilgisi alınamadı.");
		} finally {
			o.clearTimeout(e), d.disabled = !1;
		}
	};
	return u.addEventListener("click", async () => {
		let e = v?.readiness;
		if (!e) {
			y.textContent = "Önce sistem sağlığı kontrol edilmeli.";
			return;
		}
		let r = Object.entries(e.components || {}).map(([e, r]) => (t[e] || e) + ": " + (n[r] || r)), i = ["Hafize sistem sağlığı: " + (n[e.state || "unknown"] || "Bilinmiyor"), ...r].join("\\n");
		try {
			await navigator.clipboard.writeText(i.slice(0, 4e3)), y.textContent = "Güvenli özet panoya kopyalandı.";
		} catch {
			y.textContent = "Rapor panoya kopyalanamadı.";
		}
	}), d.addEventListener("click", T), T(), b = o.setInterval(T, 6e4), Object.freeze({
		refresh: T,
		destroy: () => {
			S = !0, x?.abort(), o.clearInterval(b), c.remove();
		}
	});
}
typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => {
	a();
}, { once: !0 }) : a());
//#endregion

//# sourceMappingURL=system-readiness-panel.js.map