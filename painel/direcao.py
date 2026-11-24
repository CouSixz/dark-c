"""Contrato declarativo de modelagem e animação usado pelo diretor e pelo Three.js."""
import math
import re

import acervo as db
import provedores as api

SHAPES = ("box", "sphere", "cylinder", "cone", "ring", "globe", "sun", "light", "clock", "performer")
MOTIONS = ("still", "travel", "arc", "spin", "pulse", "appear", "dim", "fall")
SETS = ("location", "space", "studio", "plaza", "stadium")
FRAMES = ("actor", "detail", "wide")
ARMS = ("down", "up", "hold", "point", "head", "chest", "box", "shrug")
MOODS = ("shock", "worry", "panic", "grin", "laugh", "angry", "deadpan", "smile")

PROMPT = """Você é diretor de arte e animador 3D. Recebe as falas definitivas em ordem. Programe
uma pequena biblioteca de modelos originais e encene CADA fala por meio de JSON. Cada plano deve
mostrar a causa, o objeto mencionado ou sua transformação. Evite uma pessoa gesticulando diante
de uma réplica minúscula do assunto. Mantenha continuidade de cor, objeto e escala; faça inserts
de detalhe e use profundidade. A resolução da pergunta deve acontecer em imagem.
Retorne {"models":{"nome":[parte,...]},"scenes":[cena,...]}.
Uma parte é [forma,corHex,[x,y,z],[largura,altura,profundidade],[rx,ry,rz]] no espaço LOCAL
do modelo, centrado na origem, com dimensão total típica de uma unidade. Rotação opcional em GRAUS.
Para articular UMA peça dentro do objeto, acrescente na sexta posição
{"pivot":[x,y,z],"rotate":[grausX,grausY,grausZ],"slide":[dx,dy,dz]}:
o pivot é um ponto no espaço local do modelo, rotate e slide são variações durante a ação.
Exemplos: hélice que gira, tampa que abre na dobradiça, gaveta que desliza.
Formas: box sphere cylinder cone ring globe sun light clock performer. Para pessoas, use uma única peça performer
na origem com tamanho [1,1,1]; a cor define a roupa e o motor articula corpo e rosto. As formas especiais servem de modelos
prontos de Terra, Sol, ponto luminoso com halo e relógio (ring é um aro frontal). Construa objetos novos
com várias partes, como bicicleta com dois aros e tubos, celular com carcaça e tela etc.
Use modelos distintos, silhuetas legíveis, até 20 modelos, até 18 partes cada.
Cada cena é {"set":"location|space|studio|plaza|stadium","frame":"actor|detail|wide","cue":"palavra exata da fala",
"light":"day|dusk|night",
"items":[[nomeModelo,[x,y,z],[xFinal,yFinal,zFinal],escala,movimento],...]}.
Use entre 1 e 8 itens. Movimentos: still travel arc spin pulse appear dim fall.
O primeiro item é o foco da câmera. Mundo: x entre -2 e 2, y entre 0 e 4 (chão=0), z entre -2 e 1.
Escala é a dimensão visual: use 1 a 2.5 para o assunto principal. Em actor, o ator fica à esquerda,
coloque o objeto à direita. Em detail/space mostre somente a ação importante. Use luz viajando ENTRE
emissor e receptor para propagação; coloque o pulso como primeiro item e ambos os extremos em tela
em plano wide. Evite enfiar objetos uns nos outros. Construa os objetos do tema específico;
não use Sol/Terra em temas sem astronomia. Use o mesmo nome para reutilizar cada modelo.
A palavra cue marca o início da ação principal e seu efeito sonoro. JSON compacto, sem código externo."""

PROMPT_MISSING_MODELS = """Crie APENAS os modelos 3D pedidos em "faltando" usando Three.js declarativo.
Retorne somente JSON: {"models":{"nome":[parte,...]}}.
Cada parte: [forma, corHex, [x,y,z], [lx,ly,lz], [rx,ry,rz]] (espaço local centrado em 0, ~1 unidade total, rotação em graus opcional).
Opcional na 6a posição: {"pivot":[x,y,z],"rotate":[gx,gy,gz],"slide":[dx,dy,dz]}.
Formas: box, sphere, cylinder, cone, ring, globe, sun, light, clock, performer.
Máximo 10 partes por modelo, silhueta reconhecível, cores vivas e contrastantes (#rrggbb)."""

