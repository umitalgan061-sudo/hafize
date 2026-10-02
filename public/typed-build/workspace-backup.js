//#region public/typed/workspace-backup.ts
var e = 2e6, t = 12e5, n = "hafize.prompt-library.smart-fill.v1.", r = "hafize.workspace-backup.meta.v1", i = "hafize-workspace-backup", a = Object.freeze([
	{
		key: "hafize.conversations.v1",
		kind: "conversation",
		label: "Sohbetler",
		description: "Yerel konuşma geçmişi ve dalları."
	},
	{
		key: "hafize.message-workspace.v1",
		kind: "message-workspace",
		label: "Mesaj çalışma alanı",
		description: "Mesaj notları, etiketler ve geri bildirimler."
	},
	{
		key: "hafize.prompt-library.v1",
		kind: "prompt-library",
		label: "İstem kütüphanesi",
		description: "İstemler, etiketler, favoriler ve kullanım sayaçları."
	},
	{
		key: "hafize.prompt-library.v1.state",
		kind: "prompt-library-state",
		label: "İstem filtreleri",
		description: "Kütüphane arama, filtre ve sıralama durumu."
	},
	{
		key: "hafize.prompt-library.collections.v1",
		kind: "prompt-collections",
		label: "İstem koleksiyonları",
		description: "Yerel koleksiyonlar ve üyelikleri."
	},
	{
		key: "hafize.prompt-library.revisions.v1",
		kind: "prompt-revisions",
		label: "İstem sürümleri",
		description: "İstem sürüm geçmişi ve geri alma noktaları."
	},
	{
		key: "hafize.model-preferences.v1",
		kind: "model-preferences",
		label: "Model tercihleri",
		description: "Seçili model, ajan ve yerel profil tercihleri."
	},
	{
		key: "hafize.composer-history.v1",
		kind: "composer-history",
		label: "Composer geçmişi",
		description: "Cihazdaki son yazılan mesajlar."
	},
	{
		key: "hafize.composer-history.settings.v1",
		kind: "composer-history-settings",
		label: "Composer ayarları",
		description: "Geçmiş saklama tercihi."
	},
	{
		key: "hafize.scheduled-task-templates.v1",
		kind: "scheduled-task-templates",
		label: "Görev şablonları",
		description: "Yerel görev şablonları; gerçek planlanmış görevler değildir."
	},
	{
		key: "hafize.scheduled-task-draft.v1",
		kind: "scheduled-task-draft",
		label: "Görev taslağı",
		description: "Yerel, geçici görev formu taslağı."
	}
]), o = new Map(a.map((e) => [e.key, e])), s = (e, t = 240) => String(e ?? "").replace(/\\0/g, "").slice(0, t), c = () => (/* @__PURE__ */ new Date()).toISOString(), l = (e) => new TextEncoder().encode(e).byteLength, u = (e) => !(!e || typeof e != "object" || Array.isArray(e));
function d(e) {
	if (!e) return null;
	try {
		return JSON.parse(e);
	} catch {
		return null;
	}
}
function f(e) {
	return Array.isArray(e) ? "[" + e.map(f).join(",") + "]" : u(e) ? "{" + Object.keys(e).sort().map((t) => JSON.stringify(t) + ":" + f(e[t])).join(",") + "}" : JSON.stringify(e);
}
function p(e) {
	return globalThis.crypto?.subtle ? globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(e)).then((e) => Array.from(new Uint8Array(e)).map((e) => e.toString(16).padStart(2, "0")).join("")) : Promise.reject(/* @__PURE__ */ Error("INTEGRITY_UNAVAILABLE"));
}
function m(e) {
	try {
		let t = e || globalThis.localStorage;
		return !t || typeof t.getItem != "function" || typeof t.setItem != "function" ? null : t;
	} catch {
		return null;
	}
}
function h(e, t) {
	try {
		return e.getItem(t);
	} catch {
		return null;
	}
}
function g(e, n) {
	let r = h(e, n.key);
	if (r === null) return null;
	let i = d(r);
	if (i === null) return null;
	let a = l(JSON.stringify(i));
	return a > t ? null : {
		id: n.key,
		key: n.key,
		kind: n.kind,
		label: n.label,
		description: n.description,
		data: i,
		bytes: a
	};
}
function _(e) {
	let r = [];
	for (let t = 0; t < e.length && r.length < 24; t += 1) {
		let i = e.key(t);
		if (!i || !i.startsWith(n) || i.length > 180) continue;
		let a = i.slice(36);
		if (!/^[A-Za-z0-9_-]{1,120}$/.test(a)) continue;
		let o = d(h(e, i));
		o !== null && r.push({
			key: i,
			data: o
		});
	}
	if (!r.length) return null;
	let i = l(JSON.stringify(r));
	return i > t ? null : {
		id: "hafize.prompt-library.smart-fill.v1.*",
		key: n,
		kind: "prompt-smart-fill",
		label: "Akıllı doldurma değerleri",
		description: "İstem değişkenleri için yerel değer setleri.",
		data: { entries: r },
		bytes: i
	};
}
function v(e) {
	let t = m(e);
	if (!t) return {
		sections: [],
		skipped: ["localStorage kullanılamıyor."],
		totalBytes: 0
	};
	let r = [], i = [];
	for (let e of a) {
		let n = g(t, e);
		n ? r.push(n) : h(t, e.key) !== null && i.push(e.key);
	}
	let o = _(t);
	if (o) r.push(o);
	else for (let e = 0; e < t.length; e += 1) if (t.key(e)?.startsWith(n)) {
		i.push("Akıllı doldurma değerlerinden bazıları");
		break;
	}
	return r.sort((e, t) => e.label.localeCompare(t.label, "tr")), {
		sections: r.slice(0, 32),
		skipped: i,
		totalBytes: r.reduce((e, t) => e + t.bytes, 0)
	};
}
function y(e) {
	return f({
		format: e.format,
		version: e.version,
		exportedAt: e.exportedAt,
		source: e.source,
		sections: e.sections,
		...e.skipped?.length ? { skipped: e.skipped.slice(0, 24) } : {}
	});
}
async function b(t, n) {
	let { sections: r, skipped: a } = v(t), o = n && n.length ? new Set(n.slice(0, 32)) : null, s = o ? r.filter((e) => o.has(e.id)) : r;
	if (s.reduce((e, t) => e + t.bytes, 0), !s.length) throw Error(a.length ? "NO_EXPORTABLE_DATA" : "NO_LOCAL_DATA");
	let u = {
		format: i,
		version: 1,
		exportedAt: c(),
		source: "local-device",
		sections: s,
		...a.length ? { skipped: a.slice(0, 24) } : {},
		integrity: null
	}, d = await p(y(u)), f = {
		...u,
		integrity: {
			algorithm: "SHA-256",
			digest: d
		}
	};
	if (l(JSON.stringify(f)) > e) throw Error("BACKUP_TOO_LARGE");
	return a.length, f;
}
function x(e) {
	if (!u(e)) return null;
	let n = s(e.key, 180), r = o.get(n);
	if (!r) return null;
	let i = s(e.id, 180), a = e.data;
	if (!i || a === void 0) return null;
	let c = l(JSON.stringify(a));
	return c > t ? null : {
		id: i,
		key: n,
		kind: r.kind,
		label: r.label,
		description: r.description,
		data: a,
		bytes: c
	};
}
function S(e) {
	if (!u(e) || s(e.key, 180) !== n) return null;
	let r = u(e.data) && Array.isArray(e.data.entries) ? e.data.entries : [], i = [];
	for (let e of r.slice(0, 24)) {
		if (!u(e)) continue;
		let t = s(e.key, 180);
		t.startsWith(n) && /^[A-Za-z0-9_-]{1,120}$/.test(t.slice(36)) && e.data !== void 0 && i.push({
			key: t,
			data: e.data
		});
	}
	if (!i.length) return null;
	let a = { entries: i }, o = l(JSON.stringify(a));
	return o > t ? null : {
		id: n,
		key: n,
		kind: "prompt-smart-fill",
		label: "Akıllı doldurma değerleri",
		description: "İstem değişkenleri için yerel değer setleri.",
		data: a,
		bytes: o
	};
}
async function C(t) {
	let n = l(t);
	if (n > e) return {
		valid: !1,
		integrity: "failed",
		sections: [],
		totalBytes: n,
		skipped: [],
		reason: "Yedek 2 MB sınırını aşıyor."
	};
	let r;
	try {
		r = JSON.parse(t);
	} catch {
		return {
			valid: !1,
			integrity: "failed",
			sections: [],
			totalBytes: n,
			skipped: [],
			reason: "JSON biçimi geçersiz."
		};
	}
	if (!u(r) || r.format !== i || r.version !== 1 || r.source !== "local-device" || !Array.isArray(r.sections)) return {
		valid: !1,
		integrity: "failed",
		sections: [],
		totalBytes: n,
		skipped: [],
		reason: "Hafize workspace yedeği biçimi tanınmadı."
	};
	let a = [], o = [];
	for (let e of r.sections.slice(0, 32)) {
		let t = S(e), n = t ? null : x(e);
		t || n ? a.push(t || n) : o.push("Geçersiz veya izin verilmeyen yüzey");
	}
	if (!a.length) return {
		valid: !1,
		integrity: "failed",
		sections: [],
		totalBytes: n,
		skipped: o,
		reason: "Geri yüklenebilir veri yüzeyi bulunamadı."
	};
	let c = {
		format: i,
		version: 1,
		exportedAt: s(r.exportedAt, 40),
		source: "local-device",
		sections: a,
		...Array.isArray(r.skipped) ? { skipped: r.skipped.filter((e) => typeof e == "string").slice(0, 24).map((e) => s(e, 180)) } : {},
		integrity: u(r.integrity) && r.integrity.algorithm === "SHA-256" && typeof r.integrity.digest == "string" ? {
			algorithm: "SHA-256",
			digest: s(r.integrity.digest, 128)
		} : null
	}, d = "unverified";
	if (c.integrity?.digest) try {
		d = await p(y(c)) === c.integrity.digest ? "verified" : "failed";
	} catch {
		d = "unverified";
	}
	return d === "failed" ? {
		valid: !1,
		integrity: d,
		sections: a,
		totalBytes: n,
		skipped: o,
		reason: "Yedek bütünlük doğrulamasından geçmedi."
	} : {
		valid: !0,
		integrity: d,
		sections: a,
		totalBytes: n,
		skipped: o
	};
}
function w(e, t) {
	let n = new Set(t.slice(0, 32));
	return e.filter((e) => n.has(e.id));
}
function T(e, t) {
	let r = /* @__PURE__ */ new Map();
	for (let i of t) if (i.kind === "prompt-smart-fill") for (let t = 0; t < e.length; t += 1) {
		let i = e.key(t);
		i?.startsWith(n) && r.set(i, h(e, i));
	}
	else r.set(i.key, h(e, i.key));
	return r;
}
function E(e, t) {
	for (let [n, r] of t) try {
		r === null ? e.removeItem(n) : e.setItem(n, r);
	} catch {}
}
function D(e, t, r) {
	let i = m(e);
	if (!i) return {
		restored: 0,
		removed: 0,
		rolledBack: !1,
		warnings: ["localStorage kullanılamıyor."]
	};
	let a = w(t, r);
	if (!a.length) return {
		restored: 0,
		removed: 0,
		rolledBack: !1,
		warnings: ["Geri yüklenecek yüzey seçilmedi."]
	};
	let o = T(i, a), c = 0, l = 0;
	try {
		for (let e of a) {
			if (e.kind === "prompt-smart-fill") {
				let t = u(e.data) && Array.isArray(e.data.entries) ? e.data.entries : [], r = [];
				for (let e = 0; e < i.length; e += 1) {
					let t = i.key(e);
					t?.startsWith(n) && r.push(t);
				}
				for (let e of r) i.removeItem(e), l += 1;
				for (let e of t) {
					if (!u(e)) continue;
					let t = s(e.key, 180);
					t.startsWith(n) && (i.setItem(t, JSON.stringify(e.data)), c += 1);
				}
				continue;
			}
			let t = JSON.stringify(e.data);
			if (t === void 0) throw Error("INVALID_SECTION");
			i.setItem(e.key, t), c += 1;
		}
		return {
			restored: c,
			removed: l,
			rolledBack: !1,
			warnings: []
		};
	} catch {
		return E(i, o), {
			restored: 0,
			removed: 0,
			rolledBack: !0,
			warnings: ["Depolama işlemi başarısız oldu; seçili veriler geri alındı."]
		};
	}
}
function O(e) {
	let t = e.toLocaleLowerCase("en-US");
	return t.includes("token") || t.includes("secret") || t.includes("credential") || t.includes("password") || t.includes("oauth") || t.includes("session") || t.includes("auth.");
}
function k(e) {
	let t = s(e, 180);
	return !t || O(t) ? !1 : o.has(t) || t.startsWith(n);
}
function A(t) {
	let n = m(t);
	if (!n) return null;
	try {
		let t = d(n.getItem(r));
		return u(t) ? {
			exportedAt: s(t.exportedAt, 40),
			sections: Number.isFinite(Number(t.sections)) ? Math.max(0, Math.min(32, Number(t.sections))) : 0,
			bytes: Number.isFinite(Number(t.bytes)) ? Math.max(0, Math.min(e, Number(t.bytes))) : 0
		} : null;
	} catch {
		return null;
	}
}
function j(e, t) {
	let n = m(e);
	if (n) try {
		n.setItem(r, JSON.stringify({
			exportedAt: t.exportedAt,
			sections: t.sections.length,
			bytes: l(JSON.stringify(t))
		}));
	} catch {}
}
function M(e) {
	return e < 1024 ? e + " B" : e < 1048576 ? (e / 1024).toFixed(1) + " KB" : (e / 1048576).toFixed(2) + " MB";
}
function N(e, t, n = "", r = "") {
	let i = e.createElement(t);
	return r && (i.className = r), n && (i.textContent = n), i;
}
function P(e, t, n = "mini-btn") {
	let r = N(e, "button", t, n);
	return r.type = "button", r;
}
function F(t = document, n = globalThis) {
	let r = t?.querySelector?.(".utility-rail");
	if (!t || !r || t.getElementById("workspaceBackupPanel")) return null;
	let i = N(t, "section", "", "utility-card workspace-backup-panel");
	i.id = "workspaceBackupPanel", i.setAttribute("aria-labelledby", "workspaceBackupTitle");
	let a = N(t, "div", "", "workspace-backup-head"), o = N(t, "strong", "Çalışma alanı yedeği", "workspace-backup-title");
	o.id = "workspaceBackupTitle";
	let c = P(t, "Gizle");
	c.setAttribute("aria-expanded", "true"), c.setAttribute("aria-controls", "workspaceBackupBody"), a.append(o, c);
	let u = N(t, "div");
	u.id = "workspaceBackupBody", u.className = "workspace-backup-body";
	let d = N(t, "div", "", "workspace-backup-summary"), f = N(t, "strong", "Yerel veriler"), p = N(t, "");
	d.append(f, p);
	let m = N(t, "div", "", "workspace-backup-export-scope"), h = N(t, "strong", "Yedek kapsamı"), g = N(t, "Hangi yerel yüzeylerin yedeğe gireceğini seçebilirsin.", "", "workspace-backup-export-hint"), _ = N(t, "div", "", "workspace-backup-select-actions"), y = P(t, "Tümünü seç"), x = P(t, "Seçimleri temizle");
	_.append(y, x);
	let S = N(t, "div", "", "workspace-backup-export-list");
	S.setAttribute("role", "group"), m.append(h, g, _, S);
	let w = N(t, "div", "", "workspace-backup-actions"), T = P(t, "Yedeği indir", "soft-btn"), E = P(t, "Yedekten geri yükle", "soft-btn"), O = t.createElement("input");
	O.type = "file", O.accept = "application/json,.json", O.hidden = !0, w.append(T, E);
	let F = N(t, "div", "", "workspace-backup-status");
	F.setAttribute("role", "status"), F.setAttribute("aria-live", "polite");
	let I = N(t, "div", "", "workspace-backup-preview");
	I.hidden = !0, I.setAttribute("role", "dialog"), I.setAttribute("aria-modal", "false"), I.setAttribute("aria-labelledby", "workspaceBackupPreviewTitle");
	let L = N(t, "strong", "Geri yükleme önizlemesi");
	L.id = "workspaceBackupPreviewTitle";
	let R = N(t, "div", "", "workspace-backup-integrity"), z = N(t, "div", "", "workspace-backup-select-actions"), B = P(t, "Tümünü seç"), V = P(t, "Seçimleri temizle");
	z.append(B, V);
	let H = N(t, "div", "", "workspace-backup-section-list");
	H.setAttribute("role", "group");
	let U = N(t, "div", "", "workspace-backup-preview-actions"), W = P(t, "Vazgeç"), G = P(t, "Seçilenleri geri yükle", "soft-btn");
	U.append(W, G), I.append(L, R, z, H, U), u.append(d, m, w, O, F, I), i.append(a, u), r.append(i);
	let K = [], q = (e, t, n) => {
		e.addEventListener(t, n), K.push(() => e.removeEventListener(t, n));
	}, J = null, Y = null, X = !1, Z = !1, Q = (e) => {
		F.textContent = s(e, 220);
	}, ee = () => v(n.localStorage);
	function te() {
		let e = ee(), n = S.querySelectorAll("input[data-backup-export-section]").length > 0 ? new Set(ne()) : null;
		S.replaceChildren();
		for (let r of e.sections) {
			let e = N(t, "label", "", "workspace-backup-choice"), i = t.createElement("input");
			i.type = "checkbox", i.checked = !n || n.has(r.id), i.value = r.id, i.dataset.backupExportSection = r.id;
			let a = N(t, "span", "", "workspace-backup-choice-copy");
			a.append(N(t, "strong", r.label), N(t, "small", r.description)), e.append(i, a, N(t, "span", M(r.bytes), "workspace-backup-choice-size")), S.append(e);
		}
		e.sections.length || S.append(N(t, "small", "Yedeklenebilir yerel yüzey bulunmuyor.", "workspace-backup-export-empty"));
	}
	function ne() {
		return Array.from(S.querySelectorAll("input[data-backup-export-section]:checked")).map((e) => e.value).slice(0, 32);
	}
	function $() {
		if (Z) return;
		let e = ee();
		te();
		let t = A(n.localStorage);
		p.textContent = e.sections.length ? e.sections.length + " yüzey · " + M(e.totalBytes) + (t?.exportedAt ? " · son yedek " + new Date(t.exportedAt).toLocaleString("tr-TR") : "") : "Yedeklenebilir yerel veri bulunmuyor.";
	}
	function re(e) {
		J = e, H.replaceChildren(), R.textContent = e.integrity === "verified" ? "Bütünlük: doğrulandı (SHA-256)" : e.integrity === "unverified" ? "Bütünlük: imza yok veya doğrulama kullanılamıyor" : "Bütünlük: başarısız", G.disabled = e.integrity === "failed";
		for (let n of e.sections) {
			let e = N(t, "label", "", "workspace-backup-choice"), r = t.createElement("input");
			r.type = "checkbox", r.value = n.id, r.dataset.backupSection = n.id;
			let i = N(t, "span", "", "workspace-backup-choice-copy");
			i.append(N(t, "strong", n.label), N(t, "small", n.description)), e.append(r, i, N(t, "span", M(n.bytes), "workspace-backup-choice-size")), H.append(e);
		}
		I.hidden = !1, H.querySelector("input")?.focus();
	}
	async function ie() {
		try {
			T.disabled = !0, Q("Yedek hazırlanıyor…");
			let r = ne();
			if (!r.length) throw Error("NO_EXPORT_SELECTION");
			let i = await b(n.localStorage, r), a = JSON.stringify(i, null, 2);
			if (l(a) > e) throw Error("BACKUP_TOO_LARGE");
			let o = new Blob([a], { type: "application/json;charset=utf-8" }), s = n.URL.createObjectURL(o), c = N(t, "a");
			c.href = s, c.download = "hafize-workspace-backup.json", c.click(), n.setTimeout(() => n.URL.revokeObjectURL(s), 0), j(n.localStorage, i), $(), Q(i.sections.length + " yüzey yedeklendi · " + M(l(a)));
		} catch (e) {
			Q(e instanceof Error && e.message === "BACKUP_TOO_LARGE" ? "Yedek 2 MB sınırını aşamaz." : e instanceof Error && e.message === "NO_EXPORT_SELECTION" ? "En az bir yedek yüzeyi seçmelisin." : "Yedek oluşturulamadı.");
		} finally {
			T.disabled = !1;
		}
	}
	function ae() {
		Y = t.activeElement, O.click();
	}
	async function oe() {
		let t = O.files?.[0];
		if (O.value = "", t) try {
			if (t.size > e) throw Error("TOO_LARGE");
			let n = await C(await t.text());
			if (!n.valid) throw Error(n.reason || "INVALID_BACKUP");
			re(n), Q(n.sections.length + " yüzey bulundu · seçim yap ve geri yüklemeyi onayla.");
		} catch (e) {
			I.hidden = !0, Q(e instanceof Error && e.message === "TOO_LARGE" ? "Yedek 2 MB sınırını aşamaz." : e instanceof Error ? e.message : "Yedek okunamadı.");
		}
	}
	let se = () => Array.from(H.querySelectorAll("input[data-backup-section]:checked")).map((e) => e.value).slice(0, 32);
	function ce() {
		if (!J) return;
		let e = se();
		if (!e.length) return Q("En az bir yüzey seçmelisin.");
		let t = J.sections.filter((t) => e.includes(t.id)).map((e) => e.label).join(", ");
		if (!n.confirm?.("Seçilen yerel veriler mevcut verilerin üzerine yazılacak: " + t + ". Devam edilsin mi?")) return;
		let r = D(n.localStorage, J.sections, e);
		if (r.rolledBack) return I.hidden = !0, Q(r.warnings.join(" "));
		n.dispatchEvent(new n.CustomEvent("hafize:workspace-backup-restored", { detail: {
			ids: e,
			restored: r.restored
		} })), I.hidden = !0, $(), Q(r.restored + " yüzey geri yüklendi. İlgili paneller otomatik yenilenir."), Y?.focus?.(), Y = null;
	}
	q(T, "click", () => {
		ie();
	}), q(E, "click", ae), q(O, "change", () => {
		oe();
	}), q(y, "click", () => S.querySelectorAll("input[data-backup-export-section]").forEach((e) => {
		e.checked = !0;
	})), q(x, "click", () => S.querySelectorAll("input[data-backup-export-section]").forEach((e) => {
		e.checked = !1;
	})), q(B, "click", () => H.querySelectorAll("input[data-backup-section]").forEach((e) => {
		e.checked = !0;
	})), q(V, "click", () => H.querySelectorAll("input[data-backup-section]").forEach((e) => {
		e.checked = !1;
	})), q(W, "click", () => {
		I.hidden = !0, Y?.focus?.(), Y = null;
	}), q(G, "click", ce), q(c, "click", () => {
		X = !X, u.hidden = X, c.textContent = X ? "Göster" : "Gizle", c.setAttribute("aria-expanded", String(!X));
	}), q(n, "storage", (e) => {
		(e.key === null || k(e.key)) && $();
	}), q(n, "hafize:workspace-backup-restored", () => $());
	for (let e of [
		"hafize:prompt-library-changed",
		"hafize:prompt-library-collections-changed",
		"hafize:message-workspace-changed",
		"hafize:composer-history-changed",
		"hafize:composer-history-settings-changed",
		"hafize:model-preferences-changed",
		"hafize:scheduled-task-templates-changed",
		"hafize:conversation-forks-changed"
	]) q(n, e, () => $());
	return q(t, "keydown", (e) => {
		(e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "y" && (e.target?.closest?.("input,textarea,select,button,[contenteditable=\"true\"]") || (e.preventDefault(), i.scrollIntoView({ block: "nearest" }), T.focus()));
	}), $(), Object.freeze({
		refresh: $,
		openImport: ae,
		destroy: () => {
			K.splice(0).forEach((e) => e()), i.remove(), Z = !0;
		}
	});
}
var I = () => {
	F();
};
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", I, { once: !0 }) : I();
//#endregion
export { k as allowedStorageKey, A as backupMetadata, v as collectSections, b as createBackup, M as formatBytes, C as inspectBackup, F as mountWorkspaceBackup, D as restoreSelected, j as saveBackupMetadata };

//# sourceMappingURL=workspace-backup.js.map