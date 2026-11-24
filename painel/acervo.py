import base64
import ctypes
import difflib
import json
import os
import re
import sqlite3
import unicodedata
import uuid
from contextlib import contextmanager
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/"painel"/"dados"/"estudio.sqlite3"
ENV_FILE=ROOT/".env"


def load_env():
    """Lê o arquivo .env se existir e popula variáveis no os.environ e num dicionário."""
    vals = {}
    if ENV_FILE.is_file():
        try:
            content = ENV_FILE.read_text(encoding="utf8", errors="replace")
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                vals[k] = v
                os.environ[k] = v
        except Exception:
            pass
    return vals


def save_env_key(key_name, value):
    """Salva ou atualiza uma chave no arquivo .env preservando as outras linhas."""
    lines = []
    found = False
    if ENV_FILE.is_file():
        try:
            content = ENV_FILE.read_text(encoding="utf8", errors="replace")
            for line in content.splitlines():
                clean = line.strip()
                if clean and not clean.startswith("#") and "=" in clean:
                    k, _ = clean.split("=", 1)
                    if k.strip() == key_name:
                        lines.append(f"{key_name}={value}")
                        found = True
                        continue
                lines.append(line)
        except Exception:
            lines = []
    if not found:
        lines.append(f"{key_name}={value}")
    
    ENV_FILE.write_text("\n".join(lines).strip() + "\n", encoding="utf8")
    os.environ[key_name] = value


def get_api_key(provider):
    """Retorna a chave do provedor buscando prioritariamente no .env / os.environ."""
    load_env()
    key_aliases = {
        "experiential": ["EXPERIENTIAL_KEY", "EXPERIENTIAL_API_KEY", "GEMINI_API_KEY"],
        "eleven": ["ELEVEN_KEY", "ELEVENLABS_API_KEY", "ELEVEN_API_KEY"]
    }
    for alias in key_aliases.get(provider, []):
        val = os.environ.get(alias, "").strip()
        if val:
            return val
            
    # Fallback to stored database setting
    st = setting(provider, {})
    if st and st.get("key"):
        try:
            return crypt(st["key"], True)
        except Exception:
            raw = st.get("key", "").strip()
            if raw and not raw.endswith("="):
                return raw
    raise ValueError(f"Chave do provedor '{provider}' não encontrada. Defina no arquivo .env ou em Configurações.")



@contextmanager
def banco():
    conn=sqlite3.connect(DB,timeout=20)
    conn.row_factory=sqlite3.Row
    try:
        with conn: yield conn
    finally:
        conn.close()


def uid():
    return uuid.uuid4().hex


def pack(obj):
    return json.dumps(obj,ensure_ascii=False,separators=(",",":"))


def norm(s):
    return " ".join(re.findall(r"[a-z0-9]+",unicodedata.normalize("NFKD",s.lower()).encode("ascii","ignore").decode()))


def similar(a,b):
    a,b=norm(a),norm(b)
    if a==b: return True
    stop={"de","do","da","que","os","as","um","uma","para","como","qual","por","porque"}
    tokens=lambda s:{w for w in s.split() if len(w)>1 and w not in stop}
    x,y=tokens(a),tokens(b)
    return difflib.SequenceMatcher(None,a,b).ratio()>.87 or bool(x and y and len(x&y)/len(x|y)>.77)


def crypt(value,decode=False):
    """DPAPI no escopo da conta Windows. Retorna só texto cifrado ao armazenamento."""
    class Blob(ctypes.Structure):
        _fields_=[("size",ctypes.c_uint32),("data",ctypes.c_void_p)]
    raw=base64.b64decode(value) if decode else value.encode()
    buf=ctypes.create_string_buffer(raw)
    src=Blob(len(raw),ctypes.cast(buf,ctypes.c_void_p)); dst=Blob()
    fn=ctypes.windll.crypt32.CryptUnprotectData if decode else ctypes.windll.crypt32.CryptProtectData
    if not fn(ctypes.byref(src),None,None,None,None,1,ctypes.byref(dst)):
        raise ValueError("O Windows não conseguiu abrir o cofre desta conta.")
    try: data=ctypes.string_at(dst.data,dst.size)
    finally: ctypes.windll.kernel32.LocalFree(ctypes.c_void_p(dst.data))
    return data.decode() if decode else base64.b64encode(data).decode()


