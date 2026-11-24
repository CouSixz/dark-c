import bisect
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import threading
import uuid
import wave
from pathlib import Path

import acervo as db
import direcao
import som_automatico
import provedores as api

MOTOR = db.ROOT / "painel" / "motor"
RUN = threading.Semaphore(1)
SHAPES = {"sphere", "box", "cylinder", "cone", "ring", "disc", "capsule", "person", "bus", "cup", "bread"}

VALID_MOODS = {"shock", "worry", "panic", "grin", "laugh", "angry", "deadpan", "smile"}
VALID_ACTIONS = {"shock", "sweat_panic", "jump_back", "shiver_sweat", "run", "point", "fall", "celebrate", "drink", "look"}
VALID_ENVS = {"city_street", "laboratory", "apocalypse_red", "nature_space", "office", "street", "lab", "bedroom", "city", "apocalypse", "nature", "stadium", "plaza", "space", "studio", "location"}
VALID_CAMS = {"dutch", "push", "orbit", "whip", "low_angle", "shake"}
VALID_TRANS = {"flash", "zoom", "whip", "ghost"}
VALID_SFX = {"alarm", "scratch", "impact", "whoosh", "pop", "ding", "stamp", "riser", "heart", "chime", "click"}
VALID_PROPS = {"coin", "singularity", "globe", "clock", "warning", "screen", "building", "taxi", "none"}


def editorial(profile):
    return {k: profile[k] for k in ("name", "description", "hook", "style", "voice") if profile.get(k)}


def text(value, limit, truncate=False):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Texto vazio.")
    val = value.strip()
    if len(val) > limit:
        if truncate:
            val = val[:limit].rstrip()
            if " " in val:
                val = val.rsplit(" ", 1)[0].rstrip(" ,;:-.")
        else:
            raise ValueError(f"Texto vazio ou maior que {limit} caracteres.")
    return val


def config(provider):
    try:
        key = db.get_api_key(provider)
        return {provider: key}
    except Exception:
        raise ValueError(f"Chave de API de '{provider}' não encontrada. Defina no arquivo .env ou em Configurações.")


def ideas(channel, model):
    profile = db.channel(channel)
    with db.banco() as c:
        old = db.history(channel, c)
    cfg = config("experiential")
    if model not in db.setting("experiential")["catalog"]["text"]:
        raise ValueError("Escolha uma IA de roteiro conectada.")
    
    prompt = (
        'Você é um especialista em canais virais (TikTok / Shorts / Reels) de curiosidades e "E Se...". '
        'Crie seis ideias altamente magnéticas, irresistíveis e de altíssima retenção em PT-BR para o perfil (máximo 200 caracteres cada). '
        'Formule cada ideia como uma hipótese concreta que o espectador possa testar mentalmente. '
        'Inclua um objeto ou situação brasileira que torne a consequência visível. Evite afirmar números '
        'específicos sem base ou prometer catástrofes que não decorrem da hipótese. '
        'Responda exclusivamente JSON {"ideias":["..."]}.'
    )
    result = api.chat(cfg, model, prompt, {"perfil": editorial(profile), "usados": old[:100]})
    
    if isinstance(result, list):
        batch = result
    elif isinstance(result, dict):
        batch = result.get("ideias") or result.get("ideas") or result.get("sugestoes") or result.get("pautas")
        if not batch and len(result) == 1 and isinstance(list(result.values())[0], list):
            batch = list(result.values())[0]
    else:
        batch = []
    if not isinstance(batch, list) or len(batch) < 5:
        raise ValueError("O modelo não devolveu cinco ideias. Escolha outro modelo ou tente novamente.")
    clean = []
    for item in batch:
        if isinstance(item, dict):
            item = item.get("ideia") or item.get("idea") or item.get("titulo") or item.get("texto") or " — ".join(str(v) for v in item.values() if isinstance(v, str))
        s = text(item, 260, truncate=True)
        if any(db.similar(s, x) for x in old + clean):
            continue
        clean.append(s)
        if len(clean) == 5:
            break
    if len(clean) < 5:
        raise ValueError(f"O modelo devolveu apenas {len(clean)} ideias únicas. Escolha outro modelo ou tente novamente.")
    with db.banco() as c:
        c.execute("INSERT OR REPLACE INTO ideas VALUES (?,?)", (channel, db.pack(clean)))
    return clean


