"""Contratos HTTP de descoberta, roteiro, síntese."""
import base64
import json
import re
from urllib.parse import quote

import requests


EXPERIENTIAL = "https://api.experientiallabs.ai/v1"
ELEVEN = "https://api.elevenlabs.io"


def call(method, url, headers, **kw):
    try:
        response = requests.request(method, url, headers=headers, timeout=(12, 160), allow_redirects=False, **kw)
    except requests.RequestException:
        raise ValueError("Conexão interrompida. Verifique a internet e o painel do provedor.") from None
    if not response.ok or response.is_redirect:
        advice = {401:"Chave inválida ou expirada.",403:"Confira as permissões da chave e o acesso ao modelo.",429:"Limite de uso ou saldo insuficiente."}
        try:
            data = response.json()
            detail = data.get("code") or data.get("error", {}).get("code") or data.get("detail", {}).get("status")
        except (ValueError, AttributeError):
            detail = None
        code = detail if isinstance(detail,str) and re.fullmatch(r"[\w.-]{1,75}",detail) else ""
        raise ValueError(f"API HTTP {response.status_code} {code}. {advice.get(response.status_code,'Confira o modelo e a disponibilidade no provedor.')}")
    return response.json()


def catalog_experiential(key):
    data = call("GET", EXPERIENTIAL+"/models", {"Authorization":"Bearer "+key})
    rows = data.get("data") if isinstance(data,dict) else None
    if not isinstance(rows,list):
        raise ValueError("O gateway devolveu um catálogo incompatível.")
    models = {row["id"] for row in rows if isinstance(row,dict) and isinstance(row.get("id"),str) and row["id"].strip()}
    return {"text":sorted(models,key=lambda model:(not model.endswith(":free"),model.casefold()))}


VOICE_PROFILES_PT = {
    # Vozes otimizadas para Shorts / Vídeos Curtos em Português Brasileiro
    "CwhRBWXzGAHq8TQ4Fs17": {"name": "🇧🇷 Roger — Descontraído e Natural (Masculino)", "priority": 1},
    "hpp4J3VqNfWAUOO0d1Us": {"name": "🇧🇷 Bella — Clara, Brilhante e Expressiva (Feminino)", "priority": 2},
    "TX3LPaxmHKxFdv7VOQHJ": {"name": "🇧🇷 Liam — Criador de Conteúdo, Dinâmico e Enérgico (Masculino)", "priority": 3},
    "FGY2WhTYpPnrIDTdsKH5": {"name": "🇧🇷 Laura — Entusiasta e Dinâmica (Feminino)", "priority": 4},
    "IKne3meq5aSn9XLyUdCD": {"name": "🇧🇷 Charlie — Voz Grave e Marcante (Masculino)", "priority": 5},
    "JBFqnCBsd6RMkjVDRZzb": {"name": "🇧🇷 George — Narrador Cativante e Caloroso (Masculino)", "priority": 6},
    "EXAVITQu4vr4xnSDxMaL": {"name": "🇧🇷 Sarah — Confiante e Madura (Feminino)", "priority": 7},
    "bIHbv24MWmeRgasZH58o": {"name": "🇧🇷 Will — Otimista e Amigável (Masculino)", "priority": 8},
    "nPczCjzI2devNBz1zQrb": {"name": "🇧🇷 Brian — Grave e Acolhedor (Masculino)", "priority": 9},
    "iP95p4xoKVk53GoZ742B": {"name": "🇧🇷 Chris — Carismático e Espontâneo (Masculino)", "priority": 10},
    "cjVigY5qzO86Huf0OWal": {"name": "🇧🇷 Eric — Seguro e Confiável (Masculino)", "priority": 11},
    "Xb7hH8MSUJpSbSDYk0k2": {"name": "🇧🇷 Alice — Educativa e Didática (Feminino)", "priority": 12},
    "cgSgspJ2msm6clMCkdW9": {"name": "🇧🇷 Jessica — Espontânea e Jovem (Feminino)", "priority": 13},
    "onwK4e9ZLuTAKqWW03F9": {"name": "🇧🇷 Daniel — Apresentador Tradicional (Masculino)", "priority": 14},
    "pFZP5JQG7iQjIQuC4Bku": {"name": "🇧🇷 Lily — Suave e Aveludada (Feminino)", "priority": 15},
    "pNInz6obpgDQGcFmaJgB": {"name": "🇧🇷 Adam — Firme e Autoritário (Masculino)", "priority": 16},
    "pqHfZKP75CvOlQylNhV4": {"name": "🇧🇷 Bill — Sábio e Equilibrado (Masculino)", "priority": 17},
    "SAz9YHcvj6GT2YYXdXww": {"name": "🇧🇷 River — Neutro e Informativo (Neutro)", "priority": 18},
    "N2lVS1w4EtoT3dr4eOWO": {"name": "🇧🇷 Callum — Rouca e Marcante (Masculino)", "priority": 19},
    "SOYHLrjzK2X1ezoPC6cr": {"name": "🇧🇷 Harry — Intensa e Épica (Masculino)", "priority": 20},
    "XrExE9yKIg1WjnnlVkGX": {"name": "🇧🇷 Matilda — Didática e Confiante (Feminino)", "priority": 21},
}