PROMPT_MISSING_ANIMATIONS = """Crie APENAS as animações corporais pedidas em "faltando" para o personagem cartoon 3D.
Retorne somente JSON: {"animations":{"nome":{"loop":false,"keyframes":[...]}}}.
Cada keyframe (2 a 5 por animação, ordenados por "at" de 0.0 a 1.0):
{"at":0.0, "x":0, "y":0, "z":0, "roll":0, "arms":"down|up|hold|point|head|chest|box|shrug", "mood":"shock|worry|panic|grin|laugh|angry|deadpan|smile", "squash":0, "hunch":0, "tilt":0, "nerv":0, "sweat":0, "air":0, "walk":0, "speed":0, "lookX":0, "shake":0}
Opcional: "armR":[dx,dy], "armL":[dx,dy] (braços IK relativos ao corpo, dx -0.5..0.5, dy 0.1..1.0). Omita campos zerados para economizar tokens."""


def vec(value, lo, hi):
    if not isinstance(value, list) or len(value) != 3 or not all(
            type(v) in (int, float) and math.isfinite(v) and lo <= v <= hi for v in value):
        raise ValueError(f"Vetor 3D fora do intervalo {lo} a {hi}: {str(value)[:70]}")
    return value


def _clamp_num(val, lo, hi, default=0.0):
    if type(val) in (int, float) and math.isfinite(val):
        return max(lo, min(hi, float(val)))
    return default


def validate_models(models):
    if not isinstance(models, dict) or not 1 <= len(models) <= 200:
        raise ValueError("Entregue uma biblioteca com modelos válidos.")
    clean = {}
    for name, parts in models.items():
        if not name or len(name) > 80 or not isinstance(parts, list) or not 1 <= len(parts) <= 18:
            raise ValueError("Nome ou quantidade de peças inválida.")
        valid_parts = []
        for part in parts:
            if not isinstance(part, list) or len(part) not in (4, 5, 6) or part[0] not in SHAPES:
                raise ValueError(f"Peça inválida em {name}.")
            p = list(part)
            color = p[1]
            if isinstance(color, str):
                color = color.strip()
                if re.fullmatch(r"[\da-fA-F]{3}|[\da-fA-F]{6}", color):
                    color = "#" + color
                if re.fullmatch(r"#[\da-fA-F]{3}", color):
                    color = "#" + "".join(ch * 2 for ch in color[1:])
                if not re.fullmatch(r"#[\da-fA-F]{6}", color):
                    raise ValueError(f"Cor inválida em {name}: {color[:40]}. Use #rrggbb.")
                p[1] = color.lower()
            else:
                raise ValueError(f"Cor inválida em {name}. Use #rrggbb.")
            vec(p[2], -6, 6)
            vec(p[3], .001, 12)
            if len(p) >= 5:
                vec(p[4], -720, 720)
            if len(p) == 6:
                joint = p[5]
                if not isinstance(joint, dict):
                    raise ValueError(f"Articulação inválida em {name}.")
                vec(joint.get("pivot"), -6, 6)
                vec(joint.get("rotate"), -1440, 1440)
                vec(joint.get("slide"), -6, 6)
            valid_parts.append(p)
        clean[name] = valid_parts
    return clean


def validate_animations(anims):
    if not isinstance(anims, dict):
        raise ValueError("As animações precisam ser um objeto.")
    clean = {}
    for name, spec in anims.items():
        if not name or not isinstance(spec, dict):
            raise ValueError(f"Definição inválida para animação {name}.")
        kfs = spec.get("keyframes")
        if not isinstance(kfs, list) or len(kfs) < 2:
            raise ValueError(f"A animação {name} precisa de pelo menos 2 keyframes.")
        norm_kfs = []
        for idx, kf in enumerate(kfs[:8]):
            if not isinstance(kf, dict):
                raise ValueError(f"Keyframe inválido em {name}.")
            at = _clamp_num(kf.get("at"), 0.0, 1.0, idx / max(1, len(kfs) - 1))
            entry = {"at": round(at, 3)}
            for axis, lo, hi in (("x", -4.0, 4.0), ("y", -1.0, 4.0), ("z", -4.0, 4.0),
                                 ("roll", -3.15, 3.15), ("squash", -0.45, 0.45),
                                 ("hunch", -0.4, 0.7), ("tilt", -0.8, 0.8),
                                 ("nerv", 0.0, 1.0), ("sweat", 0.0, 1.0),
                                 ("walk", 0.0, 22.0), ("speed", 0.0, 1.0),
                                 ("lookX", -1.0, 1.0), ("shake", 0.0, 0.25)):
                if axis in kf and kf[axis] is not None:
                    entry[axis] = round(_clamp_num(kf[axis], lo, hi), 3)
            if "air" in kf:
                entry["air"] = 1 if kf["air"] else 0
            if "flip" in kf:
                entry["flip"] = bool(kf["flip"])
            if kf.get("arms") in ARMS:
                entry["arms"] = kf["arms"]
            if kf.get("mood") in MOODS:
                entry["mood"] = kf["mood"]
            for ik in ("armR", "armL"):
                v = kf.get(ik)
                if isinstance(v, list) and len(v) == 2 and all(type(n) in (int, float) and math.isfinite(n) for n in v):
                    entry[ik] = [round(max(-0.7, min(0.7, float(v[0]))), 3), round(max(0.0, min(1.2, float(v[1]))), 3)]
            norm_kfs.append(entry)
        norm_kfs.sort(key=lambda item: item["at"])
        clean[name] = {
            "descricao": str(spec.get("descricao", ""))[:120],
            "loop": bool(spec.get("loop", False)),
            "keyframes": norm_kfs,
        }
    return clean


