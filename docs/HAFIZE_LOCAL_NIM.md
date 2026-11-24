# Local NVIDIA NIM (V14)

Hafize's existing local provider now accepts either Ollama (default) or NVIDIA NIM text chat. Local requests never fall back silently to cloud and never forward the NVIDIA catalog key. The local service must run on the **same machine/network namespace as Hafize backend**. Firebase/Render cannot reach the Windows loopback. This does not install all NVIDIA models, specialist services, or Blueprints.

## Windows preflight and deployment

From the repository folder in PowerShell:

```powershell
.\scripts\hafize-local-nim.ps1 -Action Check
.\scripts\hafize-local-nim.ps1 -Action Deploy -StartHafize
````

Requires supported NVIDIA driver/GPU, Docker Desktop Linux engine (WSL2), storage and a compatible NVIDIA model profile. Default image is NVIDIA's documented 2.1.6 Llama 3.1 8B example; the operator may override -Image, -Model, -Port and -Name for a supported deployment. If gated, set NGC_API_KEY or HF_TOKEN in the local process environment; never commit or paste credentials into chat. Docker image downloads may consume significant disk space and network traffic. The script does not delete existing containers and does not expose the NIM port beyond loopback. It verifies real readiness, model discovery and text inference before launching Hafize. It does not bypass model license/VRAM requirements. Run Verify with -StartHafize after a restart.

## Existing NIM deployment

Set these in the local Hafize server process (not Firebase):

```text
HAFIZE_LOCAL_MODEL_ENABLED=true
HAFIZE_LOCAL_MODEL_PROTOCOL=nim
HAFIZE_LOCAL_MODEL_BASE_URL=http://127.0.0.1:8000/v1
````

Use the existing local provider with a model ID returned by /api/models?provider=local. Local text inference uses /v1/chat/completions; tool execution, streaming tokens, multimodal input, remote GPU bridges and specialist NIM deployment are not added by this release. Existing ASR/TTS/parse configuration is independent. Cloud chat and Ollama behavior remain default unless explicitly configured. For GPU/profile compatibility consult NVIDIA's support matrix. A successful mock test is not a real hardware pass.

Official quickstart: https://docs.nvidia.com/nim/large-language-models/2.1.6/get-started/quickstart
