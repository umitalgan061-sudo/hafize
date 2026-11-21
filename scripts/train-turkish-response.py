"""Continue the Turkish response adapter and compare generated answers on held-out prompts."""
import argparse
import json
import os
import random
from collections import Counter
from pathlib import Path

import torch
from peft import LoraConfig, PeftModel, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE = "Qwen/Qwen2.5-0.5B-Instruct"
REVISION = "7ae557604adf67be50417f59c2c2f167def9a775"
SYSTEM = "Sen Hafize’sin. Türkçe ve açık yanıt ver."


def messages(question):
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]


def encode(tok, row):
    question, answer = row
    chat = messages(question)
    prompt = tok.apply_chat_template(chat, tokenize=True, add_generation_prompt=True)
    full = tok.apply_chat_template(chat + [{"role": "assistant", "content": answer}], tokenize=True)
    assert full[:len(prompt)] == prompt
    labels = [-100] * len(prompt) + full[len(prompt):]
    return torch.tensor([full]), torch.tensor([labels])


@torch.inference_mode()
def answer_loss(net, test):
    net.eval()
    total = count = 0
    for ids, labels in test:
        n = int((labels != -100).sum())
        total += net(ids, labels=labels).loss.item() * n
        count += n
    return total / count


def normalized(answer):
    return answer.strip().replace("I", "ı").replace("İ", "i").lower().rstrip(" .!?")


@torch.inference_mode()
def generate_answers(net, tok, cases):
    net.eval()
    results = []
    for case in cases:
        ids = tok.apply_chat_template(messages(case["question"]), tokenize=True,
                                      add_generation_prompt=True, return_tensors="pt")
        output = net.generate(ids, attention_mask=torch.ones_like(ids), do_sample=False,
                              max_new_tokens=40, use_cache=True, pad_token_id=tok.eos_token_id)
        reply = tok.decode(output[0, ids.shape[1]:], skip_special_tokens=True).strip()
        results.append({"reply": reply, "correct": normalized(reply) == normalized(case["answer"])})
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prior", type=Path, help="Continue from a saved PEFT adapter")
    args = parser.parse_args()
    torch.manual_seed(42)
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    rng = random.Random(42)
    tok = AutoTokenizer.from_pretrained(BASE, revision=REVISION)
    base = AutoModelForCausalLM.from_pretrained(BASE, revision=REVISION, use_safetensors=True)
    base.config.use_cache = False
    if args.prior:
        net = PeftModel.from_pretrained(base, str(args.prior), is_trainable=True)
    else:
        net = get_peft_model(base, LoraConfig(r=8, lora_alpha=16, target_modules=["q_proj", "v_proj"],
                                              task_type="CAUSAL_LM", revision=REVISION))
    data = json.loads(Path("evals/turkish-response-training.json").read_text())
    cases = json.loads(Path("evals/turkish-generated-answers.json").read_text())
    train = [encode(tok, row) for row in data["train"]]
    test = [encode(tok, row) for row in data["test"]]
    seen = {q for q, _ in data["train"]}
    assert seen.isdisjoint(row[0] for row in data["test"])
    assert seen.isdisjoint(case["question"] for case in cases)

    before = answer_loss(net, test)
    answers_before = generate_answers(net, tok, cases)
    opt = torch.optim.AdamW((p for p in net.parameters() if p.requires_grad), lr=0.0002)
    net.train()
    for epoch in range(2):
        rng.shuffle(train)
        for ids, labels in train:
            opt.zero_grad()
            net(ids, labels=labels).loss.backward()
            torch.nn.utils.clip_grad_norm_(net.parameters(), 1)
            opt.step()
        print("epoch", epoch + 1, flush=True)

    after = answer_loss(net, test)
    answers_after = generate_answers(net, tok, cases)
    scores = {label: dict(Counter(c["category"] for c, a in zip(cases, answers) if a["correct"]))
              for label, answers in (("before", answers_before), ("after", answers_after))}
    summary = dict(base=BASE, revision=REVISION, continued_from_prior=bool(args.prior),
                   train=len(train), test=len(test), epochs=2, seed=42,
                   heldout_answer_token_loss_before=before, heldout_answer_token_loss_after=after,
                   generation_total=len(cases), correct_before=sum(scores["before"].values()),
                   correct_after=sum(scores["after"].values()), correct_by_category=scores)
    out = Path("hafize-tr-adapter")
    net.save_pretrained(out, safe_serialization=True)
    tok.save_pretrained(out)
    details = [dict(c, before=b, after=a) for c, b, a in zip(cases, answers_before, answers_after)]
    (out / "evaluation.json").write_text(json.dumps(dict(summary, cases=details), indent=2, ensure_ascii=False))
    print("HAFIZE_LORA_RESULT", json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