def validate(data, shots):
    if not isinstance(data, dict):
        raise ValueError("A direção precisa ser um objeto.")
    models = validate_models(data.get("models"))
    scenes = data.get("scenes")
    if not isinstance(scenes, list) or len(scenes) != len(shots):
        raise ValueError(f"Entregue exatamente {len(shots)} cenas na ordem.")
    for i, scene in enumerate(scenes):
        if not isinstance(scene, dict) or scene.get("set") not in SETS or scene.get("frame") not in FRAMES:
            raise ValueError(f"Set ou plano inválido na cena {i+1}.")
        items = scene.get("items")
        if scene.get("light", "day") not in ("day", "night", "dusk"):
            raise ValueError(f"Iluminação inválida na cena {i+1}.")
        if not isinstance(items, list) or not 1 <= len(items) <= 8:
            raise ValueError(f"A cena {i+1} precisa de um a oito itens.")
        for item in items:
            if not isinstance(item, list) or len(item) != 5 or not isinstance(item[0], str) or item[0] not in models or item[4] not in MOTIONS:
                raise ValueError(f"Referência ou movimento inválido na cena {i+1}.")
            vec(item[1], -8, 8)
            vec(item[2], -8, 8)
            if type(item[3]) not in (int, float) or not .015 <= item[3] <= 8:
                raise ValueError(f"Escala inválida na cena {i+1}.")
        cue = scene.get("cue")
        if not isinstance(cue, str) or not cue.strip() or len(cue) > 60:
            raise ValueError(f"Escolha uma palavra de ação para a cena {i+1}.")
    return {"models": models, "scenes": scenes}


def _extract_object_specs(shot, idx):
    """Normaliza objetos pedidos em uma cena (aceita lista de dicts ou strings)."""
    raw_objs = shot.get("objetos")
    if not isinstance(raw_objs, list) or not raw_objs:
        prop = shot.get("prop", "none")
        if prop and prop != "none":
            raw_objs = [prop]
        else:
            return []
    specs = []
    for k, entry in enumerate(raw_objs[:6]):
        if isinstance(entry, str) and entry.strip():
            x_pos = 1.1 if k == 0 else (-1.2 if k == 1 else 0.3 * k)
            specs.append({
                "nome": entry.strip(),
                "de": [x_pos, 1.2, -0.4],
                "para": [x_pos, 1.2, -0.4],
                "escala": 1.2,
                "mov": "pulse" if k == 0 else "still",
            })
        elif isinstance(entry, dict) and entry.get("nome"):
            de = entry.get("de")
            para = entry.get("para")
            if not (isinstance(de, list) and len(de) == 3 and all(type(v) in (int, float) and math.isfinite(v) for v in de)):
                de = [1.1 if k == 0 else -1.1, 1.2, -0.4]
            else:
                de = [max(-2.5, min(2.5, float(v))) for v in de]
            if not (isinstance(para, list) and len(para) == 3 and all(type(v) in (int, float) and math.isfinite(v) for v in para)):
                para = list(de)
            else:
                para = [max(-2.5, min(2.5, float(v))) for v in para]
            escala = _clamp_num(entry.get("escala"), 0.2, 4.0, 1.2)
            mov = entry.get("mov") if entry.get("mov") in MOTIONS else ("pulse" if k == 0 else "still")
            specs.append({"nome": str(entry["nome"]).strip(), "de": de, "para": para, "escala": escala, "mov": mov})
    return specs


