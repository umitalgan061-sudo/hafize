"""CPU LoRA pilot. Run from the repository root with the workflow's dependencies."""
import json
import os
import random
from pathlib import Path
import torch
from huggingface_hub import model_info
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

torch.manual_seed(42)
torch.set_num_threads(min(4, os.cpu_count() or 1))
rng = random.Random(42)
base = "Qwen/Qwen2.5-0.5B-Instruct"
revision = model_info(base).sha
tok = AutoTokenizer.from_pretrained(base, revision=revision)
net = AutoModelForCausalLM.from_pretrained(base, revision=revision, use_safetensors=True)
net.config.use_cache = False
net = get_peft_model(net, LoraConfig(r=8, lora_alpha=16, target_modules=["q_proj","v_proj"], task_type="CAUSAL_LM", revision=revision))
data = json.loads(Path("evals/turkish-response-training.json").read_text())
def example(row):
    question, answer = row
    chat = [{"role":"system","content":"Sen Hafize’sin. Türkçe ve açık yanıt ver."},{"role":"user","content":question}]
    prompt = tok.apply_chat_template(chat, tokenize=True, add_generation_prompt=True)
    full = tok.apply_chat_template(chat+[{"role":"assistant","content":answer}],tokenize=True)
    assert full[:len(prompt)] == prompt
    labels = [-100]*len(prompt) + full[len(prompt):]
    return torch.tensor([full]),torch.tensor([labels])
train = [example(row) for row in data["train"]]
test = [example(row) for row in data["test"]]
@torch.no_grad()
def evaluate():
    net.eval()
    total = count = 0
    for ids, labels in test:
        n = int((labels!=-100).sum())
        total += net(ids, labels=labels).loss.item()*n
        count += n
    return total/count
before = evaluate()
opt = torch.optim.AdamW((p for p in net.parameters() if p.requires_grad), lr=0.0002)
net.train()
for epoch in range(2):
    rng.shuffle(train)
    for ids,labels in train:
        opt.zero_grad()
        net(ids, labels=labels).loss.backward()
        torch.nn.utils.clip_grad_norm_(net.parameters(),1)
        opt.step()
    print("epoch",epoch+1,flush=True)
after = evaluate()
out = Path("hafize-tr-adapter")
net.save_pretrained(out, safe_serialization=True)
tok.save_pretrained(out)
report = dict(base=base,revision=revision,train=len(train),test=len(test),epochs=2,seed=42,
              heldout_answer_token_loss_before=before,heldout_answer_token_loss_after=after)
(out/"evaluation.json").write_text(json.dumps(report,indent=2))
print("HAFIZE_LORA_RESULT",json.dumps(report),flush=True)
