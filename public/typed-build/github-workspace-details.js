//#region public/github-workspace-details.ts
var e = globalThis, t = "githubWorkspaceCard";
function n(e, t, n, r) {
	let i = e.createElement(t);
	return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
}
function r(e, t) {
	return typeof e == "string" ? e.trim().slice(0, t) : "";
}
function i(e) {
	return e && typeof e == "object" && !Array.isArray(e) ? e : {};
}
async function a(e, t) {
	let n = await fetch(e + "?" + t.toString(), {
		method: "GET",
		headers: { Accept: "application/json" },
		credentials: "same-origin",
		cache: "no-store"
	}), a = {};
	try {
		a = await n.json();
	} catch {}
	if (!n.ok) throw Error(r(i(a).error, 100) || "GITHUB_WORKSPACE_FAILED");
	return i(a);
}
function o(o = e.document) {
	let s = o?.getElementById(t);
	if (!o || !s || s.querySelector(".github-workspace-details")) return null;
	let c = n(o, "section", void 0, "github-workspace-details");
	c.setAttribute("aria-labelledby", "githubWorkspaceDetailsTitle");
	let l = n(o, "strong", "Commit / PR ayrıntıları");
	l.id = "githubWorkspaceDetailsTitle";
	let u = n(o, "input");
	u.type = "text", u.maxLength = 120, u.placeholder = "Commit SHA", u.setAttribute("aria-label", "GitHub commit SHA");
	let d = n(o, "button", "Commit ayrıntısı", "mini-btn");
	d.type = "button";
	let f = n(o, "input");
	f.type = "number", f.min = "1", f.max = "1000000000", f.placeholder = "PR numarası", f.setAttribute("aria-label", "GitHub PR numarası");
	let p = n(o, "button", "PR ayrıntısı", "mini-btn");
	p.type = "button";
	let m = n(o, "Detay okumaya hazır.", "github-workspace-details-status");
	m.setAttribute("role", "status"), m.setAttribute("aria-live", "polite");
	let h = n(o, "div", void 0, "github-workspace-details-result");
	h.setAttribute("aria-live", "polite");
	let g = n(o, "div", void 0, "github-workspace-details-row");
	g.append(u, d);
	let _ = n(o, "div", void 0, "github-workspace-details-row");
	_.append(f, p), c.append(l, g, _, m, h), s.append(c);
	let v = [...s.querySelectorAll("input")].find((e) => e.getAttribute("aria-label") === "GitHub repository"), y = (e) => {
		m.textContent = r(e, 220);
	}, b = (e) => {
		h.replaceChildren();
		let t = n(o, "div", void 0, "github-workspace-details-summary");
		t.append(n(o, "strong", r(e.message, 240))), t.append(n(o, "span", r(e.author, 160) + " · +" + String(e.additions ?? 0) + " / -" + String(e.deletions ?? 0))), (Array.isArray(e.files) ? e.files : []).forEach((e) => {
			let t = i(e), a = n(o, "div", void 0, "github-workspace-details-file");
			a.append(n(o, "span", r(t.filename, 400)), n(o, "span", r(t.status, 30))), a.append(n(o, "small", "+" + String(t.additions ?? 0) + " / -" + String(t.deletions ?? 0))), h.append(a);
		});
		let a = r(e.htmlUrl, 500);
		if (/^https:\/\/github\.com\//i.test(a)) {
			let e = n(o, "a", "GitHub’da aç");
			e.href = a, e.target = "_blank", e.rel = "noopener noreferrer", h.append(e);
		}
		h.prepend(t);
	}, x = (e) => {
		h.replaceChildren();
		let t = n(o, "div", void 0, "github-workspace-details-summary");
		t.append(n(o, "strong", "#" + String(e.number ?? "") + " · " + r(e.title, 240))), t.append(n(o, "span", r(e.author, 120) + " · " + r(e.head, 200) + " → " + r(e.base, 200))), t.append(n(o, "span", r(e.state, 20) + (e.draft === !0 ? " · taslak" : ""))), r(e.body, 2400) && t.append(n(o, "p", r(e.body, 2400)));
		let i = r(e.htmlUrl, 500);
		if (/^https:\/\/github\.com\//i.test(i)) {
			let e = n(o, "a", "GitHub’da aç");
			e.href = i, e.target = "_blank", e.rel = "noopener noreferrer", t.append(e);
		}
		h.append(t);
	}, S = async (e) => {
		let t = r(v?.value, 120);
		if (!t) return y("Önce repository girin.");
		let n = new URLSearchParams({ repository: t }), i = "";
		if (e === "commit") {
			let e = r(u.value, 120);
			if (!e) return y("Commit SHA gerekli.");
			n.set("sha", e), i = "/api/github/workspace/commit";
		} else {
			let e = r(f.value, 20);
			if (!e) return y("PR numarası gerekli.");
			n.set("number", e), i = "/api/github/workspace/pull";
		}
		d.disabled = !0, p.disabled = !0, y("GitHub ayrıntısı okunuyor…");
		try {
			let t = await a(i, n);
			e === "commit" ? b(t) : x(t), y("Ayrıntı okundu.");
		} catch (e) {
			let t = {
				AUTH_REQUIRED: "GitHub çalışma alanı için oturum gerekli.",
				GITHUB_REPO_NOT_ALLOWED: "Repository sunucu allowlist’inde değil.",
				GITHUB_ENDPOINT_FAILED: "GitHub isteği başarısız oldu.",
				INVALID_GITHUB_REF: "Commit SHA geçersiz.",
				INVALID_GITHUB_ARGUMENTS: "PR numarası geçersiz."
			}, n = e instanceof Error ? e.message : "";
			y(t[n] || "GitHub ayrıntısı okunamadı.");
		} finally {
			d.disabled = !1, p.disabled = !1;
		}
	};
	return d.addEventListener("click", () => void S("commit")), p.addEventListener("click", () => void S("pull")), Object.freeze({
		mounted: !0,
		destroy: () => c.remove()
	});
}
e.HafizeGitHubWorkspaceDetails = Object.freeze({ mount: o });
var s = () => {
	e.document && o(e.document);
};
e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", s, { once: !0 }) : s();
//#endregion

//# sourceMappingURL=github-workspace-details.js.map