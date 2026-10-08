//#region public/github-workspace-write.ts
var e = globalThis, t = "githubWorkspaceCard", n = "github-workspace-write", r = 120, i = 200, a = 200, o = 400, s = 98304, c = 180, l = 240, u = 4e3, d = "hafize.github-workspace-write.v1", f = 12, p = 120, m = 240;
function h(e, t, n, r) {
	let i = e.createElement(t);
	return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
}
function g(e, t) {
	return typeof e == "string" ? e.trim().slice(0, t) : "";
}
function _(e) {
	return e && typeof e == "object" && !Array.isArray(e) ? e : {};
}
function v(e, t, n, r = "", i = "") {
	let a = e.createElement(t);
	return i && (a.className = i), (t === "input" || t === "textarea") && (a.value = r), a.setAttribute("aria-label", n), a;
}
function y(e) {
	return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/.*)?$/i.test(e);
}
function b() {
	try {
		let e = sessionStorage.getItem(d) || "[]", t = JSON.parse(e);
		return Array.isArray(t) ? t.flatMap((e) => {
			if (!e || typeof e != "object") return [];
			let t = e, n = t.action === "branch" || t.action === "file" || t.action === "pull" ? t.action : null, r = g(t.repository, p), i = g(t.target, m), a = g(t.at, 40), o = t.status === "ok" ? "ok" : null;
			if (!n || !r || !i || !a || !o) return [];
			let s = g(t.reference, 500);
			return [{
				action: n,
				repository: r,
				target: i,
				status: o,
				at: a,
				...s ? { reference: s } : {}
			}];
		}).slice(0, f) : [];
	} catch {
		return [];
	}
}
function x(e) {
	try {
		sessionStorage.setItem(d, JSON.stringify(e.slice(0, f)));
	} catch {}
}
function S(e) {
	return e === "branch" ? "Branch" : e === "file" ? "Commit" : "PR";
}
function C(e, t) {
	if (e === "branch") return g(t.branch, m) || "branch";
	if (e === "file") return g(t.path, m) || "dosya";
	let n = typeof t.number == "number" ? String(t.number) : "";
	return n ? "#" + n : g(t.title, m) || "PR";
}
function ee(e, t) {
	let n = g(t.repository, p), r = C(e, t);
	if (!n || !r) return;
	let i = g(e === "branch" ? t.htmlUrl : e === "file" ? t.commitUrl : t.htmlUrl, 500);
	x([{
		action: e,
		repository: n,
		target: r,
		status: "ok",
		at: (/* @__PURE__ */ new Date()).toISOString(),
		...i ? { reference: i } : {}
	}, ...b().filter((t) => t.action !== e || t.repository !== n || t.target !== r)]);
}
function w(e) {
	return JSON.stringify(e.map((e) => ({
		action: e.action,
		repository: e.repository,
		target: e.target,
		status: e.status,
		at: e.at,
		...e.reference ? { reference: e.reference } : {}
	})), null, 2);
}
async function T(t) {
	if (!t.length) return !1;
	try {
		return await e.navigator?.clipboard?.writeText?.(w(t)), !0;
	} catch {
		return !1;
	}
}
function E(e, t, n, r = "all") {
	t.replaceChildren();
	let i = h(e, "div", void 0, "github-write-history-head"), a = h(e, "strong", "Son başarılı işlemler");
	a.id = "githubWriteHistoryTitle", i.append(a, h(e, "span", "İçerik saklanmaz", "github-write-history-note"));
	let o = h(e, "select", void 0, "github-write-history-filter");
	o.setAttribute("aria-label", "Write geçmişi eylem filtresi");
	for (let [t, n] of [
		["all", "Tümü"],
		["branch", "Branch"],
		["file", "Commit"],
		["pull", "PR"]
	]) {
		let r = h(e, "option", n);
		r.value = t, o.append(r);
	}
	o.value = r, i.append(o);
	let s = b(), c = r === "all" ? s : s.filter((e) => e.action === r), l = h(e, "button", "Kopyala", "mini-btn");
	l.type = "button", l.disabled = !c.length, l.addEventListener("click", () => {
		T(c).then((e) => {
			D(t, e ? "Güvenli işlem geçmişi panoya kopyalandı." : "İşlem geçmişi panoya kopyalanamadı.");
		});
	});
	let u = h(e, "button", "Temizle", "mini-btn");
	u.type = "button", u.disabled = !s.length, u.addEventListener("click", n), i.append(l, u), t.append(i), o.addEventListener("change", () => {
		E(e, t, n, o.value);
	});
	let d = h(e, "div", void 0, "github-write-history-list");
	c.length ? (c.forEach((t) => {
		let n = h(e, "div", void 0, "github-write-history-row"), r = h(e, "div", void 0, "github-write-history-top");
		r.append(h(e, "strong", S(t.action) + " · " + t.target), h(e, "time", new Date(t.at).toLocaleString("tr-TR"), "github-write-history-time"));
		let i = h(e, "div", t.repository, "github-write-history-repo");
		if (n.append(r, i), t.reference && y(t.reference)) {
			let r = h(e, "a", "GitHub’da aç", "github-write-result-link");
			r.href = t.reference, r.target = "_blank", r.rel = "noopener noreferrer", n.append(r);
		}
		d.append(n);
	}), t.append(d)) : (d.append(h(e, "span", s.length ? "Bu filtrede başarılı işlem yok." : "Bu oturumda başarılı yazma işlemi yok.", "github-write-history-empty")), t.append(d));
}
function D(t, n) {
	let r = t.querySelector(".github-write-history-note");
	if (!r) return;
	let i = r.textContent || "İçerik saklanmaz";
	r.textContent = n, e.setTimeout?.(() => {
		r.isConnected && (r.textContent = i);
	}, 2600);
}
function O(e, t) {
	let n = e.querySelector("input[aria-label=\"GitHub repository\"]");
	n && !t.value && (t.value = g(n.value, r));
}
function k(e, t, n = !1) {
	let r = e.querySelector("input[aria-label=\"GitHub branch veya ref\"]");
	r && (!t.value || n) && (t.value = g(r.value, i));
}
async function A(e, t) {
	let n = await fetch(e, {
		method: "POST",
		credentials: "same-origin",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json"
		},
		cache: "no-store",
		body: JSON.stringify(t)
	}), r = {};
	try {
		r = await n.json();
	} catch {}
	let i = _(r);
	if (!n.ok) throw Error(g(i.error, 100) || "GITHUB_WRITE_FAILED");
	return i;
}
function j(e) {
	return {
		AUTH_REQUIRED: "GitHub yazma işlemi için uygulama oturumu gerekli.",
		CSRF_REQUIRED: "Güvenlik doğrulaması eksik; sayfayı yenileyip tekrar deneyin.",
		GITHUB_NOT_CONFIGURED: "Sunucuda GitHub bağlantısı yapılandırılmamış.",
		GITHUB_WRITE_NOT_CONFIGURED: "GitHub yazma allowlist’i yapılandırılmamış.",
		GITHUB_REPO_NOT_ALLOWED: "Bu repository yazma allowlist’inde değil.",
		INVALID_GITHUB_REPOSITORY: "Repository biçimi sahip/depo olmalı.",
		INVALID_GITHUB_REF: "Branch/ref değeri geçersiz.",
		INVALID_GITHUB_BRANCH: "Branch adı Git ref kurallarına uymuyor.",
		INVALID_GITHUB_PATH: "Dosya yolu geçersiz.",
		GITHUB_SENSITIVE_PATH_BLOCKED: "Credential/secret benzeri dosya yollarına yazılamaz.",
		GITHUB_WORKFLOW_PATH_BLOCKED: "GitHub Actions workflow dosyalarına bu araçla yazılamaz.",
		GITHUB_CONTENT_CREDENTIAL_BLOCKED: "İçerik credential/token benzeri veri içeriyor.",
		GITHUB_DEFAULT_BRANCH_BLOCKED: "Varsayılan branch’e doğrudan commit engellendi; branch + PR akışını kullanın.",
		GITHUB_WRITE_APPROVAL_REQUIRED: "Yazma işlemi için açık kullanıcı onayı gerekli.",
		GITHUB_WRITE_APPROVAL_EXPIRED: "Onay süresi doldu; işlemi yeniden onaylayın.",
		GITHUB_WRITE_APPROVAL_MISMATCH: "Onaylanan plan değişti; yeniden önizleyip onaylayın.",
		GITHUB_WRITE_APPROVAL_REPLAY: "Bu onay bileti daha önce kullanıldı.",
		GITHUB_ENDPOINT_FAILED: "GitHub isteği başarısız oldu.",
		GITHUB_WRITE_FAILED: "GitHub yazma işlemi başarısız oldu.",
		GITHUB_HEAD_MOVED: "Branch ucu değişmiş; güncel durumu yeniden okuyun.",
		INVALID_GITHUB_ARGUMENTS: "GitHub yazma parametrelerinden biri geçersiz.",
		INVALID_GITHUB_RESPONSE: "GitHub beklenmeyen bir yanıt verdi."
	}[e] || "GitHub yazma işlemi tamamlanamadı.";
}
function M(e, t, n, r) {
	let i = h(e, "label", void 0, "github-write-field");
	return i.append(h(e, "span", t, "github-write-label"), n), r && i.append(h(e, "small", r, "github-write-help")), i;
}
function N(e, t) {
	return g(t.repository?.value, r) ? e === "branch" ? !!(g(t.branch?.value, a) && g(t.fromRef?.value, i)) : e === "file" ? !!(g(t.branch?.value, a) && g(t.path?.value, o) && t.content?.value.length && g(t.message?.value, c)) : !!(g(t.head?.value, a) && g(t.base?.value, i) && g(t.title?.value, l)) : !1;
}
function P(e, t, n) {
	let s = h(e, "div", void 0, "github-write-plan"), u = h(e, "strong", "Yazma önizlemesi"), d = h(e, "div", void 0, "github-write-plan-rows"), f = t === "branch" ? [
		["Repository", g(n.repository, r)],
		["Yeni branch", g(n.branch, a)],
		["Kaynak ref", g(n.fromRef, i)]
	] : t === "file" ? [
		["Repository", g(n.repository, r)],
		["Branch", g(n.branch, a)],
		["Dosya", g(n.path, o)],
		["Commit", g(n.message, c)],
		["İçerik", String(n.content ?? "").length.toLocaleString("tr-TR") + " karakter"]
	] : [
		["Repository", g(n.repository, r)],
		["Head", g(n.head, a)],
		["Base", g(n.base, i)],
		["Başlık", g(n.title, l)],
		["Taslak", n.draft === !0 ? "Evet" : "Hayır"]
	];
	for (let [t, n] of f) {
		let r = h(e, "div", void 0, "github-write-plan-row");
		r.append(h(e, "span", t, "github-write-plan-label"), h(e, "strong", n)), d.append(r);
	}
	return s.append(u, d), s;
}
function F(d = e.document) {
	let f = d?.getElementById(t);
	if (!d || !f || f.querySelector("." + n)) return null;
	let p = h(d, "section", void 0, "utility-card " + n);
	p.setAttribute("aria-labelledby", "githubWriteTitle");
	let m = h(d, "div", void 0, "github-write-head"), b = h(d, "strong", "GitHub güvenli yazma");
	b.id = "githubWriteTitle";
	let S = h(d, "span", "kullanıcı onayı + PR odaklı", "github-write-badge"), C = h(d, "span", "yazma durumu kontrol ediliyor…", "github-write-readiness");
	m.append(b, S, C);
	let w = h(d, "p", "Branch oluştur, tek dosya commit et veya mevcut branch’lerden PR aç. Varsayılan branch’e doğrudan commit ve secret/workflow yolları engellenir.", "github-write-intro"), T = v(d, "select", "GitHub yazma eylemi");
	T.append(Object.entries({
		branch: "Branch oluştur",
		file: "Dosya commit et",
		pull: "Pull request aç"
	}).map(([e, t]) => {
		let n = h(d, "option", t);
		return n.value = e, n;
	}));
	let D = h(d, "div", void 0, "github-write-form"), F = h(d, "div", void 0, "github-write-plan-host"), I = d.createElement("input");
	I.type = "checkbox", I.setAttribute("aria-label", "GitHub yazma işlemini onaylıyorum");
	let L = h(d, "label", void 0, "github-write-approval"), R = h(d, "span", "Bu planın GitHub repository’sinde değişiklik yapacağını okudum ve açıkça onaylıyorum.");
	L.append(I, R);
	let z = h(d, "button", "Onayla ve yürüt", "soft-btn");
	z.type = "button", z.disabled = !0;
	let B = h(d, "button", "Temizle", "mini-btn");
	B.type = "button";
	let V = h(d, "div", "", "github-write-status");
	V.setAttribute("role", "status"), V.setAttribute("aria-live", "polite");
	let H = h(d, "div", "", "github-write-result");
	H.setAttribute("aria-live", "polite");
	let U = h(d, "div", void 0, "github-write-actions");
	U.append(z, B), p.append(m, w, T, D, F, L, U, V, H, J), f.append(p);
	let W = !1, G = !0, K = {}, q = () => {}, J = h(d, "section", void 0, "github-write-history");
	J.setAttribute("aria-labelledby", "githubWriteHistoryTitle");
	let Y = h(d, "strong", "Son başarılı işlemler");
	Y.id = "githubWriteHistoryTitle", J.append(Y);
	let X = (e) => {
		V.textContent = g(e, 260);
	};
	I.addEventListener("change", () => q());
	let Z = () => {
		D.replaceChildren(), F.replaceChildren(), z.disabled = !0, I.checked = !1, H.replaceChildren();
		let e = T.value, t = v(d, "input", "GitHub repository", "");
		t.type = "text", t.maxLength = r, t.placeholder = "sahip/depo", O(f, t);
		let n = { repository: t };
		if (e === "branch") {
			let e = v(d, "input", "Kaynak ref");
			e.type = "text", e.maxLength = i, e.placeholder = "main veya commit SHA", k(f, e, !0);
			let r = v(d, "input", "Yeni branch");
			r.type = "text", r.maxLength = a, r.placeholder = "hafize/feature-adi", n.fromRef = e, n.branch = r, D.append(M(d, "Repository", t), M(d, "Kaynak ref", e), M(d, "Yeni branch", r, "Branch oluşturulur; mevcut branch üzerine yazılmaz."));
		} else if (e === "file") {
			let e = v(d, "input", "Commit branch");
			e.type = "text", e.maxLength = a, e.placeholder = "feature/branch", k(f, e);
			let r = v(d, "input", "GitHub dosya yolu");
			r.type = "text", r.maxLength = o, r.placeholder = "src/example.ts";
			let i = v(d, "input", "Commit mesajı");
			i.type = "text", i.maxLength = c, i.placeholder = "feat: ...";
			let l = v(d, "input", "Mevcut dosya SHA");
			l.type = "text", l.maxLength = 80, l.placeholder = "Yalnız mevcut dosyayı güncellemek için";
			let u = v(d, "textarea", "Commit içeriği");
			u.maxLength = s, u.rows = 10, u.placeholder = "Dosya içeriği…", n.branch = e, n.path = r, n.message = i, n.existingSha = l, n.content = u, D.append(M(d, "Repository", t), M(d, "Branch", e), M(d, "Dosya yolu", r, "Secret, credential ve .github/workflows yolları engellenir."), M(d, "Commit mesajı", i), M(d, "Mevcut dosya SHA", l, "Yeni dosya için boş bırakılır."), M(d, "İçerik", u, "En fazla 96 KB; plaintext credential/token tespiti uygulanır."));
		} else {
			let e = v(d, "input", "PR head branch");
			e.type = "text", e.maxLength = a, e.placeholder = "feature/branch", k(f, e);
			let r = v(d, "input", "PR base ref");
			r.type = "text", r.maxLength = i, r.placeholder = "main";
			let o = v(d, "input", "PR başlığı");
			o.type = "text", o.maxLength = l, o.placeholder = "feat: ...";
			let s = v(d, "textarea", "PR açıklaması");
			s.maxLength = u, s.rows = 7, s.placeholder = "Ne değişti, neden, doğrulama ve geri alma bilgisi…";
			let c = v(d, "select", "PR taslak mı"), p = h(d, "option", "Taslak");
			p.value = "true";
			let m = h(d, "option", "Hazır");
			m.value = "false", c.append(p, m), n.head = e, n.base = r, n.title = o, n.body = s, n.draft = c, D.append(M(d, "Repository", t), M(d, "Head branch", e), M(d, "Base ref", r, "Head ve base aynı olamaz."), M(d, "PR başlığı", o), M(d, "PR açıklaması", s), M(d, "Durum", c));
		}
		K = n;
		let p = () => {
			let t = N(e, K);
			z.disabled = !t || !I.checked, F.replaceChildren();
			let n = Q(e, K);
			t ? F.append(P(d, e, n)) : F.append(h(d, "div", "Planı yürütmek için zorunlu alanları doldur.", "github-write-plan-empty"));
		};
		Object.values(K).forEach((e) => e.addEventListener("input", p)), Object.values(K).forEach((e) => e.addEventListener("change", p)), q = p, p(), t.focus();
	}, Q = (e, t) => {
		let n = g(t.repository?.value, r);
		return e === "branch" ? {
			repository: n,
			branch: g(t.branch?.value, a),
			fromRef: g(t.fromRef?.value, i)
		} : e === "file" ? {
			repository: n,
			branch: g(t.branch?.value, a),
			path: g(t.path?.value, o),
			message: g(t.message?.value, c),
			existingSha: g(t.existingSha?.value, 80),
			content: String(t.content?.value || "").slice(0, s)
		} : {
			repository: n,
			head: g(t.head?.value, a),
			base: g(t.base?.value, i),
			title: g(t.title?.value, l),
			body: String(t.body?.value || "").slice(0, u),
			draft: t.draft?.value === "true"
		};
	}, te = async () => {
		let e = T.value;
		if (!G) {
			X("Sunucuda GitHub yazma yetkisi etkin değil.");
			return;
		}
		let t = Q(e, K);
		if (!N(e, K)) X("Zorunlu alanları doldurun.");
		else if (!I.checked) X("Önce açık kullanıcı onayı vermelisiniz.");
		else {
			z.disabled = !0, B.disabled = !0, T.disabled = !0, X("Onay bileti hazırlanıyor…"), H.replaceChildren();
			try {
				let n = g((await A("/api/github/workspace/write/approval", {
					action: e,
					approved: !0,
					payload: t
				})).ticket, 128);
				if (!n) throw Error("GITHUB_WRITE_APPROVAL_REQUIRED");
				X("Onay bileti tek kullanımlık ve kısa ömürlü. GitHub yazılıyor…");
				let r = await A("/api/github/workspace/write", {
					action: e,
					ticket: n,
					payload: t
				});
				if (W) return;
				ne(e, r), ee(e, r), E(d, J, () => {
					x([]), E(d, J, () => {});
				}), X("GitHub yazma işlemi tamamlandı."), I.checked = !1;
			} catch (e) {
				X(e instanceof Error ? j(e.message) : "GitHub yazma işlemi tamamlanamadı.");
			} finally {
				W || (z.disabled = !1, B.disabled = !1, T.disabled = !1, $());
			}
		}
	}, $ = () => {
		z.disabled = !N(T.value, K) || !I.checked;
	}, ne = (e, t) => {
		H.replaceChildren();
		let n = h(d, "div", void 0, "github-write-result-box"), s = e === "branch" ? "Branch oluşturuldu" : e === "file" ? "Commit oluşturuldu" : "Pull request oluşturuldu";
		if (n.append(h(d, "strong", s)), e === "branch") {
			n.append(h(d, "div", g(t.repository, r) + " · " + g(t.branch, a), "github-write-result-meta"), h(d, "div", "Kaynak SHA: " + g(t.fromSha, 80), "github-write-result-meta"));
			let e = g(t.htmlUrl, 500);
			if (y(e)) {
				let t = h(d, "a", "GitHub’da aç", "github-write-result-link");
				t.href = e, t.target = "_blank", t.rel = "noopener noreferrer", n.append(t);
			}
			let o = f.querySelector("input[aria-label=\"GitHub branch veya ref\"]");
			o && (o.value = g(t.branch, i));
		} else if (e === "file") {
			n.append(h(d, "div", g(t.repository, r) + " · " + g(t.path, o), "github-write-result-meta"), h(d, "div", "Commit SHA: " + g(t.commitSha, 80), "github-write-result-meta"));
			let e = g(t.commitUrl, 500);
			if (y(e)) {
				let t = h(d, "a", "Commit’i GitHub’da aç", "github-write-result-link");
				t.href = e, t.target = "_blank", t.rel = "noopener noreferrer", n.append(t);
			}
		} else {
			n.append(h(d, "div", "#" + String(t.number ?? "") + " · " + g(t.title, l), "github-write-result-meta"), h(d, "div", g(t.head, a) + " → " + g(t.base, i), "github-write-result-meta"));
			let e = g(t.htmlUrl, 500);
			if (y(e)) {
				let t = h(d, "a", "PR’ı GitHub’da aç", "github-write-result-link");
				t.href = e, t.target = "_blank", t.rel = "noopener noreferrer", n.append(t);
			}
		}
		H.append(n);
	};
	return T.addEventListener("change", Z), z.addEventListener("click", () => void te()), B.addEventListener("click", () => {
		Z(), X("Yazma planı temizlendi.");
	}), Z(), (async () => {
		try {
			let e = await fetch("/api/health", {
				method: "GET",
				credentials: "same-origin",
				headers: { Accept: "application/json" },
				cache: "no-store"
			}), t = _(await e.json().catch(() => ({})));
			if (W) return;
			G = e.ok && t.githubWriteConfigured === !0, C.textContent = G ? "yazma hazır" : "yazma kapalı", C.setAttribute("aria-label", G ? "GitHub yazma bağlantısı hazır" : "GitHub yazma bağlantısı yapılandırılmamış"), G ? $() : (z.disabled = !0, X("GitHub yazma allowlist’i etkin değil. Read-only çalışma alanı kullanılabilir."));
		} catch {
			if (W) return;
			C.textContent = "durum alınamadı", C.setAttribute("aria-label", "GitHub yazma durumu alınamadı"), G = !0, X("Yazma durumu doğrulanamadı; server isteği ayrıca doğrulayacaktır.");
		}
	})(), E(d, J, () => {
		x([]), E(d, J, () => {});
	}), Object.freeze({
		mounted: !0,
		destroy: () => {
			W = !0, p.remove();
		}
	});
}
var I = 0, L = () => {
	e.document?.getElementById(t) ? F(e.document) : I >= 20 || (I += 1, e.setTimeout(L, 50));
};
e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", L, { once: !0 }) : L();
var R = Object.freeze({ mount: F });
e.HafizeGitHubWorkspaceWrite = R;
//#endregion
export { R as HafizeGitHubWorkspaceWrite };

//# sourceMappingURL=github-workspace-write.js.map