//#region public/typed/scheduled-tasks.ts
(function(e) {
	let t = "/api/schedules", n = "scheduledTasksWorkspace", r = null, i = !1, a = 0, o = null, s = "all", c = null, l = () => e.document, u = (e, t, n) => {
		let r = l().createElement(e);
		return n && (r.className = n), t !== void 0 && (r.textContent = String(t)), r;
	}, d = (e, t, n = "soft-btn") => {
		let r = u("button", e, n);
		return r.type = "button", t && (r.dataset.taskAction = t), r;
	}, f = (e, t) => String(e ?? "").slice(0, t), p = (e) => ({
		scheduled: "Planlandı",
		running: "Çalışıyor",
		completed: "Tamamlandı",
		failed: "Başarısız",
		cancelled: "İptal edildi"
	})[e] || "Bilinmiyor", m = async (e) => {
		try {
			return await e.json();
		} catch {
			return null;
		}
	};
	async function h(n = t, r = {}) {
		c?.abort?.(), c = typeof AbortController == "function" ? new AbortController() : null;
		let i = {
			Accept: "application/json",
			...r.body ? { "Content-Type": "application/json" } : {},
			...r.headers || {}
		}, a = await e.fetch(n, {
			...r,
			credentials: "same-origin",
			headers: i,
			signal: c?.signal
		}), o = await m(a);
		if (!a.ok) {
			let e = Error(o?.code || o?.error || `HTTP_${a.status}`);
			throw e.status = a.status, e.payload = o, e;
		}
		return o || {};
	}
	function g() {
		let e = l().getElementById("agentSelect");
		return e ? [...e.options].filter((e) => e.value).map((e) => ({
			id: e.value,
			label: e.textContent?.trim() || e.value
		})) : [];
	}
	function _(e = 5) {
		let t = new Date(Date.now() + e * 6e4), n = (e) => String(e).padStart(2, "0");
		return `${t.getFullYear()}-${n(t.getMonth() + 1)}-${n(t.getDate())}T${n(t.getHours())}:${n(t.getMinutes())}`;
	}
	function v(e) {
		let t = new Date(e);
		return Number.isNaN(t.getTime()) ? "" : t.toISOString();
	}
	function y(e) {
		let t = Date.parse(e || "");
		return Number.isFinite(t) ? new Intl.DateTimeFormat("tr-TR", {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(new Date(t)) : "Tarih bilinmiyor";
	}
	function b(e, t = "") {
		let n = r?.querySelector(".scheduled-tasks-status");
		n && (n.textContent = f(e, 220), n.dataset.tone = t);
	}
	function x() {
		r = u("section", void 0, "scheduled-tasks-overlay"), r.id = n, r.hidden = !0, r.setAttribute("role", "dialog"), r.setAttribute("aria-modal", "true"), r.setAttribute("aria-labelledby", "scheduledTasksTitle");
		let e = u("div", void 0, "scheduled-tasks-shell"), i = u("div", void 0, "scheduled-tasks-head"), a = u("strong", "Zamanlanmış görevler", "scheduled-tasks-title");
		a.id = "scheduledTasksTitle", i.append(a, d("Yenile", "refresh", "mini-btn"), d("Kapat", "close", "mini-btn"));
		let o = u("form", void 0, "scheduled-tasks-create");
		o.noValidate = !0;
		let c = u("div", "Yeni görev planla", "scheduled-tasks-section-title"), f = u("label", "Ajan"), p = l().createElement("select");
		if (p.id = "scheduledTaskAgent", p.required = !0, p.setAttribute("aria-label", "Zamanlanmış görev ajanı"), g().forEach((e) => {
			let t = u("option", e.label);
			t.value = e.id, p.append(t);
		}), !p.options.length) {
			let e = u("option", "Ajanlar yükleniyor");
			e.value = "", p.append(e), p.disabled = !0;
		}
		f.append(p);
		let m = u("label", "Görev metni"), y = l().createElement("textarea");
		y.rows = 5, y.maxLength = 2e4, y.required = !0, y.placeholder = "Örn. Bugünkü önemli gelişmeleri özetle ve takip edilmesi gereken noktaları çıkar.", y.setAttribute("aria-label", "Zamanlanacak görev metni"), m.append(y);
		let x = u("label", "Çalıştırma zamanı"), S = l().createElement("input");
		S.type = "datetime-local", S.required = !0, S.value = _(), S.min = _(), x.append(S);
		let T = u("label", "Maksimum deneme"), D = l().createElement("select");
		D.setAttribute("aria-label", "Maksimum deneme sayısı");
		for (let e = 1; e <= 5; e += 1) {
			let t = u("option", e);
			t.value = String(e), D.append(t);
		}
		T.append(D);
		let k = u("div", void 0, "scheduled-tasks-form-grid");
		k.append(f, x, T);
		let A = d("Görevi planla", "create");
		A.classList.add("primary"), o.append(c, m, k, A);
		let j = u("section", void 0, "scheduled-tasks-list-section");
		j.setAttribute("aria-label", "Planlanmış görevler listesi"), j.append(u("div", "Planlanan görevler", "scheduled-tasks-section-title"));
		let M = u("div", void 0, "scheduled-tasks-filter"), N = l().createElement("select");
		N.setAttribute("aria-label", "Görev durumuna göre filtrele"), [
			["all", "Tümü"],
			["scheduled", "Planlandı"],
			["running", "Çalışıyor"],
			["completed", "Tamamlandı"],
			["failed", "Başarısız"],
			["cancelled", "İptal edildi"]
		].forEach(([e, t]) => {
			let n = u("option", t);
			n.value = e, N.append(n);
		});
		let P = u("span", "", "scheduled-tasks-filter-info");
		M.append(N, P);
		let F = u("div", void 0, "scheduled-tasks-list");
		F.setAttribute("role", "list"), j.append(M, F);
		let I = u("div", "", "scheduled-tasks-status");
		I.setAttribute("role", "status"), I.setAttribute("aria-live", "polite"), e.append(i, o, I, j), r.append(e), l().body.append(r), o.addEventListener("submit", async (e) => {
			e.preventDefault();
			let n = y.value.trim(), r = v(S.value);
			if (!p.value) return b("Geçerli bir ajan seçmelisin.", "error");
			if (!n) return b("Görev metni boş olamaz.", "error");
			if (!r || Date.parse(r) <= Date.now()) return b("Çalıştırma zamanı gelecekte olmalı.", "error");
			A.disabled = !0;
			try {
				await h(t, {
					method: "POST",
					body: JSON.stringify({
						agentId: p.value,
						task: n,
						runAt: r,
						maxAttempts: Number(D.value)
					})
				}), y.value = "", S.value = _(), b("Görev planlandı.", "success"), await w();
			} catch (e) {
				b(e.status === 401 ? "Oturum açılması gerekiyor." : e.message === "SCHEDULE_CAPACITY_REACHED" ? "Görev kapasitesi dolu." : "Görev planlanamadı.", "error");
			} finally {
				A.disabled = !1;
			}
		}), N.addEventListener("change", () => {
			s = N.value, C(F, P);
		}), r.addEventListener("click", E), r.addEventListener("keydown", (e) => {
			e.key === "Escape" && (e.preventDefault(), O());
		}), r.addEventListener("click", (e) => {
			e.target === r && O();
		});
	}
	function S(e) {
		let t = u("article", void 0, "scheduled-task-row");
		t.dataset.scheduleId = f(e.scheduleId, 120), t.dataset.status = e.status, t.dataset.runAt = f(e.runAt, 40), t.dataset.agentId = f(e.agentId, 120), t.dataset.maxAttempts = String(Math.max(1, Math.min(5, Number(e.maxAttempts) || 1))), t.setAttribute("role", "listitem");
		let n = u("div", void 0, "scheduled-task-row-head"), r = u("strong", f(e.task, 120)), i = u("span", p(e.status), `scheduled-task-status status-${e.status}`);
		n.append(r, i);
		let a = u("div", `${y(e.runAt)} · ${f(e.agentId, 80)} · deneme ${e.attempts}/${e.maxAttempts}`, "scheduled-task-meta"), o = u("p", e.lastError ? `Son hata: ${f(e.lastError, 120)}` : e.status === "completed" ? "Başarıyla tamamlandı." : ""), s = u("div", void 0, "scheduled-task-actions");
		e.status === "scheduled" && s.append(d("İptal et", "cancel", "mini-btn"));
		let c = d("Trace ID", "trace", "mini-btn");
		return c.title = f(e.traceId, 128), c.setAttribute("aria-label", `Trace ID: ${f(e.traceId, 40)}`), s.append(c), t.append(n, a, o, s), t;
	}
	function C(e, t) {
		let n = 0;
		[...e.children].forEach((e) => {
			if (!e.classList.contains("scheduled-task-row")) return;
			let t = s === "all" || e.dataset.status === s;
			e.hidden = !t, t && (n += 1);
		}), t.textContent = `${n} görev gösteriliyor.`;
	}
	async function w() {
		let e = r?.querySelector(".scheduled-tasks-list"), n = r?.querySelector(".scheduled-tasks-filter-info");
		if (e) {
			e.replaceChildren(u("div", "Görevler yükleniyor…", "scheduled-tasks-empty"));
			try {
				let r = await h(t), i = Array.isArray(r.schedules) ? r.schedules.slice(0, 128) : [];
				i.sort((e, t) => String(e.runAt).localeCompare(String(t.runAt)) || String(e.scheduleId).localeCompare(String(t.scheduleId))), e.replaceChildren(), i.length ? i.forEach((t) => e.append(S(t))) : e.append(u("div", "Henüz planlanmış görev yok.", "scheduled-tasks-empty")), C(e, n);
			} catch (t) {
				e.replaceChildren(u("div", t.status === 401 ? "Görevleri görmek için oturum açmalısın." : "Görev listesi yüklenemedi.", "scheduled-tasks-empty")), b(t.status === 401 ? "Kimlik doğrulama gerekli." : "Görev servisine ulaşılamadı.", "error");
			}
		}
	}
	async function T(n) {
		if (n && e.confirm?.("Bu planlanmış görev iptal edilsin mi?")) try {
			await h(`${t}/${encodeURIComponent(n)}`, { method: "DELETE" }), b("Görev iptal edildi.", "success"), await w();
		} catch (e) {
			b(e.message === "SCHEDULE_NOT_CANCELLABLE" ? "Görev artık iptal edilemez." : "Görev iptal edilemedi.", "error"), await w();
		}
	}
	function E(e) {
		let t = e.target?.closest?.("[data-task-action]");
		if (!t) return;
		let n = t.dataset.taskAction;
		if (n === "close") return O();
		if (n === "refresh") return w();
		if (n === "cancel") return T(t.closest(".scheduled-task-row")?.dataset.scheduleId);
		if (n === "trace") return b(`Trace ID: ${t.title}`, "info");
	}
	function D() {
		if (!r) return;
		o = l().activeElement, r.hidden = !1, s = "all";
		let t = r.querySelector(".scheduled-tasks-filter select");
		t && (t.value = "all"), w(), clearInterval(a), a = e.setInterval?.(w, 3e4) || 0, r.querySelector("[data-task-action=\"close\"]")?.focus();
	}
	function O() {
		r && (r.hidden = !0, clearInterval(a), a = 0, c?.abort?.(), o?.focus?.(), o = null);
	}
	function k() {
		if (i || !l()) return;
		let e = [...l().querySelectorAll(".nav-item")].find((e) => e.textContent?.includes("Görevler"));
		e && (x(), e.disabled = !1, e.addEventListener("click", D), e.setAttribute("aria-controls", n), e.setAttribute("aria-expanded", "false"), i = !0);
	}
	e.ScheduledTasksWorkspace = Object.freeze({
		open: D,
		close: O,
		refresh: w,
		request: h
	}), l()?.readyState === "loading" ? l().addEventListener("DOMContentLoaded", k, { once: !0 }) : k();
})(typeof globalThis < "u" ? globalThis : self);
//#endregion

//# sourceMappingURL=scheduled-tasks.js.map