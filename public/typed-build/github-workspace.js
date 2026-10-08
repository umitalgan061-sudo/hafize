//#region public/github-workspace.ts
var e = globalThis, t = "githubWorkspaceCard", n = "hafize.github-workspace.v1", r = 120, i = 200, a = 400;
function o(e, t, n, r) {
	let i = e.createElement(t);
	return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
}
function s(e, t) {
	return typeof e == "string" ? e.trim().slice(0, t) : "";
}
function c() {
	try {
		let e = JSON.parse(sessionStorage.getItem(n) || "{}");
		return {
			repository: s(e?.repository, r),
			ref: s(e?.ref, i),
			path: s(e?.path, a)
		};
	} catch {
		return {
			repository: "",
			ref: "",
			path: ""
		};
	}
}
function l(e) {
	try {
		sessionStorage.setItem(n, JSON.stringify(e));
	} catch {}
}
function u(e) {
	return e && typeof e == "object" && !Array.isArray(e) ? e : {};
}
async function d(e, t, n, r) {
	let i = new URLSearchParams({
		action: e,
		repository: t,
		limit: "30"
	});
	n && i.set("ref", n), r && i.set("path", r);
	let a = await fetch("/api/github/workspace?" + i.toString(), {
		method: "GET",
		headers: { Accept: "application/json" },
		credentials: "same-origin",
		cache: "no-store"
	}), o = {};
	try {
		o = await a.json();
	} catch {}
	if (!a.ok) throw Error(s(u(o).error, 80) || "GITHUB_WORKSPACE_FAILED");
	return u(o);
}
function f(e, t, n) {
	if (!/^https:\/\/github\.com\//i.test(t)) return null;
	let r = o(e, "a", n, "github-workspace-link");
	return r.href = t, r.target = "_blank", r.rel = "noopener noreferrer", r;
}
function p(n = e.document, u = e) {
	if (!n) return null;
	let p = n.querySelector(".utility-rail");
	if (!p || n.getElementById(t)) return null;
	let m = o(n, "section", void 0, "utility-card github-workspace-card");
	m.id = t, m.setAttribute("aria-labelledby", "githubWorkspaceTitle");
	let h = o(n, "div", void 0, "utility-head github-workspace-head"), g = o(n, "span", "GitHub çalışma alanı");
	g.id = "githubWorkspaceTitle";
	let _ = o(n, "span", "salt okunur · Ctrl/⌘+Shift+G", "github-workspace-badge");
	h.append(g, _);
	let v = o(n, "input");
	v.type = "text", v.maxLength = r, v.placeholder = "sahip/depo", v.autocomplete = "off", v.spellcheck = !1, v.setAttribute("aria-label", "GitHub repository");
	let y = o(n, "input");
	y.type = "text", y.maxLength = i, y.placeholder = "branch veya ref (opsiyonel)", y.autocomplete = "off", y.setAttribute("aria-label", "GitHub branch veya ref");
	let b = o(n, "div", void 0, "github-workspace-controls"), x = [
		["repo", "Repo"],
		["branches", "Branch"],
		["commits", "Commit"],
		["pulls", "PR"],
		["file", "Dosya"]
	], S = /* @__PURE__ */ new Map();
	x.forEach(([e, t]) => {
		let r = o(n, "button", t, "mini-btn github-workspace-tab");
		r.type = "button", r.setAttribute("aria-pressed", String(e === "repo")), r.dataset.githubWorkspaceAction = e, b.append(r), S.set(e, r);
	});
	let C = o(n, "input");
	C.type = "text", C.maxLength = a, C.placeholder = "Dosya yolu: src/example.ts", C.autocomplete = "off", C.spellcheck = !1, C.hidden = !0, C.setAttribute("aria-label", "GitHub dosya yolu");
	let w = o(n, "Yükle", "soft-btn");
	w.type = "button";
	let T = o(n, "Repository ve eylemi seçip Yükle’ye bas.", "github-workspace-status");
	T.setAttribute("role", "status"), T.setAttribute("aria-live", "polite");
	let E = o(n, "div", void 0, "github-workspace-result");
	E.setAttribute("aria-live", "polite");
	let D = o(n, "div", void 0, "github-workspace-form");
	D.append(v, y, b, C, w), m.append(h, D, T, E), p.append(m);
	let O = c();
	v.value = O.repository, y.value = O.ref, C.value = O.path;
	let k = "repo", A = !1, j = (e) => {
		T.textContent = s(e, 220);
	}, M = (e) => {
		k = e, S.forEach((t, n) => t.setAttribute("aria-pressed", String(n === e))), C.hidden = e !== "file";
	}, N = (e) => {
		E.replaceChildren();
		let t = o(n, "div", void 0, "github-workspace-summary");
		[
			["Depo", s(e.fullName || e.repository, 160)],
			["Varsayılan branch", s(e.defaultBranch, i) || "main"],
			["Görünürlük", s(e.visibility, 40) || "belirtilmemiş"],
			["Arşiv", e.archived === !0 ? "Evet" : "Hayır"]
		].forEach(([e, r]) => {
			let i = o(n, "div", void 0, "github-workspace-summary-row");
			i.append(o(n, "span", e, "github-workspace-label"), o(n, "strong", r)), t.append(i);
		});
		let r = f(n, s(e.htmlUrl, 500), "GitHub’da aç");
		r && t.append(r), E.append(t);
	}, P = (e) => {
		E.replaceChildren();
		let t = o(n, "div", void 0, "github-workspace-list"), r = Array.isArray(e.branches) ? e.branches : [];
		r.length || t.append(o(n, "span", "Branch bulunamadı.", "github-workspace-empty")), r.forEach((e) => {
			let r = o(n, "div", void 0, "github-workspace-row");
			r.append(o(n, "strong", e.name), o(n, "code", e.sha.slice(0, 10))), e.protected && r.append(o(n, "span", "korumalı", "github-workspace-chip")), r.tabIndex = 0, r.setAttribute("role", "button"), r.setAttribute("aria-label", e.name + " branch’ini ref olarak seç");
			let i = () => {
				y.value = e.name, l({
					repository: v.value,
					ref: y.value,
					path: C.value
				}), j(e.name + " ref olarak seçildi.");
			};
			r.addEventListener("click", i), r.addEventListener("keydown", (e) => {
				(e.key === "Enter" || e.key === " ") && (e.preventDefault(), i());
			}), t.append(r);
		}), E.append(t);
	}, F = (e) => {
		E.replaceChildren();
		let t = o(n, "div", void 0, "github-workspace-list"), r = Array.isArray(e.commits) ? e.commits : [];
		r.length || t.append(o(n, "span", "Commit bulunamadı.", "github-workspace-empty")), r.forEach((e) => {
			let r = o(n, "article", void 0, "github-workspace-row"), i = o(n, "div");
			i.append(o(n, "strong", e.message), o(n, "code", e.shortSha));
			let a = o(n, "div", (e.author || "GitHub") + " · " + (e.date ? new Date(e.date).toLocaleString("tr-TR") : "tarih yok"), "github-workspace-meta");
			i.append(a);
			let s = f(n, e.htmlUrl, "Aç");
			s && i.append(s), r.append(i), t.append(r);
		}), E.append(t);
	}, I = (e) => {
		E.replaceChildren();
		let t = o(n, "div", void 0, "github-workspace-list"), r = Array.isArray(e.pullRequests) ? e.pullRequests : [];
		r.length || t.append(o(n, "span", "PR bulunamadı.", "github-workspace-empty")), r.forEach((e) => {
			let r = o(n, "article", void 0, "github-workspace-row"), i = o(n, "div");
			i.append(o(n, "strong", "#" + e.number + " · " + e.title)), i.append(o(n, "div", (e.author || "GitHub") + " · " + (e.head || "?") + " → " + (e.base || "?"), "github-workspace-meta")), e.draft && i.append(o(n, "span", "Taslak", "github-workspace-chip"));
			let a = f(n, e.htmlUrl, "Aç");
			a && i.append(a), r.append(i), t.append(r);
		}), E.append(t);
	}, L = (e) => {
		E.replaceChildren();
		let t = o(n, "div", s(e.path, a) + " · " + Number(e.size || 0).toLocaleString("tr-TR") + " byte", "github-workspace-meta");
		e.truncated === !0 && (t.textContent += " · gösterim kısaltıldı");
		let r = o(n, "pre", s(e.content, 65536), "github-workspace-code");
		E.append(t, r);
	}, R = (e) => {
		k === "repo" ? N(e) : k === "branches" ? P(e) : k === "commits" ? F(e) : k === "pulls" ? I(e) : L(e);
	}, z = async (e) => {
		let t = s(v.value, r), n = s(y.value, i), o = s(C.value, a);
		if (!t) return j("Repository gerekli. Örnek: sahip/depo");
		if (e === "file" && !o) return j("Dosya görünümü için yol gerekli.");
		l({
			repository: t,
			ref: n,
			path: o
		}), w.disabled = !0, j("GitHub okunuyor…");
		try {
			let r = await d(e, t, n, o);
			A || (R(r), j(e + " okundu."));
		} catch (e) {
			let t = e instanceof Error ? e.message : "GITHUB_WORKSPACE_FAILED";
			j({
				AUTH_REQUIRED: "GitHub workspace için oturum gerekli.",
				GITHUB_NOT_CONFIGURED: "Sunucuda GitHub okuma bağlantısı yapılandırılmamış.",
				GITHUB_REPO_NOT_ALLOWED: "Repository sunucu allowlist’inde değil.",
				INVALID_GITHUB_REPOSITORY: "Repository biçimi sahip/depo olmalı.",
				INVALID_GITHUB_PATH: "Dosya yolu geçersiz.",
				SENSITIVE_GITHUB_PATH_BLOCKED: "Güvenlik nedeniyle bu dosya yolu okunamaz.",
				GITHUB_CONTENT_CREDENTIAL_BLOCKED: "Dosya içeriği credential politikası nedeniyle gösterilemez.",
				GITHUB_PATH_NOT_FILE: "Seçilen yol bir dosya değil.",
				GITHUB_READ_FAILED: "GitHub dosyası okunamadı.",
				GITHUB_ENDPOINT_FAILED: "GitHub isteği başarısız oldu."
			}[t] || "GitHub çalışma alanı okunamadı.");
		} finally {
			w.disabled = !1;
		}
	};
	return S.forEach((e, t) => e.addEventListener("click", () => M(t))), w.addEventListener("click", () => void z(k)), [
		v,
		y,
		C
	].forEach((e) => e.addEventListener("keydown", (e) => {
		e.key === "Enter" && (e.preventDefault(), z(k));
	})), u.addEventListener("keydown", (e) => {
		(e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "g" && (e.preventDefault(), v.focus(), v.select());
	}), M("repo"), Object.freeze({
		mounted: !0,
		load: z,
		destroy: () => {
			A = !0, m.remove();
		}
	});
}
e.HafizeGitHubWorkspace = Object.freeze({ mount: p });
var m = () => {
	e.document && p(e.document, e);
};
e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", m, { once: !0 }) : m();
//#endregion

//# sourceMappingURL=github-workspace.js.map