def resolve_missing_assets(shots, models_lib, anims_lib):
    """Usa regex e slug para casar objetos e animações com os acervos locais.

    Retorna dicionário com contagens de reuso e listas de itens realmente faltantes.
    """
    missing_models = {}
    missing_anims = {}
    reused_models = set()
    reused_anims = set()

    for idx, shot in enumerate(shots):
        # 1. Objetos da cena
        for spec in _extract_object_specs(shot, idx):
            key, found = db.match_catalog_key(spec["nome"], models_lib, db.MODEL_REGEX_ALIASES)
            if found:
                reused_models.add(key)
            elif key not in missing_models:
                missing_models[key] = shot.get("fala", "")[:120]

        # 2. Animação corporal da cena
        anim_raw = shot.get("animacao") or shot.get("action") or "jump_back"
        akey, found_anim = db.match_catalog_key(anim_raw, anims_lib, db.ANIM_REGEX_ALIASES)
        if found_anim:
            reused_anims.add(akey)
        elif akey not in missing_anims:
            missing_anims[akey] = shot.get("fala", "")[:120]

    return {
        "missing_models": missing_models,
        "missing_anims": missing_anims,
        "reused_models": sorted(reused_models),
        "reused_anims": sorted(reused_anims),
    }


def ensure_missing_models(cfg, model_name, idea, missing_models, *, library=None):
    """Chama a IA APENAS se houver objetos faltantes no acervo e salva os novos para sempre."""
    if library is None:
        library = db.get_models_catalog()
    if not missing_models:
        return library, []

    payload = {
        "tema": idea[:180],
        "faltando": [{"nome": k, "contexto": v} for k, v in missing_models.items()],
    }
    created_names = []
    for attempt in range(2):
        try:
            res = api.chat(cfg, model_name, PROMPT_MISSING_MODELS, payload)
            raw_models = res.get("models") or res.get("novos_modelos") or res if isinstance(res, dict) else {}
            if not isinstance(raw_models, dict) or not raw_models:
                raise ValueError("Nenhum modelo retornado pela IA.")
            # Normaliza chaves pedidas para garantir correspondência por slug
            normalized = {}
            for k, parts in raw_models.items():
                target_key = db.slug(k)
                for req_k in missing_models:
                    if db.slug(req_k) == target_key:
                        target_key = req_k
                        break
                normalized[target_key] = parts
            valid_new = validate_models(normalized)
            library.update(valid_new)
            db.save_models_catalog(valid_new)
            created_names = sorted(valid_new.keys())
            return library, created_names
        except ValueError as exc:
            if attempt or str(exc).startswith(("API HTTP", "Conexão interrompida")):
                raise
            payload["correcao"] = str(exc)
    return library, created_names


def ensure_missing_animations(cfg, model_name, missing_anims, *, anims_library=None):
    """Chama a IA APENAS se houver animações faltantes no acervo e salva para reuso futuro."""
    if anims_library is None:
        anims_library = db.get_animations_catalog()
    if not missing_anims:
        return anims_library, []

    payload = {
        "faltando": [{"nome": k, "contexto": v} for k, v in missing_anims.items()],
    }
    created_names = []
    for attempt in range(2):
        try:
            res = api.chat(cfg, model_name, PROMPT_MISSING_ANIMATIONS, payload)
            raw_anims = res.get("animations") or res.get("animacoes") or res if isinstance(res, dict) else {}
            if not isinstance(raw_anims, dict) or not raw_anims:
                raise ValueError("Nenhuma animação retornada pela IA.")
            normalized = {}
            for k, spec in raw_anims.items():
                target_key = db.slug(k)
                for req_k in missing_anims:
                    if db.slug(req_k) == target_key:
                        target_key = req_k
                        break
                normalized[target_key] = spec
            valid_new = validate_animations(normalized)
            anims_library.update(valid_new)
            db.save_animations_catalog(valid_new)
            created_names = sorted(valid_new.keys())
            return anims_library, created_names
        except ValueError as exc:
            if attempt or str(exc).startswith(("API HTTP", "Conexão interrompida")):
                raise
            payload["correcao"] = str(exc)
    return anims_library, created_names


