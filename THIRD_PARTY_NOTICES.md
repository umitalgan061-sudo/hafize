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
