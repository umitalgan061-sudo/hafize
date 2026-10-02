//#region public/github-workspace-extra.ts
var e = globalThis, t = "githubWorkspaceCard", n = 400, r = 120;
function i(e, t, n, r) {
	let i = e.createElement(t);
	return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
}
function a(e, t) {
	return typeof e == "string" ? e.trim().slice(0, t) : "";
}
function o(e) {
	return e && typeof e == "object" && !Array.isArray(e) ? e : {};
}
async function s(e, t, n, r, i) {
	let s = e === "directory" ? "/api/github/workspace/directory" : "/api/github/workspace/compare", c = new URLSearchParams({ repository: t });
	e === "directory" ? (n && c.set("ref", n), r && c.set("path", r)) : (c.set("base", i), c.set("head", n));
	let l = await fetch(s + "?" + c.toString(), {
		method: "GET",
		headers: { Accept: "application/json" },
		credentials: "same-origin",
		cache: "no-store"
	}), u = {};
	try {
		u = await l.json();
	} catch {}
	if (!l.ok) throw Error(a(o(u).error, 100) || "GITHUB_WORKSPACE_FAILED");
	return o(u);
}
function c(e, t) {
	let n = a(t, 500);
	if (!/^https:\/\/github\.com\//i.test(n)) return null;
	let r = i(e, "a", "Aç", "github-workspace-extra-link");
	return r.href = n, r.target = "_blank", r.rel = "noopener noreferrer", r;
}
function l(l = e.document) {
	let u = l?.getElementById(t);
	if (!l || !u || u.querySelector(".github-workspace-extra")) return null;
	let d = i(l, "div", void 0, "github-workspace-extra"), f = i(l, "div", void 0, "github-workspace-extra-head");
	f.append(i(l, "strong", "Ek okuma araçları"), i(l, "span", "salt okunur"));
	let p = i(l, "div", void 0, "github-workspace-extra-controls"), m = u.querySelector("input[aria-label=\"GitHub dosya yolu\"]"), h = [...u.querySelectorAll("input")], g = h.find((e) => e.getAttribute("aria-label") === "GitHub repository"), _ = h.find((e) => e.getAttribute("aria-label") === "GitHub branch veya ref");
	if (!g || !_ || !m) return null;
	let v = i(l, "input");
	v.type = "text", v.maxLength = n, v.placeholder = "Karşılaştırma base ref", v.autocomplete = "off", v.spellcheck = !1, v.setAttribute("aria-label", "GitHub karşılaştırma base ref");
	let y = i(l, "input");
	y.type = "text", y.maxLength = n, y.placeholder = "Dizin yolu (opsiyonel)", y.autocomplete = "off", y.spellcheck = !1, y.setAttribute("aria-label", "GitHub dizin yolu");
	let b = i(l, "Dizin listele", "mini-btn"), x = i(l, "Ref karşılaştır", "mini-btn"), S = i(l, "Dizin veya iki ref ile karşılaştırma seç.", "github-workspace-extra-status");
	S.setAttribute("role", "status"), S.setAttribute("aria-live", "polite");
	let C = i(l, "div", void 0, "github-workspace-extra-result");
	C.setAttribute("aria-live", "polite"), p.append(b, x), d.append(f, p, y, v, S, C), u.append(d);
	let w = !1, T = (e) => {
		S.textContent = a(e, 220);
	}, E = (e) => {
		C.replaceChildren();
		let t = i(l, "div", void 0, "github-workspace-extra-list"), r = Array.isArray(e.entries) ? e.entries : [];
		r.length || t.append(i(l, "span", "Dizin boş veya erişilebilir kayıt yok.", "github-workspace-extra-empty")), r.forEach((e) => {
			let r = o(e), s = i(l, "div", void 0, "github-workspace-extra-row"), u = a(r.name, n), d = a(r.type, 20);
			s.append(i(l, "strong", (d === "dir" ? "▸ " : "· ") + u), i(l, "code", a(r.sha, 10)));
			let f = c(l, r.htmlUrl);
			if (f && s.append(f), d === "dir") {
				s.tabIndex = 0, s.setAttribute("role", "button");
				let e = () => {
					y.value = a(r.path, n), T(y.value + " seçildi.");
				};
				s.addEventListener("click", e), s.addEventListener("keydown", (t) => {
					(t.key === "Enter" || t.key === " ") && (t.preventDefault(), e());
				});
			}
			t.append(s);
		}), C.append(t);
	}, D = (e) => {
		C.replaceChildren();
		let t = i(l, "div", void 0, "github-workspace-extra-summary");
		t.append(i(l, "strong", a(e.status, 40) || "değişiklik durumu"), i(l, "span", "base: " + a(e.base, r) + " · head: " + a(e.head, r)), i(l, "span", "commit: " + String(e.totalCommits ?? 0) + " · ahead: " + String(e.aheadBy ?? 0) + " · behind: " + String(e.behindBy ?? 0)));
		let s = i(l, "div", void 0, "github-workspace-extra-list"), c = Array.isArray(e.files) ? e.files : [];
		c.length || s.append(i(l, "span", "Ref’ler arasında dosya farkı bulunamadı.", "github-workspace-extra-empty")), c.forEach((e) => {
			let t = o(e), r = i(l, "div", void 0, "github-workspace-extra-row");
			r.append(i(l, "strong", a(t.filename, n))), r.append(i(l, "span", a(t.status, 30) + " · +" + String(t.additions ?? 0) + " / -" + String(t.deletions ?? 0))), s.append(r);
		}), C.append(t, s);
	}, O = async (e) => {
		let t = a(g.value, 120), r = a(_.value, 200), i = a(y.value, n), o = a(v.value, n);
		if (!t) return T("Repository gerekli.");
		if (e === "compare" && (!o || !r || o === r)) return T("Base ve head ref farklı olmalı.");
		S.textContent = "GitHub okunuyor…", b.disabled = !0, x.disabled = !0;
		try {
			let n = await s(e, t, r, i, o);
			w || (e === "directory" ? E(n) : D(n), T(e === "directory" ? "Dizin okundu." : "Ref karşılaştırması okundu."));
		} catch (e) {
			let t = e instanceof Error ? e.message : "GITHUB_WORKSPACE_FAILED";
			T({
				GITHUB_REPO_NOT_ALLOWED: "Repository sunucu allowlist’inde değil.",
				INVALID_GITHUB_REPOSITORY: "Repository biçimi sahip/depo olmalı.",
				INVALID_GITHUB_REF: "Ref geçersiz.",
				INVALID_GITHUB_PATH: "Dizin yolu geçersiz.",
				GITHUB_ENDPOINT_FAILED: "GitHub isteği başarısız oldu.",
				GITHUB_NOT_CONFIGURED: "Sunucuda GitHub okuma bağlantısı yok."
			}[t] || "GitHub verisi okunamadı.");
		} finally {
			b.disabled = !1, x.disabled = !1;
		}
	};
	return b.addEventListener("click", () => void O("directory")), x.addEventListener("click", () => void O("compare")), Object.freeze({
		mounted: !0,
		destroy: () => {
			w = !0, d.remove();
		}
	});
}
e.HafizeGitHubWorkspaceExtra = Object.freeze({ mount: l });
var u = () => {
	e.document && l(e.document);
};
e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", u, { once: !0 }) : u();
//#endregion

//# sourceMappingURL=github-workspace-extra.js.map