def catalog_voice(key):
    headers = {"xi-api-key":key}
    models = call("GET",ELEVEN+"/v1/models",headers)
    usable = [m["model_id"] for m in models if m.get("can_do_text_to_speech") and
              any(lang.get("language_id","").split("-")[0]=="pt" for lang in m.get("languages",[]))]
    voices, params = [], {"page_size":100}
    while True:
        data = call("GET",ELEVEN+"/v2/voices",headers,params=params)
        for v in data["voices"]:
            vid = v["voice_id"]
            prof = VOICE_PROFILES_PT.get(vid)
            name = prof["name"] if prof else v["name"]
            priority = prof["priority"] if prof else 99
            voices.append({
                "id": vid,
                "name": name,
                "preview_url": v.get("preview_url"),
                "priority": priority
            })
        if not data.get("has_more"):
            break
        token = data.get("next_page_token")
        if not token or token == params.get("next_page_token"):
            raise ValueError("Paginação incompleta na lista de vozes.")
        params["next_page_token"] = token
    # Ordenar priorizando as vozes recomendadas em português brasileiro
    voices.sort(key=lambda x: (x.get("priority", 99), x["name"].casefold()))
    return {"models":sorted(usable,key=lambda m:("flash" not in m,m)), "voices":voices}


def chat(cfg, model, system, payload, limit=None):
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False, separators=(",", ":"))},
        ],
    }
    if limit:
        body["max_tokens"] = limit
    data = call("POST", EXPERIENTIAL + "/chat/completions", {"Authorization": "Bearer " + cfg["experiential"]}, json=body)
    if not isinstance(data, dict):
        raise ValueError("O gateway retornou uma resposta em formato inválido.")
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        detail = data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else None
        if detail: raise ValueError(f"Erro do modelo: {detail}")
        raise ValueError("O modelo não devolveu opções de resposta. Tente outro modelo.")
    choice = choices[0] if isinstance(choices[0], dict) else {}
    msg = choice.get("message") if isinstance(choice.get("message"), dict) else choice
    content = msg.get("content")
    if isinstance(content, str):
        raw = content.strip()
    elif isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str): parts.append(part)
            elif isinstance(part, dict): parts.append(part.get("text") or part.get("content") or "")
        raw = "".join(parts).strip()
    else:
        raw = ""
    if not raw:
        for fallback_field in ("reasoning_content", "reasoning", "text"):
            fb = msg.get(fallback_field)
            if isinstance(fb, str) and fb.strip():
                raw = fb.strip()
                break
    if not raw:
        if choice.get("finish_reason") == "length":
            cap = f"({limit})" if limit else "(padrão do provedor)"
            raise ValueError(f"O modelo esgotou os tokens {cap} durante o raciocínio antes de concluir o texto. Escolha outro modelo.")
        raise ValueError("O modelo devolveu uma resposta vazia. Tente outro modelo.")

    # Remove tags de raciocinio de modelos DeepSeek / Qwen
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE).strip()
    target_text = cleaned or raw.strip()

    try:
        return json.loads(target_text)
    except (ValueError, TypeError):
        pass

    # Blocos markdown
    blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", target_text, re.IGNORECASE)
    for block in reversed(blocks):
        b = block.strip()
        try:
            return json.loads(b)
        except (ValueError, TypeError):
            pass
        b_clean = re.sub(r",\s*([\]}])", r"\1", b)
        try:
            return json.loads(b_clean)
        except (ValueError, TypeError):
            pass

    # Procurar o bloco JSON principal
    for candidate in [
        re.search(r"(\{[\s\S]*\})", target_text),
        re.search(r"(\[[\s\S]*\])", target_text)
    ]:
        if candidate:
            text_match = candidate.group(1).strip()
            try:
                return json.loads(text_match)
            except (ValueError, TypeError):
                pass
            text_fixed = re.sub(r",\s*([\]}])", r"\1", text_match)
            try:
                return json.loads(text_fixed)
            except (ValueError, TypeError):
                pass
            text_no_comments = re.sub(r"//.*?\n", "\n", text_fixed)
            try:
                return json.loads(text_no_comments)
            except (ValueError, TypeError):
                pass

    raise ValueError("O modelo de texto devolveu JSON inválido. Tente outro modelo de roteiro.")


