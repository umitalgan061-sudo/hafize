//#region public/typed/ui-shell.ts
var e = "hafize.theme.v1", t = Object.freeze([
	"Pzt",
	"Sal",
	"Çar",
	"Per",
	"Cum",
	"Cmt",
	"Paz"
]);
function n(e, t) {
	return e === "light" || e === "dark" ? e : t ? "dark" : "light";
}
function r(e, t, n) {
	let r = (new Date(e, t, 1).getDay() + 6) % 7, i = new Date(e, t, 1 - r);
	return Object.freeze(Array.from({ length: 42 }, (e, r) => {
		let a = new Date(i);
		return a.setDate(i.getDate() + r), Object.freeze({
			day: a.getDate(),
			month: a.getMonth(),
			year: a.getFullYear(),
			outside: a.getMonth() !== t,
			selected: a.getMonth() === t && a.getDate() === n
		});
	}));
}
function i(e, t, n, r) {
	let i = new Date(e, t, n);
	if (Number.isNaN(i.getTime())) return null;
	switch (r) {
		case "ArrowLeft":
			i.setDate(i.getDate() - 1);
			break;
		case "ArrowRight":
			i.setDate(i.getDate() + 1);
			break;
		case "ArrowUp":
			i.setDate(i.getDate() - 7);
			break;
		case "ArrowDown":
			i.setDate(i.getDate() + 7);
			break;
		case "Home":
			i.setDate(1);
			break;
		case "End":
			i.setMonth(i.getMonth() + 1, 0);
			break;
		default: return null;
	}
	return Object.freeze({
		year: i.getFullYear(),
		month: i.getMonth(),
		day: i.getDate()
	});
}
function a(e, t, n, r) {
	return e.addEventListener(t, n, r), () => e.removeEventListener(t, n, r);
}
function o(e) {
	let t = e.querySelector("#sidebar"), n = e.querySelector("#sidebarToggle");
	if (!t || !n) return null;
	let r = t.classList.contains("open"), i = (e, i = !1) => {
		r = !!e, t.classList.toggle("open", r), n.setAttribute("aria-expanded", String(r)), n.setAttribute("aria-controls", t.id || "sidebar"), n.setAttribute("aria-label", r ? "Menüyü kapat" : "Menüyü aç"), i && n.focus();
	}, a = (e) => {
		e.preventDefault(), e.stopImmediatePropagation(), i(!r);
	}, o = (e) => {
		e.key === "Escape" && r && (e.preventDefault(), i(!1, !0));
	};
	return n.addEventListener("click", a, !0), e.addEventListener("keydown", o), i(r), Object.freeze({
		isOpen: () => r,
		close: () => i(!1),
		destroy() {
			n.removeEventListener("click", a, !0), e.removeEventListener("keydown", o);
		}
	});
}
function s(e) {
	let t = e.querySelector(".chat-stage"), n = e.querySelector("#messages");
	return n ? (t?.removeAttribute("aria-live"), n.setAttribute("role", "log"), n.setAttribute("aria-live", "polite"), n.setAttribute("aria-relevant", "additions text"), n.setAttribute("aria-atomic", "false"), n.setAttribute("aria-label", "Sohbet mesajları"), !0) : !1;
}
function c(t, c) {
	let l = t.documentElement;
	if (!l) return null;
	let u = [], d = o(t);
	d && u.push(d.destroy), s(t);
	let f = c.localStorage, p = c.matchMedia("(prefers-color-scheme: dark)"), m = n(f?.getItem(e), !!p.matches), h = t.querySelector("#themeToggle"), g = (e) => {
		m = e, l.dataset.theme = e, h?.setAttribute("aria-pressed", String(e === "dark")), h?.setAttribute("title", e === "dark" ? "Gündüz moduna geç" : "Gece moduna geç"), t.querySelector("meta[name=\"theme-color\"]")?.setAttribute("content", e === "dark" ? "#202122" : "#f7f5f0");
	};
	g(m), h && u.push(a(h, "click", () => {
		let t = m === "dark" ? "light" : "dark";
		try {
			f?.setItem(e, t);
		} catch {}
		g(t);
	})), u.push(a(p, "change", () => {
		f?.getItem(e) || g(n(null, p.matches));
	}));
	let _ = t.querySelector("#calendarMonth"), v = t.querySelector("#calendarGrid");
	_?.setAttribute("aria-live", "polite"), v?.setAttribute("aria-label", "Takvim günleri");
	let y = /* @__PURE__ */ new Date(), b = y.getDate(), x = (e = {}) => {
		if (!v || !_) return;
		_.textContent = new Intl.DateTimeFormat("tr-TR", {
			month: "long",
			year: "numeric"
		}).format(y);
		let n = r(y.getFullYear(), y.getMonth(), b);
		v.replaceChildren(...n.map((e) => {
			let n = t.createElement("button");
			return n.type = "button", n.className = `calendar-day${e.outside ? " outside" : ""}${e.selected ? " selected" : ""}`, n.textContent = String(e.day), n.tabIndex = e.selected ? 0 : -1, n.setAttribute("aria-label", `${e.day} ${e.month + 1} ${e.year}`), n.setAttribute("aria-pressed", String(e.selected)), n.addEventListener("click", () => {
				y = new Date(e.year, e.month, 1), b = e.day, x({ focusSelected: !0 });
			}), n.addEventListener("keydown", (t) => {
				let n = i(e.year, e.month, e.day, t.key);
				n && (t.preventDefault(), y = new Date(n.year, n.month, 1), b = n.day, x({ focusSelected: !0 }));
			}), n;
		})), e.focusSelected && v.querySelector("[aria-pressed=\"true\"]")?.focus();
	}, S = t.querySelector("#calendarPrev"), C = t.querySelector("#calendarNext");
	S && u.push(a(S, "click", () => {
		y = new Date(y.getFullYear(), y.getMonth() - 1, 1), b = 1, x({ focusSelected: !0 });
	})), C && u.push(a(C, "click", () => {
		y = new Date(y.getFullYear(), y.getMonth() + 1, 1), b = 1, x({ focusSelected: !0 });
	})), x();
	let w = t.querySelector("#micBtn"), T = t.querySelector("#voiceProxy"), E = t.querySelector(".voice-card");
	T && u.push(a(T, "click", () => w?.click()));
	let D = c.MutationObserver, O = w && D ? new D(() => {
		let e = w.getAttribute("aria-pressed") === "true";
		E?.classList.toggle("listening", e), T && (T.textContent = e ? "Dinlemeyi durdur" : "Dinlemek için dokun");
	}) : null;
	return O && w && O.observe(w, {
		attributes: !0,
		attributeFilter: ["aria-pressed"]
	}), Object.freeze({
		getTheme: () => m,
		renderCalendar: x,
		sidebarDisclosure: d,
		destroy() {
			O?.disconnect();
			for (let e of u.splice(0)) e();
		}
	});
}
var l = Object.freeze({
	THEME_KEY: e,
	WEEKDAYS: t,
	resolveTheme: n,
	createMonthCells: r,
	moveCalendarDate: i,
	installSidebarDisclosure: o,
	installChatAccessibility: s,
	install: c
});
if (globalThis.HafizeUiShell = l, typeof document < "u") {
	let e = () => c(document, globalThis);
	document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", e, { once: !0 }) : e();
}
//#endregion
export { t as WEEKDAYS, r as createMonthCells, c as install, s as installChatAccessibility, o as installSidebarDisclosure, i as moveCalendarDate, n as resolveTheme };

//# sourceMappingURL=ui-shell.js.map