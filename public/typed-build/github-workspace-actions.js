//#region public/github-workspace-actions.ts
var e = globalThis, t = "githubWorkspaceCard", n = "hafize.github-workspace.history.v1", r = 6, i = 120;
function a(e, t, n, r) {
	let i = e.createElement(t);
	return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
}
function o(e, t) {
	return typeof e == "string" ? e.trim().slice(0, t) : "";
}
function s() {
	try {
		let e = sessionStorage.getItem(n) || "[]", t = JSON.parse(e);
		return Array.isArray(t) ? t.filter((e) => typeof e == "string").map((e) => e.trim().slice(0, i)).filter(Boolean).slice(0, r) : [];
	} catch {
		return [];
	}
}
function c(e) {
	try {
		sessionStorage.setItem(n, JSON.stringify(e.slice(0, r)));
	} catch {}
}
function l(e) {
	let t = o(e, i);
	t && c([t, ...s().filter((e) => e.toLowerCase() !== t.toLowerCase())].slice(0, r));
}
function u(e) {
	return /^https:\/\/github\.com\//i.test(e);
}
function d(n = e.document) {
	let r = n?.getElementById(t);
	if (!n || !r || r.querySelector(".github-workspace-actions")) return null;
	let c = [...r.querySelectorAll("input")].find((e) => e.getAttribute("aria-label") === "GitHub repository"), d = [...r.querySelectorAll("input")].find((e) => e.getAttribute("aria-label") === "GitHub branch veya ref"), f = r.querySelector(".github-workspace-result"), p = r.querySelector(".github-workspace-status");
	if (!c || !d || !f) return null;
	let m = a(n, "div", void 0, "github-workspace-actions");
	m.setAttribute("aria-label", "GitHub hızlı işlemleri");
	let h = a(n, "button", "Yenile", "mini-btn");
	h.type = "button";
	let g = a(n, "button", "Görüneni kopyala", "mini-btn");
	g.type = "button";
	let _ = a(n, "select", void 0, "github-workspace-state");
	_.setAttribute("aria-label", "PR durum filtresi");
	for (let [e, t] of [
		["open", "Açık PR"],
		["closed", "Kapalı PR"],
		["all", "Tüm PR"]
	]) {
		let r = a(n, "option", t);
		r.value = e, _.append(r);
	}
	let v = a(n, "div", void 0, "github-workspace-history");
	v.setAttribute("aria-label", "Son repositoryler"), m.append(h, g, _, v), r.querySelector(".github-workspace-form")?.after(m);
	let y = (e) => {
		p && (p.textContent = o(e, 220));
	}, b = r.querySelector(".github-workspace-form button"), x = [...r.querySelectorAll("[data-github-workspace-action]")], S = () => {
		b?.click();
	}, C = () => {
		v.replaceChildren();
		let e = s();
		e.length ? e.forEach((e) => {
			let t = a(n, "button", e, "mini-btn github-workspace-history-item");
			t.type = "button", t.title = e, t.setAttribute("aria-label", e + " repository’sini yükle"), t.addEventListener("click", () => {
				c.value = e, d.value = "", y(e + " repository seçildi."), S();
			}), v.append(t);
		}) : v.append(a(n, "span", "Bu oturumda repository geçmişi yok.", "github-workspace-history-empty"));
	}, w = () => {
		let e = o(c.value, i);
		e && (l(e), C());
	}, T = () => w();
	c.addEventListener("change", T), c.addEventListener("blur", T), h.addEventListener("click", () => {
		w(), S();
	}), _.addEventListener("change", () => {
		r.querySelector("[data-github-workspace-action=\"pulls\"]")?.click(), w();
		let t = new URL("/api/github/workspace", e.location?.origin || window.location.origin);
		t.searchParams.set("action", "pulls"), t.searchParams.set("repository", o(c.value, i)), t.searchParams.set("state", _.value), t.searchParams.set("limit", "30"), _.disabled = !0, fetch(t.pathname + "?" + t.searchParams.toString(), {
			method: "GET",
			headers: { Accept: "application/json" },
			credentials: "same-origin",
			cache: "no-store"
		}).then(async (e) => {
			let t = await e.json().catch(() => ({}));
			if (!e.ok) throw Error(o(t.error, 100) || "GITHUB_WORKSPACE_FAILED");
			let r = Array.isArray(t.pullRequests) ? t.pullRequests : [];
			f.replaceChildren();
			let i = a(n, "div", void 0, "github-workspace-list");
			r.length || i.append(a(n, "span", "PR bulunamadı.", "github-workspace-empty"));
			for (let e of r) {
				if (!e || typeof e != "object") continue;
				let t = e, r = a(n, "article", void 0, "github-workspace-row");
				r.append(a(n, "strong", "#" + String(t.number ?? "") + " · " + o(t.title, 220))), r.append(a(n, "div", o(t.author, 120) + " · " + o(t.head, 200) + " → " + o(t.base, 200), "github-workspace-meta"));
				let s = o(t.htmlUrl, 500);
				if (u(s)) {
					let e = a(n, "a", "Aç", "github-workspace-link");
					e.href = s, e.target = "_blank", e.rel = "noopener noreferrer", r.append(e);
				}
				i.append(r);
			}
			f.append(i), y(_.options[_.selectedIndex]?.textContent + " yüklendi."), w();
		}).catch((e) => {
			y(e instanceof Error ? e.message : "GitHub PR listesi okunamadı.");
		}).finally(() => {
			_.disabled = !1;
		});
	}), g.addEventListener("click", async () => {
		let t = f.textContent?.trim() || "";
		if (!t) return y("Kopyalanacak sonuç yok.");
		try {
			await e.navigator?.clipboard?.writeText?.(t), y("Görünen sonuç panoya kopyalandı.");
		} catch {
			y("Görünen sonuç panoya kopyalanamadı.");
		}
	});
	let E = () => w();
	return x.forEach((e) => e.addEventListener("click", E)), C(), Object.freeze({
		mounted: !0,
		destroy: () => {
			c.removeEventListener("change", T), c.removeEventListener("blur", T), m.remove();
		}
	});
}
e.HafizeGitHubWorkspaceActions = Object.freeze({ mount: d });
var f = () => {
	e.document && d(e.document);
};
e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", f, { once: !0 }) : f();
//#endregion

//# sourceMappingURL=github-workspace-actions.js.map