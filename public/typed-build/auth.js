//#region public/typed/auth.ts
var e = globalThis.fetch.bind(globalThis), t = {
	required: !1,
	authenticated: !1,
	csrf: "",
	loading: null,
	modal: null
}, n = /* @__PURE__ */ new Set([
	"/api/auth/session",
	"/api/auth/login",
	"/api/auth/logout"
]);
function r(e) {
	try {
		let t = new URL(typeof e == "string" ? e : e instanceof URL ? e.toString() : e.url, location.href);
		return t.origin === location.origin && t.pathname.startsWith("/api/");
	} catch {
		return !1;
	}
}
function i(e) {
	try {
		let t = new URL(typeof e == "string" ? e : e instanceof URL ? e.toString() : e.url, location.href);
		return n.has(t.pathname);
	} catch {
		return !1;
	}
}
function a() {
	if (t.modal) return t.modal;
	let n = document.createElement("style");
	n.textContent = ".hafize-auth-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(16,20,25,.46);backdrop-filter:blur(10px)}.hafize-auth-card{width:min(420px,100%);box-sizing:border-box;border:1px solid rgba(120,125,130,.24);border-radius:24px;padding:26px;background:var(--panel,#fff);box-shadow:0 24px 80px rgba(0,0,0,.22)}.hafize-auth-card h2{margin:0 0 8px}.hafize-auth-card p{margin:0 0 18px;opacity:.72;line-height:1.5}.hafize-auth-card label{display:block;font-size:13px;font-weight:700;margin-bottom:8px}.hafize-auth-card input{width:100%;box-sizing:border-box;border:1px solid rgba(120,125,130,.35);border-radius:14px;padding:12px 14px;background:transparent;color:inherit}.hafize-auth-card button{width:100%;margin-top:14px;border:0;border-radius:14px;padding:12px;font-weight:700;cursor:pointer}.hafize-auth-error{min-height:20px;margin-top:10px;font-size:13px;color:#a52323}", document.head.append(n);
	let r = document.createElement("div");
	r.className = "hafize-auth-backdrop";
	let i = document.createElement("form");
	i.className = "hafize-auth-card", i.setAttribute("aria-label", "Hafize giriş"), i.autocomplete = "off";
	let a = document.createElement("h2");
	a.textContent = "Hafize'ye giriş";
	let o = document.createElement("p");
	o.textContent = "Bu Hafize sunucusu korunuyor. Erişim anahtarın kalıcı olarak tarayıcıya kaydedilmez.";
	let s = document.createElement("label");
	s.htmlFor = "hafizeAuthToken", s.textContent = "Erişim anahtarı";
	let c = document.createElement("input");
	c.id = "hafizeAuthToken", c.type = "password", c.minLength = 32, c.autocomplete = "current-password", c.required = !0;
	let l = document.createElement("div");
	l.className = "hafize-auth-error", l.setAttribute("role", "alert");
	let u = document.createElement("button");
	u.type = "submit", u.textContent = "Giriş yap", i.append(a, o, s, c, l, u), r.append(i), document.body.append(r);
	let d = {
		backdrop: r,
		form: i,
		input: c,
		error: l
	};
	return t.modal = d, i.addEventListener("submit", async (n) => {
		n.preventDefault(), l.textContent = "", i.setAttribute("aria-busy", "true");
		try {
			let n = await e("/api/auth/login", {
				method: "POST",
				credentials: "same-origin",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json"
				},
				body: JSON.stringify({ token: c.value })
			}), i = await n.json().catch(() => ({}));
			if (!n.ok || i.authenticated !== !0) throw Error(typeof i.error == "string" ? i.error : "AUTH_REQUIRED");
			t.authenticated = !0, t.csrf = typeof i.csrf == "string" ? i.csrf : "", c.value = "", r.remove(), t.modal = null;
		} catch (e) {
			l.textContent = e instanceof Error && e.message === "AUTH_REQUIRED" ? "Erişim anahtarı geçersiz." : "Giriş yapılamadı. Sunucu bağlantısını kontrol et.";
		} finally {
			i.removeAttribute("aria-busy"), t.modal && c.focus();
		}
	}), d;
}
var o = () => {
	let e = a();
	document.body.contains(e.backdrop) || document.body.append(e.backdrop), e.input.focus();
};
async function s() {
	if (t.loading) return t.loading;
	t.loading = (async () => {
		let n = await e("/api/auth/session", {
			credentials: "same-origin",
			headers: { Accept: "application/json" },
			cache: "no-store"
		});
		if (!n.ok) throw Error("AUTH_SESSION_FAILED");
		let r = await n.json();
		return t.required = !!r?.required, t.authenticated = !!r?.authenticated, t.csrf = typeof r?.csrf == "string" ? r.csrf : "", t;
	})();
	try {
		return await t.loading;
	} finally {
		t.loading = null;
	}
}
async function c() {
	if (await s(), t.required && !t.authenticated) for (o(); !t.authenticated;) await new Promise((e) => globalThis.setTimeout(e, 200)), await s();
}
async function l(n, a = {}) {
	if (!r(n) || i(n)) return e(n, a);
	await c();
	let o = {
		...a,
		credentials: "same-origin"
	}, s = String(a.method || (n instanceof Request ? n.method : "GET")).toUpperCase();
	if (!["GET", "HEAD"].includes(s)) {
		let e = new Headers(o.headers || {});
		t.csrf && e.set("X-Hafize-CSRF", t.csrf), o.headers = e;
	}
	let l = await e(n, o);
	if (l.status !== 401) return l;
	if (t.authenticated = !1, t.csrf = "", await c(), !["GET", "HEAD"].includes(s)) {
		let e = new Headers(o.headers || {});
		t.csrf && e.set("X-Hafize-CSRF", t.csrf), o.headers = e;
	}
	return e(n, o);
}
globalThis.fetch = l;
var u = Object.freeze({
	ready: s().catch(() => t),
	login: o,
	state: () => Object.freeze({
		required: t.required,
		authenticated: t.authenticated
	})
});
globalThis.HafizeAuth = u;
//#endregion
export { u as HafizeAuth };

//# sourceMappingURL=auth.js.map