# Conversational accuracy

Immediately silence old playback when a distinct finalized phrase is recognized, without submitting incomplete speech. Ordered echo matching replaces bag-of-words similarity; actual playback progress supplies echo reference instead of queued future text. Allow longer pauses after conjunctions, reset desktop endpoint timer when speech resumes, and avoid automatically submitting provisional-only transcripts. Manual end remains available. Microphone permissions, foreground lifecycle and single browser recognizer retained. This is not real acoustic AEC or an independent ASR engine; device support and actual accuracy must be verified on hardware. PWA v191.

Fuzzy echo matching is limited to a one-character typo in one long word; a different meaningful word is not treated as an echo. If trailing speech remains provisional, retry instead of silently submitting a truncated request.