def init():
    DB.parent.mkdir(parents=True,exist_ok=True)
    with banco() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, profile TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,channel TEXT NOT NULL, idea TEXT NOT NULL,
          request TEXT NOT NULL,status TEXT NOT NULL,step TEXT NOT NULL,output TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS ideas (channel TEXT PRIMARY KEY, batch TEXT NOT NULL);
        """)
        c.execute("UPDATE jobs SET status='pausado',step='Estúdio reiniciado. Retome a produção.' WHERE status='produzindo'")
        seeds=Path(__file__).with_name("canais-iniciais.json")
        for profile in json.loads(seeds.read_text("utf8")):
            cid=profile.pop("id")
            c.execute("INSERT OR IGNORE INTO channels VALUES (?,?)",(cid,pack(profile)))
        for episode in (ROOT/"producoes").glob("*/*"):
            cid=episode.parent.name
            if not c.execute("SELECT 1 FROM channels WHERE id=?",(cid,)).fetchone(): continue
            if c.execute("SELECT 1 FROM jobs WHERE id=?",(episode.name,)).fetchone(): continue
            videos=sorted(episode.glob("*.mp4"),key=lambda p:("final" not in p.stem,p.name))
            if not videos or c.execute("SELECT 1 FROM jobs WHERE output=?",(str(videos[0].relative_to(ROOT)),)).fetchone(): continue
            title=episode.name.replace("-"," ")
            try:
                meta=json.loads((episode/"voz.json").read_text("utf-8-sig"))
                title=" — ".join(x for x in [meta.get("titulo"),meta.get("subtitulo")] if x) or title
            except (OSError,ValueError): pass
            c.execute("INSERT OR IGNORE INTO jobs(id,channel,idea,request,status,step,output) VALUES(?,?,?,'{}','pronto','Produção existente',?)",(episode.name,cid,title,str(videos[0].relative_to(ROOT))))



def setting(name,default=None):
    with banco() as c: row=c.execute("SELECT value FROM settings WHERE id=?",(name,)).fetchone()
    return json.loads(row[0]) if row else default


def save_setting(name,value):
    with banco() as c: c.execute("INSERT OR REPLACE INTO settings VALUES(?,?)",(name,pack(value)))


def channel(cid):
    with banco() as c: row=c.execute("SELECT profile FROM channels WHERE id=?",(cid,)).fetchone()
    if not row: raise ValueError("Selecione um canal cadastrado.")
    return json.loads(row[0])


def history(cid,conn):
    return [r[0] for r in conn.execute("SELECT idea FROM jobs WHERE channel=? ORDER BY created DESC",(cid,))]


def update(job,status,step,output=None):
    with banco() as c:
        c.execute("UPDATE jobs SET status=?,step=?,output=coalesce(?,output) WHERE id=?",(status,step,output,job))


MODELS_CATALOG = ROOT / "painel" / "dados" / "acervo_modelos.json"
ANIMATIONS_CATALOG = ROOT / "painel" / "dados" / "acervo_animacoes.json"

MODEL_REGEX_ALIASES = [
    (re.compile(r"^bola(?:_de)?(?:_futebol)?s?$"), "bola_futebol"),
    (re.compile(r"^(?:trave(?:_de)?(?:_gol)?|travessao|gol)s?$"), "trave_gol"),
    (re.compile(r"^balanca(?:_de_peso|_digital)?s?$"), "balanca"),
    (re.compile(r"^chuteira(?:_de_futebol)?s?$"), "chuteira"),
    (re.compile(r"^(?:trofeu|taca)s?$"), "trofeu"),
    (re.compile(r"^moeda(?:_de)?(?:_ouro|_1_real|_um_real)?s?$"), "moeda_ouro"),
    (re.compile(r"^(?:buraco_negro|singularidade)$"), "buraco_negro"),
    (re.compile(r"^(?:planeta_terra|globo(?:_terra)?|terra|planeta)$"), "globo_terra"),
    (re.compile(r"^(?:relogio|cronometro)s?$"), "relogio"),
    (re.compile(r"^(?:estadio|maracana|estadio_maracana)$"), "estadio_maracana"),
    (re.compile(r"^(?:arquibancada)s?$"), "arquibancada"),
    (re.compile(r"^(?:gramado|campo_futebol|campo_de_futebol)$"), "gramado"),
]

ANIM_REGEX_ALIASES = [
    (re.compile(r"^(?:jump_back|shock|susto|pulo_susto|pular_susto|recuar)$"), "jump_back"),
    (re.compile(r"^(?:shiver_sweat|sweat_panic|panico|suar_frio|nervoso)$"), "shiver_sweat"),
    (re.compile(r"^(?:run|correr|correndo|fuga|sprint)$"), "run"),
    (re.compile(r"^(?:point|apontar|indicar)$"), "point"),
    (re.compile(r"^(?:fall|cair|tombar|queda|escorregar)$"), "fall"),
    (re.compile(r"^(?:celebrate|comemorar|pular_alegria|festejar)$"), "celebrate"),
    (re.compile(r"^(?:drink|beber|segurar|tomar)$"), "drink"),
    (re.compile(r"^(?:look|olhar|observar|procurar)$"), "look"),
    (re.compile(r"^(?:chutar|chute|chutar_bola|bater_penalti)$"), "chutar_bola"),
    (re.compile(r"^(?:flutuar|gravidade_zero|voar|levitar)$"), "flutuar"),
    (re.compile(r"^(?:tremer_frio|frio|congelar|tremer)$"), "tremer_frio"),
    (re.compile(r"^(?:apontar_ceu|olhar_ceu|apontar_alto)$"), "apontar_ceu"),
    (re.compile(r"^(?:andar|caminhar|andar_pensativo)$"), "andar_pensativo"),
    (re.compile(r"^(?:comemorar_gol)$"), "comemorar_gol"),
]


def slug(name):
    """Normaliza um nome de objeto ou animação para snake_case ASCII."""
    clean = unicodedata.normalize("NFKD", str(name or "").lower()).encode("ascii", "ignore").decode()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", clean)).strip("_") or "item"


def match_catalog_key(name, catalog, alias_rules=()):
    """Casa um nome pedido contra o catálogo existente usando slug e regex.

    Retorna (chave_encontrada_ou_slug, True/False indicando se já existe no acervo).
    """
    if not isinstance(catalog, dict):
        return slug(name), False
    raw = str(name or "").strip()
    if raw in catalog:
        return raw, True
    key = slug(raw)
    if key in catalog:
        return key, True
    singular = key[:-1] if len(key) > 3 and key.endswith("s") else key
    if singular in catalog:
        return singular, True
    norm_map = {slug(k): k for k in catalog}
    if key in norm_map:
        return norm_map[key], True
    if singular in norm_map:
        return norm_map[singular], True
    for pattern, target in alias_rules:
        if pattern.fullmatch(key) and target in catalog:
            return target, True
    return key, False


def get_models_catalog():
    """Retorna o catálogo persistente de modelos 3D reutilizáveis."""
    if MODELS_CATALOG.is_file():
        try:
            return json.loads(MODELS_CATALOG.read_text("utf8"))
        except Exception:
            pass
    return {}


def save_models_catalog(models):
    """Atualiza o catálogo permanente de modelos 3D salvos para novos vídeos."""
    catalog = get_models_catalog()
    if isinstance(models, dict):
        catalog.update(models)
    MODELS_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    MODELS_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf8")
    return catalog


def get_animations_catalog():
    """Retorna o catálogo persistente de animações corporais em keyframes."""
    if ANIMATIONS_CATALOG.is_file():
        try:
            return json.loads(ANIMATIONS_CATALOG.read_text("utf8"))
        except Exception:
            pass
    return {}


def save_animations_catalog(animations):
    """Atualiza o catálogo permanente de animações salvos para novos vídeos."""
    catalog = get_animations_catalog()
    if isinstance(animations, dict):
        catalog.update(animations)
    ANIMATIONS_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    ANIMATIONS_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf8")
    return catalog

