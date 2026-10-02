import { t as e } from "./rolldown-runtime-CtkjhSXr.js";
//#region public/typed/prompt-library.ts
var t = /* @__PURE__ */ e(((e, t) => {
	(function(e, n) {
		let r = n();
		typeof t == "object" && t?.exports ? t.exports = r : e.HafizePromptLibrary = r;
		let i = () => r.mount(e.document, e);
		e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", i, { once: !0 }) : i();
	})(typeof globalThis < "u" ? globalThis : self, function() {
		let e = "hafize.prompt-library.v1", t = `${e}.state`, n = Object.freeze({
			maxItems: 120,
			maxSelection: 40,
			maxTitle: 100,
			maxBody: 8e3,
			maxTags: 8,
			maxTag: 24,
			maxVariables: 12,
			maxVariable: 32,
			maxQuery: 120,
			maxImport: 1e6,
			maxExport: 1e6,
			maxVariableValue: 1e3
		}), r = Object.freeze([
			"updated-desc",
			"favorite-first",
			"created-desc",
			"title-asc"
		]), i = Object.freeze({
			query: "",
			tag: "all",
			favoriteOnly: !1,
			sort: "updated-desc"
		}), a = (e, t) => typeof e == "string" ? e.trim().slice(0, t) : "", o = () => (/* @__PURE__ */ new Date()).toISOString(), s = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, c = (e) => {
			if (!Array.isArray(e)) return [];
			let t = /* @__PURE__ */ new Set(), r = [];
			for (let i of e) {
				let e = a(i, n.maxTag).replace(/[,\r\n]/g, " "), o = e.toLocaleLowerCase("tr-TR");
				if (e && !t.has(o) && (t.add(o), r.push(e), r.length >= n.maxTags)) break;
			}
			return r;
		}, l = (e, t) => {
			let r = Array.isArray(t) ? t : [], i = r.length ? r : (String(e || "").match(/\{\{\s*[a-zA-Z0-9_-]{1,32}\s*\}\}/g) || []).map((e) => e.replace(/^\{\{\s*|\s*\}\}$/g, "")), o = /* @__PURE__ */ new Set(), s = [];
			for (let e of i) {
				let t = a(e, n.maxVariable).replace(/[^a-zA-Z0-9_-]/g, "");
				if (t && !o.has(t) && (o.add(t), s.push(t), s.length >= n.maxVariables)) break;
			}
			return s;
		};
		function u(e) {
			if (!e || typeof e != "object") return null;
			let t = typeof e.body == "string" ? e.body.slice(0, n.maxBody).replace(/\0/g, "") : "";
			if (!t) return null;
			let r = a(e.createdAt, 40) || o();
			return Object.freeze({
				id: a(e.id, 120) || s(),
				title: a(e.title, n.maxTitle) || "İsimsiz istem",
				body: t,
				tags: c(e.tags),
				variables: l(t, e.variables),
				favorite: e.favorite === !0,
				useCount: Number.isFinite(e.useCount) && e.useCount >= 0 ? Math.min(9999, Math.floor(e.useCount)) : 0,
				createdAt: r,
				updatedAt: a(e.updatedAt, 40) || r
			});
		}
		function d(e) {
			if (!Array.isArray(e)) return [];
			let t = /* @__PURE__ */ new Set(), r = [];
			for (let i of e.slice(0, n.maxItems * 2)) {
				let e = u(i);
				if (e && !t.has(e.id) && (t.add(e.id), r.push(e), r.length >= n.maxItems)) break;
			}
			return r;
		}
		function f(e) {
			return !e || typeof e != "object" ? { ...i } : {
				query: a(e.query, n.maxQuery),
				tag: e.tag === "all" ? "all" : a(e.tag, n.maxTag) || "all",
				favoriteOnly: e.favoriteOnly === !0,
				sort: r.includes(e.sort) ? e.sort : i.sort
			};
		}
		function p(e, t, n) {
			try {
				return JSON.parse(e?.getItem?.(t) || JSON.stringify(n));
			} catch {
				return n;
			}
		}
		function m(e, t, n) {
			try {
				return e?.setItem?.(t, JSON.stringify(n)), !0;
			} catch {
				return !1;
			}
		}
		function h(t) {
			return d(p(t || globalThis.localStorage, e, []));
		}
		function g(e) {
			return f(p(e || globalThis.localStorage, t, i));
		}
		function _(t, n) {
			return m(t || globalThis.localStorage, e, d(n));
		}
		function v(e, n) {
			return m(e || globalThis.localStorage, t, f(n));
		}
		function y(e, t) {
			if (!e || t.favoriteOnly && !e.favorite || t.tag !== "all" && !e.tags.some((e) => e.toLocaleLowerCase("tr-TR") === t.tag.toLocaleLowerCase("tr-TR"))) return !1;
			if (!t.query) return !0;
			let n = t.query.toLocaleLowerCase("tr-TR");
			return [
				e.title,
				e.body,
				...e.tags,
				...e.variables
			].join("\n").toLocaleLowerCase("tr-TR").includes(n);
		}
		function b(e, t) {
			let n = e.slice();
			return t === "title-asc" ? n.sort((e, t) => e.title.localeCompare(t.title, "tr")) : t === "created-desc" ? n.sort((e, t) => t.createdAt.localeCompare(e.createdAt) || t.updatedAt.localeCompare(e.updatedAt) || e.title.localeCompare(t.title, "tr")) : t === "favorite-first" ? n.sort((e, t) => Number(t.favorite) - Number(e.favorite) || t.updatedAt.localeCompare(e.updatedAt)) : n.sort((e, t) => t.updatedAt.localeCompare(e.updatedAt));
		}
		function x(e, t) {
			return b(e.filter((e) => y(e, t)), t.sort);
		}
		function S(e) {
			let t = /* @__PURE__ */ new Map();
			for (let n of e) for (let e of n.tags) {
				let n = e.toLocaleLowerCase("tr-TR");
				t.has(n) || t.set(n, e);
			}
			return [...t.values()].sort((e, t) => e.localeCompare(t, "tr")).slice(0, 80);
		}
		function C(e) {
			return l(String(e || ""), null);
		}
		function w(e, t) {
			let r = String(e || ""), i = t && typeof t == "object" ? t : {};
			return r.replace(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g, (e, t) => String(i[t] ?? "").slice(0, n.maxVariableValue)).slice(0, n.maxBody);
		}
		function T(e) {
			return Array.isArray(e) ? {
				items: d(e),
				meta: {}
			} : !e || typeof e != "object" ? {
				items: [],
				meta: {}
			} : {
				items: d(e.items),
				meta: {
					source: a(e.source, 80),
					exportedAt: a(e.exportedAt, 40)
				}
			};
		}
		function E(e, t) {
			let r = d(e), i = new Set(r.map((e) => e.id)), a = 0;
			for (let e of Array.isArray(t) ? t.slice(0, n.maxItems * 2) : []) {
				let t = u(e);
				if (!t) continue;
				let o = t.id;
				for (; i.has(o);) o = s();
				if (o !== t.id && (t = Object.freeze({
					...t,
					id: o
				})), i.add(t.id), r.push(t), a += 1, r.length >= n.maxItems) break;
			}
			return {
				items: d(r),
				imported: a
			};
		}
		function D(e) {
			let t = {
				version: 1,
				source: "hafize-prompt-library",
				exportedAt: o(),
				items: d(e)
			}, r = JSON.stringify(t, null, 2);
			return r.length <= n.maxExport ? r : JSON.stringify({
				...t,
				items: t.items.slice(0, 40)
			}, null, 2);
		}
		function O(e, t, n, r) {
			let i = e.createElement(t);
			return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
		}
		function k(e, t, n = "soft-btn") {
			let r = O(e, "button", t, n);
			return r.type = "button", r;
		}
		function A(r = globalThis.document, i = globalThis, c = {}) {
			let l = r?.querySelector?.(".utility-rail"), f = r?.querySelector?.("#messageInput");
			if (!r || !l || !f) return null;
			if (r.getElementById("promptLibraryCard")) return {
				mounted: !1,
				reason: "already-mounted"
			};
			let p = c.storage || i.localStorage, m = h(p), y = g(p), b = /* @__PURE__ */ new Set(), A = !1, j = [], M = O(r, "section", void 0, "utility-card prompt-library-card");
			M.id = "promptLibraryCard", M.setAttribute("aria-labelledby", "promptLibraryTitle");
			let N = O(r, "div", void 0, "utility-head prompt-library-head");
			N.append(O(r, "span", "✎", "mini-icon")), N.append(O(r, "span", "İstem kütüphanesi", "prompt-library-title"));
			let P = O(r, "span", "", "prompt-library-count");
			N.append(P);
			let F = r.createElement("input");
			F.type = "search", F.maxLength = n.maxQuery, F.placeholder = "İstem ara…", F.setAttribute("aria-label", "İstem kütüphanesinde ara");
			let I = r.createElement("select");
			I.setAttribute("aria-label", "İstemleri sırala");
			for (let [e, t] of [
				["updated-desc", "Son güncellenen"],
				["favorite-first", "Favoriler"],
				["created-desc", "Yeni oluşturulan"],
				["title-asc", "Başlığa göre"]
			]) {
				let n = O(r, "option", t);
				n.value = e, I.append(n);
			}
			let L = O(r, "div", void 0, "prompt-library-filters"), R = r.createElement("select");
			R.setAttribute("aria-label", "Etikete göre filtrele");
			let z = k(r, "★ Favoriler", "mini-btn");
			z.id = "promptLibraryFavoriteFilter", L.append(R, z);
			let B = O(r, "div", void 0, "prompt-library-toolbar");
			B.append(F, I);
			let V = O(r, "div", void 0, "prompt-library-list");
			V.id = "promptLibraryList", V.setAttribute("role", "list");
			let H = O(r, "div", void 0, "prompt-library-actions"), U = k(r, "＋ Yeni istem"), W = k(r, "İçe aktar"), G = k(r, "Dışa aktar");
			H.append(U, W, G);
			let K = O(r, "div", void 0, "prompt-library-editor");
			K.hidden = !0;
			let q = r.createElement("input");
			q.type = "file", q.accept = "application/json,.json", q.hidden = !0;
			let J = O(r, "div", "", "prompt-library-status");
			J.setAttribute("role", "status"), J.setAttribute("aria-live", "polite"), M.append(N, B, L, V, H, K, q, J), l.append(M);
			let Y = (e, t, n) => {
				e.addEventListener(t, n), j.push(() => e.removeEventListener(t, n));
			}, X = (e) => {
				J.textContent = a(e, 180);
			}, Z = () => {
				let e = _(p, m) && v(p, y);
				return e || X("Kütüphane cihazda kalıcı kaydedilemedi."), e;
			};
			function ee() {
				let e = y.tag;
				R.replaceChildren();
				let t = O(r, "option", "Tüm etiketler");
				t.value = "all", R.append(t);
				for (let e of S(m)) {
					let t = O(r, "option", e);
					t.value = e, R.append(t);
				}
				R.value = S(m).some((t) => t.toLocaleLowerCase("tr-TR") === e.toLocaleLowerCase("tr-TR")) ? e : "all";
			}
			function Q(e) {
				K.hidden = !1, K.replaceChildren();
				let t = r.createElement("input");
				t.maxLength = n.maxTitle, t.value = e?.title || "", t.setAttribute("aria-label", "İstem başlığı");
				let i = r.createElement("textarea");
				i.maxLength = n.maxBody, i.rows = 7, i.value = e?.body || "", i.setAttribute("aria-label", "İstem metni");
				let a = r.createElement("input");
				a.maxLength = 220, a.value = e?.tags?.join(", ") || "", a.placeholder = "etiket1, etiket2", a.setAttribute("aria-label", "İstem etiketleri");
				let c = O(r, "div", e ? `Değişkenler: ${C(e.body).map((e) => `{{${e}}}`).join(" · ")}` : "Değişkenleri {{konu}} biçiminde yazabilirsiniz.", "prompt-library-variable-help"), l = k(r, "Kaydet"), f = k(r, "Vazgeç"), p = O(r, "div", void 0, "prompt-library-editor-actions");
				p.append(l, f), K.append(O(r, "label", "Başlık"), t, O(r, "label", "İstem metni"), i, O(r, "label", "Etiketler"), a, c, p), i.addEventListener("input", () => {
					let e = C(i.value);
					c.textContent = e.length ? `Değişkenler: ${e.map((e) => `{{${e}}}`).join(" · ")}` : "Değişken yok";
				}), f.addEventListener("click", () => {
					K.hidden = !0, K.replaceChildren();
				}), l.addEventListener("click", () => {
					let n = u({
						id: e?.id || s(),
						title: t.value,
						body: i.value,
						tags: a.value.split(","),
						favorite: e?.favorite === !0,
						useCount: e?.useCount || 0,
						createdAt: e?.createdAt || o(),
						updatedAt: o()
					});
					if (!n) return X("İstem metni boş olamaz.");
					let r = m.findIndex((e) => e.id === n.id);
					r >= 0 ? m.splice(r, 1, n) : m.unshift(n), m = d(m), Z(), K.hidden = !0, K.replaceChildren(), $(), X("İstem kaydedildi.");
				}), t.focus();
			}
			function te(e) {
				let t = C(e.body), r = {};
				for (let e of t) {
					let t = i.prompt?.(`${e} değerini gir:`, "") ?? "";
					if (t === null) return;
					r[e] = String(t).slice(0, n.maxVariableValue);
				}
				f.value = w(e.body, r), f.dispatchEvent(new Event("input", { bubbles: !0 })), f.focus();
				let a = m.findIndex((t) => t.id === e.id);
				a >= 0 && m.splice(a, 1, u({
					...m[a],
					useCount: m[a].useCount + 1,
					updatedAt: o()
				})), Z(), X("İstem mesaj alanına aktarıldı.");
			}
			function $() {
				if (A) return;
				F.value = y.query, I.value = y.sort, z.setAttribute("aria-pressed", String(y.favoriteOnly)), ee();
				let e = x(m, y);
				if (P.textContent = `${e.length}/${m.length}`, V.replaceChildren(), !e.length) {
					V.append(O(r, "div", m.length ? "Filtreye uyan istem yok." : "Kayıtlı istem yok.", "prompt-library-empty"));
					return;
				}
				for (let t of e) {
					let e = O(r, "article", void 0, "prompt-item");
					e.dataset.promptId = t.id;
					let a = r.createElement("input");
					a.type = "checkbox", a.checked = b.has(t.id), a.setAttribute("aria-label", `${t.title} seç`);
					let s = O(r, "div", void 0, "prompt-item-content"), c = O(r, "div", void 0, "prompt-item-header");
					c.append(O(r, "strong", t.title));
					let l = k(r, t.favorite ? "★" : "☆", "prompt-item-star");
					l.setAttribute("aria-label", t.favorite ? "Favoriden çıkar" : "Favoriye al"), l.setAttribute("aria-pressed", String(t.favorite)), c.append(l), s.append(c, O(r, "p", t.body.replace(/\s+/g, " ").slice(0, 120)));
					let d = O(r, "div", `${new Intl.DateTimeFormat("tr-TR", {
						day: "2-digit",
						month: "short"
					}).format(new Date(t.updatedAt))} · ${t.useCount} kullanım`, "prompt-item-meta");
					for (let e of t.tags) d.append(" ", O(r, "span", e, "prompt-item-tag"));
					s.append(d);
					let f = O(r, "div", void 0, "prompt-item-actions"), p = k(r, "Kullan"), h = k(r, "Düzenle"), g = k(r, "Sil");
					f.append(p, h, g), s.append(f), e.append(a, s), V.append(e), Y(a, "change", () => {
						a.checked ? b.size < n.maxSelection ? b.add(t.id) : a.checked = !1 : b.delete(t.id);
					}), Y(l, "click", () => {
						let e = m.findIndex((e) => e.id === t.id);
						e < 0 || (m.splice(e, 1, u({
							...m[e],
							favorite: !m[e].favorite,
							updatedAt: o()
						})), Z(), $());
					}), Y(p, "click", () => te(t)), Y(h, "click", () => Q(t)), Y(g, "click", () => {
						i.confirm?.(`“${t.title}” silinsin mi?`) && (m = m.filter((e) => e.id !== t.id), b.delete(t.id), Z(), $(), X("İstem silindi."));
					});
				}
				if (b.size) {
					let e = O(r, "div", void 0, "prompt-library-bulk"), t = k(r, "Seçilenleri favorile"), n = k(r, `${b.size} seçimi temizle`);
					e.append(t, n), V.prepend(e), Y(t, "click", () => {
						let e = new Set(b);
						m = m.map((t) => e.has(t.id) ? u({
							...t,
							favorite: !0,
							updatedAt: o()
						}) : t), b.clear(), Z(), $();
					}), Y(n, "click", () => {
						b.clear(), $();
					});
				}
			}
			function ne(e) {
				if (!e || e.size > n.maxImport) return X("İçe aktarma dosyası 1 MB sınırını aşamaz.");
				let t = new FileReader();
				t.onload = () => {
					try {
						let e = T(JSON.parse(String(t.result || ""))), n = E(m, e.items);
						m = n.items, Z(), $(), X(`${n.imported} istem içe aktarıldı.`);
					} catch {
						X("Geçersiz istem yedeği.");
					}
				}, t.onerror = () => X("İstem yedeği okunamadı."), t.readAsText(e);
			}
			Y(F, "input", () => {
				y.query = a(F.value, n.maxQuery), Z(), $();
			}), Y(I, "change", () => {
				y.sort = I.value, Z(), $();
			}), Y(R, "change", () => {
				y.tag = R.value, Z(), $();
			}), Y(z, "click", () => {
				y.favoriteOnly = !y.favoriteOnly, Z(), $();
			}), Y(U, "click", () => Q(null)), Y(W, "click", () => q.click()), Y(q, "change", () => {
				ne(q.files?.[0]), q.value = "";
			}), Y(G, "click", () => {
				let e = b.size ? b : new Set(x(m, y).map((e) => e.id).slice(0, n.maxSelection)), t = m.filter((t) => e.has(t.id));
				if (!t.length) return X("Dışa aktarılacak istem yok.");
				let a = new Blob([D(t)], { type: "application/json;charset=utf-8" }), o = URL.createObjectURL(a), s = O(r, "a");
				s.href = o, s.download = "hafize-prompt-library.json", s.click(), i.setTimeout?.(() => URL.revokeObjectURL(o), 0), X(`${t.length} istem dışa aktarıldı.`);
			}), Y(i, "storage", (n) => {
				n.key === e && (m = h(p), $()), n.key === t && (y = g(p), $());
			}), Y(r, "keydown", (e) => {
				(e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p" && (e.preventDefault(), F.focus(), F.select());
			}), $();
			let re = Object.freeze({
				mounted: !0,
				getItems: () => m.slice(),
				getState: () => ({ ...y }),
				getVisibleItems: () => x(m, y),
				destroy: () => {
					A = !0;
					for (let e of j.splice(0)) e();
					M.remove();
				}
			});
			return i.addEventListener?.("beforeunload", () => re.destroy(), { once: !0 }), re;
		}
		return Object.freeze({
			STORAGE_KEY: e,
			STATE_KEY: t,
			LIMITS: Object.freeze(n),
			normalizeItem: u,
			normalizeCollection: d,
			safeState: f,
			loadItems: h,
			loadState: g,
			saveItems: _,
			saveState: v,
			extractVariables: C,
			replaceVariables: w,
			itemMatches: y,
			sortItems: b,
			filterItems: x,
			collectTags: S,
			normalizeImportedPayload: T,
			mergeImportedItems: E,
			exportPayload: D,
			mount: A
		});
	});
}));
//#endregion
export default t();

//# sourceMappingURL=prompt-library.js.map