def command(args, timeout=1800, cwd=None):
    proc = subprocess.run(list(map(str, args)), cwd=cwd, capture_output=True, timeout=timeout,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if proc.returncode:
        tail = (proc.stderr or proc.stdout).decode("utf8", "replace")[-450:]
        raise ValueError("Falha no motor local. " + tail)
    return proc.stdout


def bins():
    node = shutil.which("node")
    cli = MOTOR / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    ff = next((MOTOR / "node_modules" / "@remotion").glob("compositor-*/ffmpeg.exe"), None)
    if not (node and cli.exists() and ff):
        raise ValueError("Motor local incompleto. Execute ABRIR ESTUDIO.cmd para instalar as dependências.")
    return node, cli, ff


def atomic(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data if isinstance(data, bytes) else db.pack(data).encode())
    tmp.replace(path)


def normalize_color(c, default=None):
    if not isinstance(c, str):
        return default
    c = c.strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", c):
        return c.lower()
    if re.fullmatch(r"[0-9a-fA-F]{6}", c):
        return f"#{c.lower()}"
    if re.fullmatch(r"#[0-9a-fA-F]{3}", c):
        return "#" + "".join(ch * 2 for ch in c[1:]).lower()
    if re.fullmatch(r"[0-9a-fA-F]{3}", c):
        return "#" + "".join(ch * 2 for ch in c).lower()
    return default


def extract_word_timings(timing, spoken, duration):
    chars = timing.get("characters", [])
    starts = timing.get("character_start_times_seconds", [])
    ends = timing.get("character_end_times_seconds", [])
    if chars and starts and ends and len(chars) == len(starts) == len(ends) and len(chars) > 0:
        words = []
        cur = []
        w_start = None
        for i, ch in enumerate(chars):
            if not ch.isspace():
                if w_start is None:
                    w_start = starts[i]
                cur.append(ch)
            else:
                if cur:
                    words.append({
                        "word": "".join(cur),
                        "start": round(float(w_start), 3),
                        "end": round(float(ends[i - 1]), 3)
                    })
                    cur = []
                    w_start = None
        if cur:
            words.append({
                "word": "".join(cur),
                "start": round(float(w_start), 3),
                "end": round(float(ends[-1]), 3)
            })
        if words:
            return words

    words_raw = list(re.finditer(r"\S+", spoken))
    total_len = max(1, len(spoken))
    return [
        {
            "word": m.group(),
            "start": round((m.start() / total_len) * duration, 3),
            "end": round((m.end() / total_len) * duration, 3)
        }
        for m in words_raw
    ]


def validated_plan(plan, n):
    if not isinstance(plan, dict):
        raise ValueError("Roteiro inválido.")
    if plan.get("repetida") is True:
        raise ValueError("A IA identificou o mesmo assunto no histórico. Escolha uma ideia diferente.")
    
    raw_palette = plan.get("palette")
    if isinstance(raw_palette, list):
        colors = [normalize_color(c) for c in raw_palette]
        valid = [c for c in colors if c]
        if len(valid) >= 2:
            plan["palette"] = valid[:2]
        else:
            plan["palette"] = ["#0b0d1a", "#f2c94c"]
    else:
        plan["palette"] = ["#0b0d1a", "#f2c94c"]

    shots = plan.get("shots")
    if not isinstance(shots, list) or len(shots) < n:
        raise ValueError(f"Quantidade de cenas incorreta: esperadas {n}, recebidas {len(shots) if isinstance(shots, list) else 0}.")
    shots = shots[:n]
    plan["shots"] = shots
    plan["direcaoVersao"] = plan.get("direcaoVersao", 1)

    for i, s in enumerate(shots):
        if not isinstance(s, dict):
            raise ValueError("Estrutura de cena inválida no roteiro.")
        s["title"] = text(s.get("title", f"Cena {i+1}"), 48, truncate=True)
        raw_fala = text(s.get("fala", ""), 650, truncate=True)
        # Strip stray robotic meta-labels like "Aposta:", "Previsão:", "Prova:", "Consequência:"
        raw_fala = re.sub(r"^(?:Aposta|Previsão|Previsao|Prova|Consequência|Consequencia|Resposta|Cena\s*\d+)\s*:\s*", "", raw_fala, flags=re.IGNORECASE)
        if re.search(r"[\[\]<>]", raw_fala):
            raw_fala = re.sub(r"[\[\]<>]", "", raw_fala)
        s["fala"] = raw_fala.strip()

        # Validate Stick3D visual directions
        s["mood"] = s.get("mood", "shock" if i < 2 else "worry")
        if s["mood"] not in VALID_MOODS:
            s["mood"] = "shock" if i == 0 else "worry"

        anim_raw = s.get("animacao") or s.get("action") or ("jump_back" if i == 0 else "shiver_sweat")
        s["animacao"] = db.slug(anim_raw)
        s["action"] = anim_raw if anim_raw in VALID_ACTIONS else s["animacao"]

        s["env"] = s.get("env", "office")
        if s["env"] not in VALID_ENVS:
            s["env"] = "office"

        s["cam"] = s.get("cam", "push")
        if s["cam"] not in VALID_CAMS:
            s["cam"] = "push"

        s["trans"] = s.get("trans", "flash" if i == 0 else "zoom" if i % 2 == 1 else "ghost")
        if s["trans"] not in VALID_TRANS:
            s["trans"] = "zoom"

        s["sfx"] = s.get("sfx", "impact" if i == 0 else "whoosh" if i % 2 == 1 else "pop")
        if s["sfx"] not in VALID_SFX:
            s["sfx"] = "pop"

        s["prop"] = s.get("prop", "none")
        if s["prop"] not in VALID_PROPS:
            s["prop"] = "none"

        if s.get("set") in direcao.SETS:
            s["set"] = s["set"]
        if s.get("frame") in direcao.FRAMES:
            s["frame"] = s["frame"]
        if s.get("light") in ("day", "night", "dusk"):
            s["light"] = s["light"]
        if isinstance(s.get("cue"), str) and s["cue"].strip():
            s["cue"] = s["cue"].strip()[:60]

        # Backwards compatible objects array
        if "objects" not in s or not isinstance(s.get("objects"), list) or len(s["objects"]) == 0:
            s["objects"] = [{"shape": "person", "color": "#f2c94c", "scale": [1, 1, 1], "start": [0, 0, 0], "end": [0, 0, 0], "turn": [0, 0, 0]}]

    return plan


def create_plan(cfg, r, cid):
    target_seconds = min(65, max(61, r.get("seconds", 61)))
    n = 8
    with db.banco() as c:
        history = [h for h in db.history(cid, c) if h != r["idea"]]
    nearest = sorted(history, key=lambda h: len(set(db.norm(h).split()) & set(db.norm(r["idea"]).split())), reverse=True)[:10]
    nearest_short = [h[:110] for h in nearest]

    acervo_obj = sorted(db.get_models_catalog().keys())
    acervo_anim = sorted(db.get_animations_catalog().keys())

    system = """Roteirista e diretor 3D viral PT-BR (Shorts/TikTok, estilo Kurzgesagt/Ciência Todo Dia).
REGRAS DO ROTEIRO:
1. EXATAMENTE 8 cenas ("shots") encadeadas por causa e efeito (0-62s), somando 160 A 180 PALAVRAS faladas (~20-23 palavras/cena).
2. Cena 1 abre direto na hipótese concreta nos primeiros 2s (sem suspense vago, sem personagens fictícios com nomes aleatórios; fale com "você/nós/Brasil").
3. Estrutura: 1-Gancho imediato; 2-Escala comparável; 3-Impacto no Brasil; 4-Reação em cadeia; 5-Revelação científica contraintuitiva; 6-Clímax; 7-Pós-evento; 8-Fechamento reflexivo.
4. Narração falada limpa em PT-BR: números por extenso ("sessenta segundos"), SEM rótulos ("Cena:", "Aposta:"), SEM colchetes.

REGRAS DE OBJETOS E ANIMAÇÕES (ECONOMIA MÁXIMA):
- Em cada cena, indique "objetos" (1 a 4 itens concretos do assunto) e "animacao" (ação corporal do personagem).
- PREFIRA reutilizar nomes que já existem em "acervo_objetos" e "acervo_animacoes". Só crie um nome novo em snake_case se faltar algo essencial para a cena!
- Coordenadas mundo: x [-2..2], y [0..3.5] (chão=0), z [-2..1]. Em "actor", personagem fica à esquerda e objeto principal à direita.

FORMATO JSON VÁLIDO:
{"palette":["#0b0d1a","#ff5a1f"],"shots":[{"title":"...","fala":"...","set":"location|space|studio|plaza|stadium","frame":"actor|detail|wide","light":"day|night|dusk","env":"city_street|office|laboratory|apocalypse_red|nature_space|stadium","mood":"shock|worry|panic|grin|laugh|angry|deadpan|smile","animacao":"nome_animacao","cam":"push|orbit|low_angle|dutch|whip|shake","trans":"ghost|zoom|flash","sfx":"impact|alarm|whoosh|chime|riser|pop|ding","cue":"palavra_da_fala","objetos":[{"nome":"nome_objeto","de":[1.1,1.2,-0.4],"para":[1.1,1.2,-0.4],"escala":1.2,"mov":"still|travel|arc|spin|pulse|appear|dim|fall"}]}]}"""

    request = {
        "perfil": editorial(r["profile"]),
        "ideia": r["idea"],
        "segundos": target_seconds,
        "N": n,
        "usados": nearest_short,
        "acervo_objetos": acervo_obj,
        "acervo_animacoes": acervo_anim,
    }
    if r.get("edicao_de"):
        request["nova_edicao"] = "Crie roteiro novo para comparação."
    for attempt in range(2):
        result = api.chat(cfg, r["model"], system, request)
        if isinstance(result, dict) and result.get("repetida") is True:
            raise ValueError("A ideia já aparece no histórico.")
        try:
            if not isinstance(result, dict) or not isinstance(result.get("shots"), list) or len(result["shots"]) != n:
                raise ValueError(f"Entregue exatamente {n} cenas.")
            plan = validated_plan(result, n)
            count = sum(len(shot["fala"].split()) for shot in plan["shots"])
            if not 145 <= count <= 195:
                raise ValueError(f"O roteiro tem {count} palavras. São necessárias 160 a 180.")
            return plan
        except ValueError as exc:
            if attempt:
                raise
            request["correcao"] = str(exc)


def voice_text(model, shots):
    lines = [s["fala"] for s in shots]
    if model in {"eleven_v3", "eleven_v4", "eleven_v4_turbo"}:
        for index, tag in {0:"excited", len(lines)//2:"curious", len(lines)-1:"confident"}.items():
            lines[index] = f"[{tag}] {lines[index]}"
    return "\n".join(lines)


def spoken_alignment(align, sent):
    chars = align.get("characters", [])
    if "".join(chars) != sent:
        return align
    fields = ("characters", "character_start_times_seconds", "character_end_times_seconds")
    if not all(len(align.get(k, [])) == len(sent) for k in fields):
        return {}
    skip = {i for m in re.finditer(r"(?m)^\[[a-z]+\] ", sent) for i in range(*m.span())}
    return {k:[v for i,v in enumerate(align[k]) if i not in skip] for k in fields}


def layout(plan, align, spoken, duration, seconds):
    shots = plan["shots"]
    starts = []
    offset = 0
    for shot in shots:
        starts.append(offset)
        offset += len(shot["fala"]) + 1

    align = align if isinstance(align, dict) else {}
    chars = align.get("characters") or []
    times = align.get("character_start_times_seconds") or []
    ends = align.get("character_end_times_seconds") or []
    aligned = (chars == list(spoken) and len(times) == len(ends) == len(chars)
               and all(isinstance(x, (int, float)) and math.isfinite(x)
                       for x in [*times, *ends])
               and all(0 <= a <= b <= duration + 0.05 for a, b in zip(times, ends))
               and all(a <= b for a, b in zip(times, times[1:])))

    total_frames = max(1, round(seconds * 30))
    source = [0.0]
    for i in starts[1:]:
        source.append(times[i] if aligned else duration * i / len(spoken))
    source.append(duration)
    if any(b <= a for a, b in zip(source, source[1:])):
        aligned = False
        source = [duration * i / len(spoken) for i in starts] + [duration]

    # Os cortes acompanham a fala com respiração cinematográfica natural.
    count = len(shots)
    lower, upper = (150, 300) if 150*count <= total_frames <= 300*count else (75, 90) if 75*count <= total_frames <= 90*count else (1, total_frames)
    cuts = [0]
    for i, stamp in enumerate(source[1:-1], 1):
        minimum = max(cuts[-1] + lower, total_frames - upper*(count-i))
        maximum = min(cuts[-1] + upper, total_frames - lower*(count-i))
        cuts.append(min(maximum, max(minimum, round(total_frames * stamp / duration))))
    cuts.append(total_frames)
    for i, shot in enumerate(shots):
        shot.update({"from": cuts[i], "frames": cuts[i+1]-cuts[i],
                     "start": cuts[i]/30, "end": cuts[i+1]/30,
                     "vozInicio": source[i], "vozFim": source[i+1]})

    words = extract_word_timings(align if aligned else {}, spoken, duration)
    def mapped(stamp):
        i = min(count-1, max(0, bisect.bisect_right(source, stamp)-1))
        fraction = min(1, max(0, (stamp-source[i]) / (source[i+1]-source[i])))
        return round((cuts[i] + fraction * (cuts[i+1]-cuts[i])) / 30, 5)
    for word in words:
        word.update(start=mapped(word["start"]), end=mapped(word["end"]))

    if "models" in plan:
        for shot in shots:
            stage = shot["stage"]
            cue = db.norm(stage["cue"]).split()
            matches = [w for w in words if shot["start"]-.001 <= w["start"] < shot["end"]
                       and db.norm(w["word"]) in cue]
            stage["beat"] = max(0, matches[0]["start"] - shot["start"]) if matches else shot["frames"]/90
    return {
        **({"models": plan["models"]} if "models" in plan else {}),
        **({"animations": plan["animations"]} if "animations" in plan else {}),
        "seconds": seconds,
        "totalFrames": total_frames,
        "palette": plan.get("palette", ["#0b0d1a", "#f2c94c"]),
        "shots": shots,
        "words": words,
        "audioFile": "audio/mix.wav",
    }


def fit_voice(ff, original, output, shots):
    args = []
    filters = []
    labels = []
    for i, shot in enumerate(shots):
        length = shot["vozFim"] - shot["vozInicio"]
        target = shot["frames"] / 30
        args.extend(["-ss", shot["vozInicio"], "-t", length, "-i", original])
        speed = length / target
        stages = max(1, math.ceil(abs(math.log2(speed))))
        tempo = ",".join([f"atempo={speed ** (1/stages):.10f}"] * stages)
        label = f"[scene{i}]"
        filters.append(f"[{i}:a]{tempo},apad,atrim=duration={target:.9f}{label}")
        labels.append(label)
    filters.append("".join(labels) + f"concat=n={len(labels)}:v=0:a=1[out]")
    command([ff, "-v", "error", "-y", *args, "-filter_complex", ";".join(filters),
             "-map", "[out]", "-ar", "48000", output])


def mix_sfx(folder, voice_wav, shots, duration):
    return som_automatico.mix(folder, voice_wav, shots, duration, bins()[2],
                               MOTOR / "sfx", command, atomic)


def render_stick_video(job_id, folder, props):
    node, cli, ff = bins()
    output_mp4 = folder / "video.mp4"
    staging = folder / "video-render.tmp.mp4"

    props_file = folder / "cenas.json"
    atomic(props_file, props)

    db.update(job_id, "produzindo", "Renderizando animação 3D com personagens Stick...")

    # O diretório público só precisa da mixagem. Evita copiar MP4s anteriores
    # e a gravação original inteira para cada bundle temporário do Remotion.
    with tempfile.TemporaryDirectory(prefix="corte-render-") as tmp:
        public = Path(tmp)
        (public / "audio").mkdir()
        shutil.copyfile(folder / "audio" / "mix.wav", public / "audio" / "mix.wav")
        args = [node, cli, "render", "Corte", staging, f"--props={props_file}",
                f"--public-dir={public}", "--codec=h264", "--audio-codec=aac", "--log=warn"]
        try:
            command([*args, "--gl=angle", "--concurrency=4"], timeout=7200, cwd=MOTOR)
        except ValueError:
            command([*args, "--gl=swangle", "--concurrency=2"], timeout=7200, cwd=MOTOR)

    if not staging.is_file() or staging.stat().st_size < 1000:
        raise ValueError("O arquivo de vídeo final não foi gerado corretamente.")
    if output_mp4.exists():
        shutil.copy2(output_mp4, folder / f"video-anterior-{uuid.uuid4().hex}.mp4")
    staging.replace(output_mp4)
    return output_mp4


def build_claude_prompt(folder, profile, req, plan, spoken, duration, timing):
    shots = plan.get("shots", [])
    total_frames = max(1, round(duration * 30))
    channel_name = profile.get("name", "Canal")
    rel_folder = folder.relative_to(db.ROOT) if folder.is_relative_to(db.ROOT) else folder

    prompt = f"""# 🚀 ESTÚDIO CORTE: ANIMAÇÃO 3D VIRAL CONCLUÍDA
- **Canal**: {channel_name}
- **Pasta**: `{rel_folder}`
- **Duração**: {duration:.2f}s ({total_frames} frames)
- **Cenas**: {len(shots)} micro-cenas com cortes com média de {duration / len(shots):.2f}s.
- **Visual**: Stickman 3D Toon com expressões dinâmicas, iluminação dramática e legendas cinéticas.
- **Áudio**: Narração oficial + música instrumental e efeitos sincronizados.
"""
    atomic(folder / "prompt-claude-code.md", prompt.encode("utf8"))
    return prompt


def work(job):
    with RUN:
        try:
            with db.banco() as c:
                row = c.execute("SELECT * FROM jobs WHERE id=?", (job,)).fetchone()
            r = json.loads(row["request"])
            folder = db.ROOT / "producoes" / row["channel"] / job
            folder.mkdir(parents=True, exist_ok=True)
            checkpoint = folder / "progresso.json"
            state = json.loads(checkpoint.read_text("utf8")) if checkpoint.exists() else {}
            node, cli, ff = bins()

            def paid(name, run_fn):
                if state.get("incerto"):
                    raise ValueError("A resposta de uma chamada paga se perdeu. Confira o consumo antes de autorizar nova chamada.")
                state["incerto"] = name
                atomic(checkpoint, state)
                run_fn()
                state.pop("incerto")
                atomic(checkpoint, state)

            script = folder / "roteiro.json"
            audio = folder / "narracao.mp3"
            timing = folder / "marcas.json"
            direction = folder / "direcao.json"

            finished = {"roteiro": script.exists(), "direcao":direction.exists(), "voz": audio.exists() and timing.exists()}
            if finished.get(state.get("incerto")):
                state.pop("incerto")
                atomic(checkpoint, state)

            # 1. Roteiro Viral + Direção Base (1 chamada enxuta)
            if not script.exists():
                db.update(job, "produzindo", "Escrevendo roteiro e cenas (economia máxima de tokens)")
                roteiro_cfg = config("experiential")
                paid("roteiro", lambda: atomic(script, create_plan(roteiro_cfg, r, row["channel"])))

            plan = json.loads(script.read_text("utf8"))
            if not isinstance(plan.get("shots"), list) or not plan["shots"]:
                raise ValueError("O roteiro salvo está sem cenas.")
            plan = validated_plan(plan, len(plan["shots"]))

            if plan.get("direcaoVersao", 1) == 1:
                models_lib = db.get_models_catalog()
                anims_lib = db.get_animations_catalog()
                uses_unified = any("objetos" in s or "animacao" in s for s in plan["shots"])

                if not direction.exists():
                    if uses_unified:
                        check = direcao.resolve_missing_assets(plan["shots"], models_lib, anims_lib)
                        miss_m = check["missing_models"]
                        miss_a = check["missing_anims"]

                        if miss_m:
                            db.update(job, "produzindo",
                                      f"Acervo: {len(check['reused_models'])} objetos reutilizados · Criando {len(miss_m)} objeto(s) novo(s) com IA")
                            exp_cfg = config("experiential")
                            def build_missing_m():
                                updated, _ = direcao.ensure_missing_models(exp_cfg, r["model"], r["idea"], miss_m, library=models_lib)
                                atomic(folder / "modelos.json", updated)
                            paid("modelos", build_missing_m)
                            models_lib = db.get_models_catalog()

                        if miss_a:
                            db.update(job, "produzindo",
                                      f"Acervo: {len(check['reused_anims'])} animações reutilizadas · Criando {len(miss_a)} animação(ões) nova(s) com IA")
                            exp_cfg = config("experiential")
                            def build_missing_a():
                                updated, _ = direcao.ensure_missing_animations(exp_cfg, r["model"], miss_a, anims_library=anims_lib)
                                atomic(folder / "animacoes.json", updated)
                            paid("animacoes", build_missing_a)
                            anims_lib = db.get_animations_catalog()

                        if not miss_m and not miss_a:
                            db.update(job, "produzindo",
                                      f"Acervo completo reutilizado com 0 tokens ({len(check['reused_models'])} objetos, {len(check['reused_anims'])} animações)")

                        art = direcao.build_stages_from_plan(plan, models_lib, anims_lib)
                        atomic(direction, {"models": art["models"], "animations": art["animations"], "scenes": art["scenes"]})
                    else:
                        db.update(job, "produzindo", "Modelando objetos 3D e coreografando as cenas com a IA")
                        library_path = folder / "modelos.json"
                        library = json.loads(library_path.read_text("utf8")) if library_path.exists() else models_lib
                        paid("direcao", lambda: atomic(direction, direcao.create(config("experiential"), r, plan["shots"],
                             library=library, save_library=lambda data: atomic(library_path, data))))

                raw_dir = json.loads(direction.read_text("utf8"))
                art = direcao.validate(raw_dir, plan["shots"])
                plan["models"] = art["models"]
                plan["animations"] = raw_dir.get("animations") or anims_lib
                for shot, stage in zip(plan["shots"], art["scenes"]):
                    shot["stage"] = stage
                    if shot.get("animacao") and shot["animacao"] in plan["animations"]:
                        shot["action"] = shot["animacao"]

            spoken = "\n".join(s["fala"] for s in plan["shots"])
            (folder / "roteiro.txt").write_text(spoken, encoding="utf8")

            # 2. Narração ElevenLabs
            if not audio.exists() or not timing.exists():
                db.update(job, "produzindo", "Gravando narração no ElevenLabs")
                voz_cfg = config("eleven")

                def narrate():
                    sent = voice_text(r["tts"], plan["shots"])
                    atomic(folder / "texto-enviado.txt",sent.encode("utf8"))
                    data, align = api.speech(voz_cfg, r["tts"], r["voice"], sent)
                    atomic(timing, align)
                    atomic(audio, data)

                paid("voz", narrate)

            # 3. Sincronização e SFX
            db.update(job, "produzindo", "Sincronizando áudio, cortes e efeitos sonoros")
            command([ff, "-y", "-v", "error", "-i", audio, "-ac", "1", "-ar", "44100", folder / "original.wav"])
            with wave.open(str(folder / "original.wav")) as w:
                duration = w.getnframes() / w.getframerate()
            if duration <= 0:
                raise ValueError("Áudio vazio.")
            actual_seconds = min(65, max(61, r.get("seconds", 61)))
            timing_data = json.loads(timing.read_text("utf8"))
            sent_file = folder / "texto-enviado.txt"
            if sent_file.exists():
                timing_data = spoken_alignment(timing_data,sent_file.read_text("utf8"))
            props = layout(plan, timing_data, spoken, duration, actual_seconds)
            fit_voice(ff, folder / "original.wav", folder / "voz.wav", props["shots"])
            props["channel"] = r["profile"]["name"]

            # Mix SFX with Voice
            mix_sfx(folder, folder / "voz.wav", props["shots"], actual_seconds)
            atomic(folder / "cenas.json", props)

            # 4. Renderização Automática do Vídeo Remotion 3D
            output_mp4 = render_stick_video(job, folder, props)

            build_claude_prompt(folder, r["profile"], r, plan, spoken, actual_seconds, timing_data)
            (folder / "original.wav").unlink(missing_ok=True)
            checkpoint.unlink(missing_ok=True)

            rel_output = f"producoes/{row['channel']}/{job}/video.mp4"
            db.update(job, "pronto", "Vídeo 3D viral renderizado com sucesso!", rel_output)

        except Exception as exc:
            msg = str(exc) if isinstance(exc, ValueError) else f"Falha em {type(exc).__name__}: {str(exc)[:400]}"
            db.update(job, "pausado", msg[:600])


def rerender_local(job):
    """Re-renderiza um vídeo já gravado localmente sem gastar nenhum crédito ou token de API."""
    with RUN:
        try:
            with db.banco() as c:
                row = c.execute("SELECT * FROM jobs WHERE id=?", (job,)).fetchone()
            if not row:
                raise ValueError("Episódio não encontrado.")
            folder = db.ROOT / "producoes" / row["channel"] / job
            cenas_path = folder / "cenas.json"
            if not cenas_path.exists():
                raise ValueError("Este episódio ainda não possui cenas montadas para re-render local.")
            props = json.loads(cenas_path.read_text("utf8"))
            props["animations"] = props.get("animations") or db.get_animations_catalog()
            if not (folder / "audio" / "mix.wav").exists():
                raise ValueError("Áudio mixado ausente. Use Retomar para reconstruir o áudio.")
            render_stick_video(job, folder, props)
            rel_output = f"producoes/{row['channel']}/{job}/video.mp4"
            db.update(job, "pronto", "Vídeo 3D atualizado com o motor mais recente (0 tokens)!", rel_output)
        except Exception as exc:
            msg = str(exc) if isinstance(exc, ValueError) else f"Falha em {type(exc).__name__}: {str(exc)[:400]}"
            db.update(job, "pausado", msg[:600])


def launch(job):
    threading.Thread(target=work, args=(job,), daemon=True).start()


def launch_rerender(job):
    threading.Thread(target=rerender_local, args=(job,), daemon=True).start()
