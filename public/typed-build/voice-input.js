//#region public/typed/voice-input.ts
var e = "tr-TR";
function t(e) {
	let t = e;
	return t.SpeechRecognition || t.webkitSpeechRecognition || null;
}
function n(e) {
	return typeof e == "string" ? e.replace(/\s+/g, " ").trim() : "";
}
function r(e, t, r = 12e3) {
	let i = typeof e == "string" ? e.replace(/\s+$/g, "") : "", a = n(t), o = i && a ? `${i} ${a}` : i || a, s = Number.isInteger(r) && r > 0 ? r : 12e3;
	return o.slice(0, s);
}
function i(e) {
	if (!e?.results) return "";
	let t = [], r = Number.isInteger(e.resultIndex) ? e.resultIndex : 0;
	for (let n = r; n < e.results.length; n++) {
		let r = e.results[n]?.[0];
		typeof r?.transcript == "string" && t.push(r.transcript);
	}
	return n(t.join(" "));
}
function a(e) {
	switch (e) {
		case "not-allowed":
		case "service-not-allowed": return "Mikrofon izni verilmedi. Tarayıcı izinlerinden mikrofon erişimini kontrol edebilirsin.";
		case "audio-capture": return "Kullanılabilir bir mikrofon bulunamadı.";
		case "no-speech": return "Ses algılanmadı. Mikrofonu tekrar deneyebilirsin.";
		case "network": return "Tarayıcının ses tanıma servisine ulaşılamadı.";
		case "aborted": return "";
		default: return "Sesli giriş tamamlanamadı. Yazmaya devam edebilirsin.";
	}
}
function o(n, o) {
	let s = n.querySelector("#micBtn"), c = n.querySelector("#messageInput");
	if (!s || !c) return null;
	let l = n.querySelector("#toast"), u = t(o), d = null, f = !1, p = "", m = null, h = (e) => {
		l && e && (l.textContent = e, l.classList.remove("hidden"), m && clearTimeout(m), m = setTimeout(() => l.classList.add("hidden"), 4200));
	}, g = () => {
		s.disabled = c.disabled, s.setAttribute("aria-pressed", String(f)), s.setAttribute("aria-label", u ? f ? "Sesli girişi durdur" : "Sesli giriş" : "Sesli giriş bu tarayıcıda desteklenmiyor"), s.textContent = f ? "●" : "◉";
	}, _ = () => {
		if (d && f) try {
			d.stop();
		} catch {
			f = !1, d = null, g();
		}
	}, v = () => {
		if (!(!u || c.disabled || f)) {
			p = c.value || "", d = new u(), d.lang = n.documentElement.lang || o.navigator.language || e, d.interimResults = !0, d.continuous = !1, d.maxAlternatives = 1, d.onstart = () => {
				f = !0, g(), h("Dinleniyor… Ses metne dönüştürülür; otomatik gönderim yapılmaz.");
			}, d.onresult = (e) => {
				let t = i(e);
				t && (c.value = r(p, t, c.maxLength || 12e3), c.dispatchEvent(new Event("input", { bubbles: !0 })));
			}, d.onerror = (e) => {
				let t = a(e.error);
				t && h(t);
			}, d.onend = () => {
				d = null, f = !1, g(), n.hidden || c.focus();
			};
			try {
				d.start();
			} catch {
				d = null, f = !1, g(), h("Sesli giriş başlatılamadı.");
			}
		}
	}, y = (e) => {
		if (e.preventDefault(), e.stopImmediatePropagation(), !u) return h("Bu tarayıcı konuşma tanımayı desteklemiyor.");
		c.disabled || (f ? _() : v());
	}, b = () => {
		if (n.hidden && f) try {
			d?.abort();
		} catch {}
	};
	s.addEventListener("click", y, !0), n.addEventListener("visibilitychange", b);
	let x = new MutationObserver(() => {
		c.disabled && f && _(), g();
	});
	return x.observe(c, {
		attributes: !0,
		attributeFilter: ["disabled"]
	}), g(), Object.freeze({
		isSupported: !!u,
		isListening: () => f,
		start: v,
		stop: _,
		destroy() {
			x.disconnect(), m && clearTimeout(m);
			try {
				d?.abort();
			} catch {}
			d = null, f = !1, s.removeEventListener("click", y, !0), n.removeEventListener("visibilitychange", b);
		}
	});
}
var s = Object.freeze({
	DEFAULT_LANGUAGE: e,
	getSpeechRecognitionConstructor: t,
	installVoiceInput: o,
	mapSpeechError: a,
	mergeTranscript: r,
	normalizeTranscript: n,
	readRecognitionText: i
});
if (globalThis.HafizeVoiceInput = s, typeof document < "u") {
	let e = () => o(document, globalThis);
	document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", e, { once: !0 }) : e();
}
//#endregion
export { t as getSpeechRecognitionConstructor, o as installVoiceInput, a as mapSpeechError, r as mergeTranscript, n as normalizeTranscript, i as readRecognitionText };

//# sourceMappingURL=voice-input.js.map