def build_stages_from_plan(plan, models_lib, anims_lib):
    """Monta `models`, `animations` e `stage` por cena sem gastar nenhum token extra."""
    used_models = {}
    used_anims = {}
    scenes = []
    shots = plan.get("shots", [])

    for idx, shot in enumerate(shots):
        # Resolve animação
        anim_req = shot.get("animacao") or shot.get("action") or "jump_back"
        anim_key, found_anim = db.match_catalog_key(anim_req, anims_lib, db.ANIM_REGEX_ALIASES)
        if not found_anim:
            anim_key = "jump_back" if idx == 0 else "shiver_sweat"
        shot["action"] = anim_key
        if anim_key in anims_lib:
            used_anims[anim_key] = anims_lib[anim_key]

        # Resolve objetos para stage.items
        specs = _extract_object_specs(shot, idx)
        items = []
        for spec in specs:
            mkey, found_m = db.match_catalog_key(spec["nome"], models_lib, db.MODEL_REGEX_ALIASES)
            if found_m and mkey in models_lib:
                used_models[mkey] = models_lib[mkey]
                items.append([mkey, spec["de"], spec["para"], spec["escala"], spec["mov"]])

        # Garante ao menos um modelo válido se a cena pediu objetos ou tem estágio
        env = shot.get("env", "office")
        default_set = "stadium" if env == "stadium" else ("space" if env in ("nature_space", "nature") else ("plaza" if env in ("city_street", "city", "street") else "location"))
        scene_set = shot.get("set") if shot.get("set") in SETS else default_set
        scene_frame = shot.get("frame") if shot.get("frame") in FRAMES else "actor"
        scene_light = shot.get("light") if shot.get("light") in ("day", "night", "dusk") else ("night" if env in ("apocalypse_red", "nature_space") else "day")
        words_in_fala = [w.strip(".,!?;:") for w in shot.get("fala", "").split() if w.strip(".,!?;:")]
        cue = shot.get("cue") if isinstance(shot.get("cue"), str) and shot.get("cue").strip() else (words_in_fala[0] if words_in_fala else "agora")

        scene = {
            "set": scene_set,
            "frame": scene_frame,
            "light": scene_light,
            "cue": cue[:60],
            "items": items,
        }
        scenes.append(scene)

    return {"models": used_models, "animations": used_anims, "scenes": scenes}


def create(cfg, request, shots, *, library=None, save_library=None):
    """Fluxo legado mantido para compatibilidade caso roteiro antigo não traga `objetos`."""
    if library is None:
        library = db.get_models_catalog()
    catalog_names = sorted(library.keys())

    payload = {
        "canal": request.get("profile", {}).get("name", "E Se no Brasil"),
        "tema": request.get("idea", ""),
        "cenas": [{"fala": s["fala"], "ambiente": s.get("env", "office"), "camera": s.get("cam", "push")} for s in shots],
        "modelos_no_acervo": catalog_names,
    }

    model_name = request.get("model", "claude-opus-5.5")

    # Etapa 1: só pede modelos novos caso falte
    for attempt in range(2):
        try:
            prompt_stage1 = (
                PROMPT +
                f"\nETAPA 1: Acervo atual: {', '.join(catalog_names)}.\n"
                'Crie apenas o que falta em {"models":{"nome":[parte,...]}} (ou {} se já bastar).'
            )
            res1 = api.chat(cfg, model_name, prompt_stage1, payload)
            if isinstance(res1, dict):
                new_models = res1.get("novos_modelos") or res1.get("models") or {}
                if isinstance(new_models, dict) and new_models:
                    valid_new = validate_models(new_models)
                    library.update(valid_new)
                    db.save_models_catalog(valid_new)
                    if save_library:
                        save_library(library)
            break
        except ValueError as exc:
            if attempt or str(exc).startswith(("API HTTP", "Conexão interrompida")):
                raise
            payload["correcao"] = str(exc)

    payload["models"] = sorted(library.keys())
    payload.pop("correcao", None)

    for attempt in range(2):
        try:
            prompt_stage2 = (
                PROMPT +
                '\nETAPA 2: Entregue APENAS {"scenes":[...]}.\n'
                f"Exatamente {len(shots)} cenas. Modelos disponíveis: {', '.join(payload['models'][:50])}."
            )
            res2 = api.chat(cfg, model_name, prompt_stage2, payload)
            scenes = res2.get("scenes") if isinstance(res2, dict) else None
            return validate({"models": library, "scenes": scenes}, shots)
        except ValueError as exc:
            if attempt or str(exc).startswith(("API HTTP", "Conexão interrompida")):
                raise
            payload["correcao"] = str(exc)