def speech(cfg, model, voice, text):
    payload = {
        "model_id": model,
        "text": text,
        "language_code": "pt",
        "voice_settings": {
            "stability": 0.38,
            "similarity_boost": 0.80,
            "style": 0.25,
            "use_speaker_boost": True
        }
    }
    if model in {"eleven_v3","eleven_v4","eleven_v4_turbo"}:
        payload["voice_settings"] = {"stability":0.5,"similarity_boost":0.8}
    data = call("POST", ELEVEN+"/v1/text-to-speech/"+quote(voice, safe="")+"/with-timestamps",
                {"xi-api-key": cfg["eleven"]}, json=payload)
    return base64.b64decode(data["audio_base64"], validate=True), data.get("alignment") or {}


def preview_voice_audio(cfg_eleven, voice_id, dest_file):
    if dest_file.is_file() and dest_file.stat().st_size > 0:
        return dest_file
    dest_file.parent.mkdir(parents=True, exist_ok=True)
    key = cfg_eleven.get("plain_key")
    if not key:
        raise ValueError("Conecte o ElevenLabs nas Configurações.")

    # 1. Tentar gerar demonstração curta em português brasileiro com entonação natural
    sample_text = "Olá! Esta é uma demonstração da minha voz em português brasileiro para os seus vídeos."
    try:
        res = requests.post(
            f"{ELEVEN}/v1/text-to-speech/{quote(voice_id, safe='')}",
            headers={"xi-api-key": key},
            json={
                "text": sample_text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.40,
                    "similarity_boost": 0.80,
                    "style": 0.20,
                    "use_speaker_boost": True
                }
            },
            timeout=(10, 30)
        )
        if res.ok and len(res.content) > 1000:
            dest_file.write_bytes(res.content)
            return dest_file
    except Exception:
        pass

    # 2. Fallback para preview_url padrão do ElevenLabs
    catalog = cfg_eleven.get("catalog", {})
    voices = catalog.get("voices", [])
    voice = next((v for v in voices if v.get("id") == voice_id), None)
    preview_url = voice.get("preview_url") if voice else None
    if not preview_url:
        data = call("GET", ELEVEN + f"/v1/voices/{quote(voice_id, safe='')}", {"xi-api-key": key})
        preview_url = data.get("preview_url")
        if voice:
            voice["preview_url"] = preview_url

    if preview_url:
        try:
            res = requests.get(preview_url, timeout=(10, 30))
            if res.ok and len(res.content) > 1000:
                dest_file.write_bytes(res.content)
                return dest_file
        except requests.RequestException:
            pass

    raise ValueError("Amostra de áudio indisponível para esta voz.")
