//#region public/typed/settings-privacy.ts
(function(e) {
	let t = "privacyDataCenter", n = "privacyDataCenterStyle", r = "hafize:privacy-data-changed", i = 12e4, a = Object.freeze([
		{
			id: "conversations",
			keys: ["hafize.conversations.v1"],
			label: "Sohbetler",
			description: "Yerel sohbet geçmişi ve konuşma dalları.",
			group: "data"
		},
		{
			id: "message-workspace",
			keys: ["hafize.message-workspace.v1"],
			label: "Mesaj çalışma alanı",
			description: "Kaydedilen mesaj notları, etiketler ve geri bildirimler.",
			group: "data"
		},
		{
			id: "prompts",
			keys: ["hafize.prompt-library.v1"],
			label: "İstem kütüphanesi",
			description: "İstem metinleri, etiketler, favoriler ve kullanım sayaçları.",
			group: "data"
		},
		{
			id: "prompt-state",
			keys: ["hafize.prompt-library.v1.state"],
			label: "İstem filtreleri",
			description: "Prompt Library arama, etiket ve sıralama durumu.",
			group: "preference"
		},
		{
			id: "prompt-collections",
			keys: ["hafize.prompt-library.collections.v1"],
			label: "İstem koleksiyonları",
			description: "İstem koleksiyonları ve üyelikleri.",
			group: "data"
		},
		{
			id: "prompt-revisions",
			keys: ["hafize.prompt-library.revisions.v1"],
			label: "İstem sürümleri",
			description: "Prompt düzenleme sürümleri ve geri alma kayıtları.",
			group: "data"
		},
		{
			id: "smart-views",
			keys: ["hafize.prompt-library.smart-views.v1", "hafize.prompt-library.smart-views.v1.state"],
			label: "Akıllı görünümler",
			description: "Kaydedilmiş prompt filtreleri ve görünüm durumu.",
			group: "data"
		},
		{
			id: "smart-fill",
			prefix: "hafize.prompt-library.smart-fill.v1.",
			label: "Akıllı doldurma",
			description: "Değişkenler için cihazda tutulan değer setleri.",
			group: "data"
		},
		{
			id: "model-preferences",
			keys: ["hafize.model-preferences.v1"],
			label: "Model tercihleri",
			description: "Seçili model, ajan ve yerel profiller.",
			group: "preference"
		},
		{
			id: "composer-history",
			keys: ["hafize.composer-history.v1"],
			label: "Composer geçmişi",
			description: "Cihazda tutulan son yazılan mesajlar.",
			group: "data"
		},
		{
			id: "composer-settings",
			keys: ["hafize.composer-history.settings.v1"],
			label: "Composer ayarları",
			description: "Geçmiş saklama tercihi.",
			group: "preference"
		},
		{
			id: "task-templates",
			keys: ["hafize.scheduled-task-templates.v1"],
			label: "Görev şablonları",
			description: "Yerel görev şablonları; gerçek planlanmış görevler değildir.",
			group: "data"
		},
		{
			id: "task-draft",
			keys: ["hafize.scheduled-task-draft.v1"],
			label: "Görev taslağı",
			description: "Geçici görev formu taslağı.",
			group: "data"
		},
		{
			id: "theme",
			keys: ["hafize.theme.v1"],
			label: "Tema tercihi",
			description: "Açık/koyu tema seçimi.",
			group: "preference"
		},
		{
			id: "reduced-motion",
			keys: ["hafize.reduced-motion.v1"],
			label: "Hareket tercihi",
			description: "Azaltılmış hareket tercihi.",
			group: "preference"
		},
		{
			id: "backup-meta",
			keys: ["hafize.workspace-backup.meta.v1"],
			label: "Yedek meta verisi",
			description: "Son yerel çalışma alanı yedeğinin özet meta verisi.",
			group: "preference"
		}
	]), o = new Map(a.map(function(e) {
		return [e.id, e];
	})), s = /* @__PURE__ */ new Map();
	a.forEach(function(e) {
		(e.keys || []).forEach(function(t) {
			s.set(t, e);
		});
	});
	function c(e, t) {
		return String(e ?? "").replace(/\0/g, "").slice(0, t || 180);
	}
	function l(e) {
		try {
			return e && typeof e.key == "function" && typeof e.getItem == "function" && typeof e.removeItem == "function" ? e : null;
		} catch {
			return null;
		}
	}
	function u(e) {
		let t = String(e || "");
		return s.has(t) ? s.get(t) : a.find(function(e) {
			return e.prefix && t.startsWith(e.prefix);
		}) || null;
	}
	function d(e, t) {
		return !!(t && (t.prefix ? String(e || "").startsWith(t.prefix) : t.keys.includes(e)));
	}
	function f(e) {
		let t = l(e);
		if (!t) return {
			available: !1,
			surfaces: [],
			knownBytes: 0,
			unknownKeys: 0,
			unknownBytes: 0,
			totalKeys: 0
		};
		let n = new Map(a.map(function(e) {
			return [e.id, {
				id: e.id,
				label: e.label,
				description: e.description,
				group: e.group,
				keys: 0,
				bytes: 0,
				present: !1
			}];
		})), r = 0, i = 0, o = 0, s = 0, c = 0;
		try {
			c = Math.min(300, Math.max(0, Number(t.length) || 0));
		} catch {
			return {
				available: !1,
				surfaces: [],
				knownBytes: 0,
				unknownKeys: 0,
				unknownBytes: 0,
				totalKeys: 0
			};
		}
		for (let e = 0; e < c; e += 1) {
			let a = null;
			try {
				a = t.key(e);
			} catch {
				i += 1, s += 1;
				continue;
			}
			if (a === null) continue;
			s += 1;
			let c = "";
			try {
				c = t.getItem(a) || "";
			} catch {
				i += 1;
				continue;
			}
			let l = new TextEncoder().encode(String(a) + c).byteLength, d = u(a);
			if (d) {
				let e = n.get(d.id);
				e.keys += 1, e.bytes += l, e.present = !0, r += l;
			} else i += 1, o += l;
		}
		return {
			available: !0,
			surfaces: Array.from(n.values()),
			knownBytes: r,
			unknownKeys: i,
			unknownBytes: o,
			totalKeys: s
		};
	}
	function p(e) {
		let t = Math.max(0, Number(e) || 0);
		return t < 1024 ? String(t) + " B" : t < 1048576 ? (t / 1024).toFixed(1) + " KB" : (t / 1048576).toFixed(2) + " MB";
	}
	async function m(e) {
		try {
			let t = await e.navigator?.storage?.estimate?.();
			return {
				usage: Number.isFinite(t?.usage) ? Math.max(0, t.usage) : null,
				quota: Number.isFinite(t?.quota) ? Math.max(0, t.quota) : null
			};
		} catch {
			return {
				usage: null,
				quota: null
			};
		}
	}
	function h(e, t) {
		let n = [];
		if (!e || !t) return n;
		let r = 0;
		try {
			r = Math.min(300, Math.max(0, Number(e.length) || 0));
		} catch {
			return n;
		}
		for (let i = 0; i < r; i += 1) {
			let r = null;
			try {
				r = e.key(i);
			} catch {
				continue;
			}
			r !== null && d(r, t) && n.push(r);
		}
		return n;
	}
	function g(e, t) {
		let n = l(t), r = o.get(e);
		if (!n || !r) return {
			removed: 0,
			ok: !1
		};
		let i = h(n, r), a = 0;
		try {
			return i.forEach(function(e) {
				n.removeItem(e), a += 1;
			}), {
				removed: a,
				ok: !0
			};
		} catch {
			return {
				removed: a,
				ok: !1
			};
		}
	}
	function _(e, t) {
		let n = l(t);
		if (!n) return {
			removed: 0,
			ok: !1,
			failures: []
		};
		let r = 0, i = [];
		return a.filter(function(t) {
			return t.group === e;
		}).forEach(function(e) {
			let t = g(e.id, n);
			r += t.removed, t.ok || i.push(e.id);
		}), {
			removed: r,
			ok: i.length === 0,
			failures: i
		};
	}
	function v(e) {
		let t = l(e);
		if (!t) return {
			removed: 0,
			ok: !1,
			failures: []
		};
		let n = 0, r = [];
		return a.forEach(function(e) {
			let i = g(e.id, t);
			n += i.removed, i.ok || r.push(e.id);
		}), {
			removed: n,
			ok: r.length === 0,
			failures: r
		};
	}
	function y(e) {
		return e ? e.label + ": " + e.keys + " alan · " + p(e.bytes) + (e.present ? "" : " · Veri yok") : "";
	}
	function b(e, t) {
		let n = [
			"Hafize yerel veri özeti",
			"Bilinen veri: " + p(e.knownBytes),
			"Tanınmayan alan: " + e.unknownKeys,
			"Toplam localStorage alanı: " + e.totalKeys
		];
		return t?.usage !== null && t?.quota !== null && t?.quota > 0 && n.push("Tarayıcı kullanımı: " + p(t.usage) + " / " + p(t.quota)), n.concat(e.surfaces.filter(function(e) {
			return e.present;
		}).map(function(e) {
			return e.label + ": " + e.keys + " alan · " + p(e.bytes);
		})).join("\\n").slice(0, i);
	}
	function x(e, t) {
		let n = {
			format: "hafize-privacy-report",
			version: 1,
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			localOnly: !0,
			contentIncluded: !1,
			surfaces: e.surfaces.map(function(e) {
				return {
					id: e.id,
					present: e.present,
					keys: e.keys,
					bytes: e.bytes
				};
			}),
			totals: {
				knownBytes: e.knownBytes,
				unknownKeys: e.unknownKeys,
				unknownBytes: e.unknownBytes,
				totalKeys: e.totalKeys,
				storageUsage: t?.usage ?? null,
				storageQuota: t?.quota ?? null
			}
		}, r = JSON.stringify(n, null, 2);
		return new TextEncoder().encode(r).byteLength <= i || (n.surfaces = n.surfaces.slice(0, 8), r = JSON.stringify(n, null, 2)), r;
	}
	function ee(e) {
		if (!e?.head) return !1;
		if (e.getElementById(n)) return !0;
		let t = e.createElement("link");
		return t.id = n, t.rel = "stylesheet", t.href = "/settings-privacy.css", e.head.append(t), !0;
	}
	function S(e, t, n, r) {
		let i = e.createElement(t);
		return r && (i.className = r), n !== void 0 && (i.textContent = n), i;
	}
	function C(e, t, n) {
		let r = S(e, "button", t, n || "mini-btn");
		return r.type = "button", r;
	}
	function w(e, n) {
		let i = e?.getElementById?.("settingsWorkspace");
		if (!e || !i || e.getElementById(t) || !ee(e)) return null;
		let a = S(e, "section", void 0, "privacy-data-center");
		a.id = t, a.setAttribute("aria-labelledby", "privacyDataCenterTitle");
		let s = S(e, "div", void 0, "privacy-data-head"), l = S(e, "div", void 0, "privacy-data-heading");
		l.append(S(e, "span", "Gizlilik merkezi", "privacy-data-eyebrow"));
		let d = S(e, "h2", "Yerel veri ve gizlilik", "privacy-data-title");
		d.id = "privacyDataCenterTitle", l.append(d);
		let h = C(e, "Gizle");
		h.setAttribute("aria-expanded", "true"), h.setAttribute("aria-controls", "privacyDataCenterBody"), s.append(l, h);
		let w = S(e, "div", void 0, "privacy-data-body");
		w.id = "privacyDataCenterBody", w.append(S(e, "p", "Bu cihazdaki bilinen Hafize verilerini incele, yalnızca seçtiğin yüzeyi temizle veya içerik paylaşmadan gizlilik raporu üret.", "privacy-data-intro"));
		let E = S(e, "div", void 0, "privacy-data-summary"), D = S(e, "div", void 0, "privacy-data-stat"), O = S(e, "div", void 0, "privacy-data-stat"), k = S(e, "div", void 0, "privacy-data-stat");
		E.append(D, O, k);
		let A = S(e, "div", "", "privacy-data-quota"), te = S(e, "div", void 0, "privacy-data-actions"), j = C(e, "Yenile", "soft-btn"), M = C(e, "Gizlilik raporu", "soft-btn"), N = C(e, "Raporu kopyala", "soft-btn"), P = C(e, "Özeti kopyala", "soft-btn"), F = C(e, "Veri yüzeylerini temizle", "soft-btn privacy-data-warning"), I = C(e, "Tercihleri sıfırla", "soft-btn privacy-data-warning"), L = C(e, "Bilinen tüm yerel veriyi temizle", "soft-btn privacy-data-danger");
		te.append(j, M, N, P, F, I, L);
		let R = e.createElement("input");
		R.type = "search", R.maxLength = 80, R.placeholder = "Veri yüzeyi ara…", R.setAttribute("aria-label", "Yerel veri yüzeylerinde ara"), R.className = "privacy-data-filter";
		let z = e.createElement("select");
		z.setAttribute("aria-label", "Veri yüzeylerini sırala"), [["name", "Ada göre"], ["size", "Boyuta göre"]].forEach(function(t) {
			let n = e.createElement("option");
			n.value = t[0], n.textContent = t[1], z.append(n);
		});
		let B = e.createElement("input");
		B.type = "checkbox", B.id = "privacyDataOnlyPresent";
		let V = e.createElement("label");
		V.className = "privacy-data-only-present", V.append(B, S(e, "span", "Yalnız dolu yüzeyler"));
		let H = S(e, "div", void 0, "privacy-data-filter-controls");
		H.append(R, z, V);
		let U = S(e, "div", void 0, "privacy-data-list");
		U.setAttribute("role", "list");
		let W = S(e, "div", "", "privacy-data-status");
		W.setAttribute("role", "status"), W.setAttribute("aria-live", "polite"), w.append(E, te, H, U, W, S(e, "p", "Tanınmayan localStorage alanları gösterilmez ve toplu temizlemede silinmez. Oturum, token, OAuth secret ve sunucu görev verileri bu merkezin kapsamı dışındadır.", "privacy-data-note")), a.append(s, w), i.append(a);
		let G = !1, K = !1, q = {
			usage: null,
			quota: null
		}, J = 0, Y = [], X = (e, t, n) => {
			e.addEventListener(t, n), Y.push(function() {
				e.removeEventListener(t, n);
			});
		}, Z = (e) => {
			W.textContent = c(e, 220);
		};
		function Q() {
			if (K) return;
			let t = f(n.localStorage);
			if (D.replaceChildren(S(e, "strong", p(t.knownBytes)), S(e, "span", "Bilinen veri")), O.replaceChildren(S(e, "strong", String(t.unknownKeys)), S(e, "span", "Tanınmayan alan")), k.replaceChildren(S(e, "strong", q.usage === null ? "—" : p(q.usage)), S(e, "span", q.quota === null ? "Tarayıcı kotası bilinmiyor" : "Depolama / " + p(q.quota))), A.textContent = "", q.usage !== null && q.quota > 0) {
				let e = q.usage / q.quota;
				e >= .9 ? A.textContent = "Depolama kotasının %90’ından fazlası kullanılıyor." : e >= .8 && (A.textContent = "Depolama kotasının %80’inden fazlası kullanılıyor.");
			}
			U.replaceChildren(), A.textContent && U.append(A);
			let r = c(R.value, 80).toLocaleLowerCase("tr-TR");
			[["data", "Kullanıcı verileri"], ["preference", "Tercihler"]].forEach(function(n) {
				U.append(S(e, "h3", n[1], "privacy-data-group-title")), t.surfaces.filter(function(e) {
					return e.group === n[0] && (!r || (e.label + " " + e.description).toLocaleLowerCase("tr-TR").includes(r)) && (!B.checked || e.present);
				}).sort(function(e, t) {
					return z.value === "size" ? t.bytes - e.bytes : e.label.localeCompare(t.label, "tr");
				}).forEach(function(t) {
					let n = S(e, "article", void 0, "privacy-data-row");
					n.dataset.privacySurface = t.id;
					let r = S(e, "div", void 0, "privacy-data-copy");
					r.append(S(e, "strong", t.label), S(e, "small", t.description)), r.append(S(e, "span", t.present ? String(t.keys) + " alan · " + p(t.bytes) : "Veri yok", "privacy-data-meta"));
					let i = S(e, "div", void 0, "privacy-data-row-actions"), a = C(e, t.present ? "Temizle" : "Boş");
					a.disabled = !t.present, a.dataset.privacyClear = t.id, a.setAttribute("aria-label", t.label + " yerel verisini temizle");
					let o = C(e, "Kopyala");
					o.disabled = !t.present, o.dataset.privacyCopySurface = t.id, o.setAttribute("aria-label", t.label + " özetini kopyala"), i.append(a, o), n.append(r, i), U.append(n);
				});
			}), t.unknownKeys && U.append(S(e, "div", String(t.unknownKeys) + " tanınmayan localStorage alanı kapsam dışında tutuldu.", "privacy-data-unknown")), J += 1;
		}
		async function $() {
			let e = ++J;
			q = await m(n), !K && e === J && Q();
		}
		async function ne() {
			return x(f(n.localStorage), q);
		}
		async function re() {
			let t = await ne();
			try {
				let r = new Blob([t], { type: "application/json;charset=utf-8" }), i = n.URL.createObjectURL(r), a = S(e, "a");
				a.href = i, a.download = "hafize-privacy-report.json", a.click(), n.setTimeout?.(function() {
					n.URL.revokeObjectURL(i);
				}, 0), Z("İçerik içermeyen gizlilik raporu oluşturuldu.");
			} catch {
				Z("Gizlilik raporu oluşturulamadı.");
			}
		}
		function ie(e) {
			let t = o.get(e);
			if (!t || !n.confirm?.(t.label + " yerel verisi silinsin mi? Bu işlem geri alınamaz.")) return;
			let r = g(e, n.localStorage);
			T(n, {
				action: "clear-surface",
				id: e,
				removed: r.removed
			}), Z(r.ok ? String(r.removed) + " alan temizlendi." : "Bazı yerel alanlar temizlenemedi."), Q(), $();
		}
		return X(j, "click", function() {
			Q(), $(), Z("Yerel veri özeti yenilendi.");
		}), X(R, "input", function() {
			Q();
		}), X(z, "change", function() {
			Q();
		}), X(B, "change", function() {
			Q();
		}), X(M, "click", function() {
			re();
		}), X(P, "click", async function() {
			try {
				await n.navigator?.clipboard?.writeText?.(b(f(n.localStorage), q)), Z("İçeriksiz yerel veri özeti panoya kopyalandı.");
			} catch {
				Z("Yerel veri özeti panoya kopyalanamadı.");
			}
		}), X(N, "click", async function() {
			try {
				let e = await ne();
				await n.navigator?.clipboard?.writeText?.(e), Z("İçerik içermeyen gizlilik raporu panoya kopyalandı.");
			} catch {
				Z("Gizlilik raporu panoya kopyalanamadı.");
			}
		}), X(I, "click", function() {
			if (!n.confirm?.("Tema, hareket, filtre ve diğer bilinen tercih verileri sıfırlansın mı? Kullanıcı verileri korunur.")) return;
			let e = _("preference", n.localStorage);
			T(n, {
				action: "clear-preferences",
				removed: e.removed
			}), Z(e.ok ? String(e.removed) + " tercih alanı sıfırlandı." : "Bazı tercih alanları sıfırlanamadı."), Q(), $();
		}), X(F, "click", function() {
			if (!n.confirm?.("Kullanıcı verisi yüzeyleri temizlensin mi? Tercihler korunur.")) return;
			let e = _("data", n.localStorage);
			T(n, {
				action: "clear-data-surfaces",
				removed: e.removed
			}), Z(e.ok ? String(e.removed) + " veri alanı temizlendi." : "Bazı veri alanları temizlenemedi."), Q(), $();
		}), X(L, "click", function() {
			if (!n.confirm?.("Bilinen tüm Hafize yerel verileri ve tercihleri temizlensin mi? Tanınmayan alanlar korunacaktır.")) return;
			let e = n.prompt?.("Onay için TEMIZLE yaz:");
			if (String(e || "").trim().toLocaleUpperCase("tr-TR") !== "TEMIZLE") return Z("Toplu temizleme iptal edildi.");
			let t = v(n.localStorage);
			T(n, {
				action: "clear-all-known",
				removed: t.removed
			}), Z(t.ok ? String(t.removed) + " bilinen alan temizlendi." : "Bazı alanlar temizlenemedi."), Q(), $();
		}), X(U, "click", function(e) {
			let t = e.target?.closest?.("[data-privacy-clear]");
			if (t) return ie(t.dataset.privacyClear);
			let r = e.target?.closest?.("[data-privacy-copy-surface]");
			if (!r) return;
			let i = f(n.localStorage).surfaces.find(function(e) {
				return e.id === r.dataset.privacyCopySurface;
			});
			i && n.navigator?.clipboard?.writeText?.(y(i)).then(function() {
				Z("Yüzey özeti panoya kopyalandı.");
			}).catch(function() {
				Z("Yüzey özeti panoya kopyalanamadı.");
			});
		}), X(n, "storage", function(e) {
			(e.key === null || u(e.key)) && (Q(), $());
		}), X(n, r, function() {
			Q(), $();
		}), X(e, "keydown", function(t) {
			(t.ctrlKey || t.metaKey) && t.shiftKey && t.key.toLowerCase() === "r" && (e.activeElement?.closest?.("input,textarea,select,button,[contenteditable=\"true\"]") || (t.preventDefault(), a.scrollIntoView({ block: "nearest" }), j.focus()));
		}), X(h, "click", function() {
			G = !G, w.hidden = G, h.textContent = G ? "Göster" : "Gizle", h.setAttribute("aria-expanded", String(!G));
		}), Q(), $(), Object.freeze({
			mounted: !0,
			inspect: function() {
				return f(n.localStorage);
			},
			clearSurface: function(e) {
				return g(e, n.localStorage);
			},
			clearDataSurfaces: function() {
				return _("data", n.localStorage);
			},
			clearPreferences: function() {
				return _("preference", n.localStorage);
			},
			clearAllKnown: function() {
				return v(n.localStorage);
			},
			privacyReport: function() {
				return x(f(n.localStorage), q);
			},
			destroy: function() {
				K = !0, Y.splice(0).forEach(function(e) {
					e();
				}), a.remove();
			}
		});
	}
	function T(e, t) {
		try {
			e.dispatchEvent?.(new CustomEvent(r, { detail: t }));
		} catch {}
	}
	e.HafizePrivacyCenter = Object.freeze({
		SURFACES: a,
		formatBytes: p,
		classifyKey: u,
		inspectStorage: f,
		storageEstimate: m,
		clearSurface: g,
		clearDataSurfaces: function(e) {
			return _("data", e);
		},
		clearPreferences: function(e) {
			return _("preference", e);
		},
		clearAllKnown: v,
		surfaceSummary: y,
		privacySummary: b,
		privacyReport: x,
		mount: w
	});
	let E = function() {
		e.document && w(e.document, e);
	};
	e.document?.readyState === "loading" ? e.document.addEventListener("DOMContentLoaded", E, { once: !0 }) : E();
})(typeof globalThis < "u" ? globalThis : self);
//#endregion

//# sourceMappingURL=settings-privacy.js.map