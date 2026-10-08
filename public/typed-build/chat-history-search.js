//#region public/typed/chat-history-search.ts
(() => {
	let e = "hafize.conversations.v1", t = Object.freeze({
		key: "f",
		shift: !0
	}), n = {
		history: document.querySelector("#conversationList"),
		block: document.querySelector(".history-block")
	};
	if (!n.history || !n.block) return;
	function r() {
		try {
			let t = globalThis.localStorage?.getItem(e), n = JSON.parse(t || "[]");
			return Array.isArray(n) ? n : [];
		} catch {
			return [];
		}
	}
	function i(e) {
		return typeof e == "string" ? e.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim() : "";
	}
	function a(e) {
		let t = Array.isArray(e?.messages) ? e.messages : [];
		return i([
			e?.title,
			e?.agentId,
			...t.map((e) => e?.content)
		].filter((e) => typeof e == "string").join(" "));
	}
	function o() {
		let e = document.createElement("section");
		e.className = "history-search", e.setAttribute("aria-label", "Sohbet geçmişinde ara");
		let t = document.createElement("label");
		t.className = "history-search-label", t.htmlFor = "conversationSearchInput", t.textContent = "Sohbetlerde ara";
		let r = document.createElement("div");
		r.className = "history-search-row";
		let i = document.createElement("input");
		i.id = "conversationSearchInput", i.className = "history-search-input", i.type = "search", i.autocomplete = "off", i.spellcheck = !1, i.placeholder = "Başlık veya mesaj…", i.maxLength = 120, i.setAttribute("aria-describedby", "conversationSearchStatus");
		let a = document.createElement("button");
		a.type = "button", a.className = "history-search-clear", a.textContent = "×", a.setAttribute("aria-label", "Sohbet aramasını temizle"), a.hidden = !0, r.append(i, a);
		let o = document.createElement("div");
		return o.id = "conversationSearchStatus", o.className = "history-search-status", o.setAttribute("role", "status"), o.setAttribute("aria-live", "polite"), e.append(t, r, o), n.block.insertBefore(e, n.block.querySelector(".history-head")?.nextSibling || n.history), {
			section: e,
			input: i,
			clear: a,
			status: o
		};
	}
	let s = o(), c = "", l = !1;
	function u() {
		return Array.from(n.history.querySelectorAll(".conversation-row"));
	}
	function d() {
		let e = i(c), t = r(), o = u(), l = new Map(t.map((e) => [i(e?.title), e])), d = 0;
		for (let t of o) {
			let n = i(t.querySelector(".conversation-open")?.textContent || ""), r = l.get(n), o = r ? a(r) : n, s = !e || o.includes(e);
			t.hidden = !s, s && (d += 1);
		}
		let f = o.length;
		s.clear.hidden = !e, f ? e ? s.status.textContent = `${d} / ${f} sohbet eşleşti` : s.status.textContent = `${f} sohbet` : s.status.textContent = "Henüz sohbet yok.";
		let p = n.history.querySelector(".history-search-empty");
		e && f > 0 && d === 0 ? (p || (p = document.createElement("div"), p.className = "history-search-empty", p.setAttribute("role", "status"), n.history.append(p)), p.textContent = "Aramanla eşleşen sohbet bulunamadı.") : p?.remove();
	}
	function f() {
		l || (l = !0, requestAnimationFrame(() => {
			l = !1, d();
		}));
	}
	s.input.addEventListener("input", () => {
		c = s.input.value, f();
	}), s.input.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			if (!s.input.value) return;
			e.preventDefault(), s.input.value = "", c = "", f();
		}
	}), s.clear.addEventListener("click", () => {
		s.input.value = "", c = "", f(), s.input.focus();
	}), document.addEventListener("keydown", (e) => {
		let n = e.target;
		(e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLocaleLowerCase() === t.key && t.shift && (n && [
			"INPUT",
			"TEXTAREA",
			"SELECT"
		].includes(n.tagName) && n !== s.input || (e.preventDefault(), s.input.focus(), s.input.select()));
	}), new MutationObserver(f).observe(n.history, {
		childList: !0,
		subtree: !0
	}), window.addEventListener("storage", (t) => {
		t.key === e && f();
	}), d();
})();
//#endregion

//# sourceMappingURL=chat-history-search.js.map