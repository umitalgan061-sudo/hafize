# Third-Party Notices

## Agency Agents

Hafize'nin seçici ajan rol tasarımında aşağıdaki açık kaynak projeden uyarlanmış fikirler ve ajan tanımı örüntüleri kullanılmaktadır:

- Project: `msitarzewski/agency-agents`
- License: MIT
- Copyright (c) 2025 AgentLand Contributors

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Piper voices (optional, downloaded on request)

`public/vendor/piper-phonemize/` holds the browser build of the Piper phonemizer from the npm package
`piper-tts-web` 1.1.2 (MIT, Poket-Jony). It bundles `piper-phonemize` and the `espeak-ng` data, and espeak-ng is
licensed under GPL-3.0-or-later: anyone distributing Hafize with these files must meet that license.
Voice models are not part of this repository. They are downloaded from `rhasspy/piper-voices` on Hugging Face
only when the user asks for one, and each voice has its own license on its model card.
The ONNX runtime is `onnxruntime-web` (MIT, Microsoft).

Three Turkish voices come from community repositories on Hugging Face, each pinned to one commit in
`public/piper-voices.json`: `speaches-ai/piper-tr_TR-fahrettin-medium`, `speaches-ai/piper-tr_TR-fettah-medium` and
`99eren99/piper-turkish-tts`. None of them states a license, so their terms of use are unknown; they are
only downloaded on the user's request and are labelled as community voices in Settings.

## qrcode-generator

Copyright (c) 2009 Kazuhiko Arase. MIT License. Used to draw the install QR code on the Settings page.


## Zerre Türkçe TTS (isteğe bağlı)

Model, sözlük ve referans fonemleyici: [erkinemreta1/zerre-tts](https://github.com/erkinemreta1/zerre-tts/tree/cf3cdfaaa54a9e8ec541081bb5c2e97c3d563db4), Apache-2.0. Model dosyaları yalnızca kullanıcı indirme seçtiğinde alınır; ses metni cihazda işlenir. SES-A ve SES-B nötr etiketlerdir. Upstream eğitim verisi lisans ve kişilik haklarının bağımsız doğrulanmadığını bildirir; ticari kullanım öncesinde ayrıca değerlendirme gerekir. [Model kartı](https://huggingface.co/erkint/zerre-tts), [veri kaynakları](https://github.com/erkinemreta1/zerre-tts/blob/cf3cdfaaa54a9e8ec541081bb5c2e97c3d563db4/docs/data_sources.md).
