"""API do estúdio, acessível apenas pelo navegador neste computador."""
import json
import os
import re
import shutil
import subprocess
import webbrowser
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs

import acervo as db
import producao as prod
import provedores as api

PLATFORMS=["TikTok e YouTube Shorts","TikTok","YouTube Shorts"]
ASSETS={"/":("index.html","text/html"),"/app.js":("painel/app.js","text/javascript"),
        "/estilo.css":("painel/estilo.css","text/css")}
CHECK="Confira o consumo no provedor. Uma nova tentativa pode repetir a última chamada."


def state():
    with db.banco() as c:
        channels=[{"id":r["id"],**json.loads(r["profile"])} for r in c.execute("SELECT * FROM channels ORDER BY rowid")]
        jobs=[dict(r) for r in c.execute("SELECT id,channel,idea,status,step,output,created FROM jobs ORDER BY created DESC,rowid DESC")]
        batches={r[0]:json.loads(r[1]) for r in c.execute("SELECT channel,batch FROM ideas")}
    for j in jobs:
        has_mp4 = bool(j["output"]) or (db.ROOT/"producoes"/j["channel"]/j["id"]/"video.mp4").is_file()
        j["output"]=has_mp4
        j["prompt"]=(db.ROOT/"producoes"/j["channel"]/j["id"]/"prompt-claude-code.md").is_file()
    prefs={}
    for provider in ("experiential","eleven"):
        saved=db.setting(provider,{})
        item={k:v for k,v in saved.items() if k!="key"}
        try:
            key=db.get_api_key(provider)
            item["key_ok"]=True
            if not item.get("catalog"):
                try:
                    cat=api.catalog_experiential(key) if provider=="experiential" else api.catalog_voice(key)
                    item["catalog"]=cat
                    db.save_setting(provider,{**item,"key":key})
                except Exception:
                    pass
        except Exception:
            item["key_ok"]=False
        prefs[provider]=item
    return {
        "channels": channels,
        "jobs": jobs,
        "batches": batches,
        "acervo": {
            "modelos": len(db.get_models_catalog()),
            "animacoes": len(db.get_animations_catalog()),
        },
        **prefs,
    }


def connect(body):
    provider=body["provider"]
    if provider not in ("experiential","eleven"): raise ValueError("Provedor inválido.")
    prev_key=""
    try: prev_key=db.get_api_key(provider)
    except Exception: pass
    key=body.get("key","").strip() or prev_key
    if not key: raise ValueError("Informe a chave de API.")
    catalog=api.catalog_experiential(key) if provider=="experiential" else api.catalog_voice(key)
    obj={"catalog":catalog}

    env_var = "EXPERIENTIAL_KEY" if provider == "experiential" else "ELEVENLABS_API_KEY"
    db.save_env_key(env_var, key)

    try: crypted=db.crypt(key)
    except Exception: crypted=key
    db.save_setting(provider,{**obj,"key":crypted})
    return obj


def check_provider_keys():
    """Confirma que as credenciais do .env ou cofre estão prontas."""
    try:
        db.get_api_key("experiential")
        db.get_api_key("eleven")
    except Exception as ex:
        raise ValueError(f"Chave de API ausente ({ex}). Salve no arquivo .env ou em Configurações.")


def channel(body):
    profile={}
    for name,limit in [("name",70),("description",1100),("hook",350),("style",500),("voice",350),("link",500)]:
        value=body.get(name,"").strip()
        if value or name in ("name","description"): profile[name]=prod.text(value,limit)
        else: profile[name]=""
    if profile["link"] and urlsplit(profile["link"]).scheme not in ("https","http"): raise ValueError("Use um link http ou https.")
    cid=body.get("id","") or db.uid()
    if not re.fullmatch(r"[a-z0-9-]+",cid): raise ValueError("Identificador de canal inválido.")
    with db.banco() as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("INSERT OR REPLACE INTO channels VALUES (?,?)",(cid,db.pack(profile)))
        used=db.history(cid,c)
        for line in body.get("published","").splitlines():
            if not line.strip(): continue
            idea=prod.text(line,260)
            if any(db.similar(idea,x) for x in used): continue
            c.execute("INSERT INTO jobs(id,channel,idea,request,status,step) VALUES(?,?,?,'{}','publicado','Informado pelo canal')",(db.uid(),cid,idea));used.append(idea)
    return {"id":cid}


def reserve(body):
    for field in ("channel","model","tts","voice","seconds","platform","idea"):
        if field not in body: raise ValueError(f"Campo obrigatório ausente: {field}")
    cid=body["channel"];profile=db.channel(cid);prod.bins()
    a=db.setting("experiential",{}).get("catalog",{});e=db.setting("eleven",{}).get("catalog",{})
    if body["model"] not in a.get("text",[]) or body["tts"] not in e.get("models",[]) or body["voice"] not in [v["id"] for v in e.get("voices",[])]:
        raise ValueError("Conecte as contas e selecione modelos e voz válidos.")
    seconds=body["seconds"]
    if type(seconds)!=int or not 61<=seconds<=65 or body["platform"] not in PLATFORMS: raise ValueError("Confira a plataforma e a duração de 61 a 65 segundos.")
    # O catálogo pode continuar salvo mesmo quando a chave foi cifrada por
    # outra conta/perfil do Windows. Valide o cofre antes de criar o job;
    # assim o erro aparece no clique e não como um episódio órfão assíncrono.
    check_provider_keys()
    idea=prod.text(body["idea"],260);job=db.uid()
    req={k:body[k] for k in ("model","tts","voice","platform","seconds")}
    with db.banco() as c:
        c.execute("BEGIN IMMEDIATE")
        if any(db.similar(idea,old) for old in db.history(cid,c)): raise ValueError("Este assunto já está reservado ou produzido neste canal.")
        c.execute("INSERT INTO jobs(id,channel,idea,request,status,step) VALUES(?,?,?,?,'produzindo','Na fila local')",
                  (job,cid,idea,db.pack({**req,"idea":idea,"profile":profile})))
    prod.launch(job);return {"id":job}


def resume(body):
    with db.banco() as c:
        c.execute("BEGIN IMMEDIATE")
        r=c.execute("SELECT * FROM jobs WHERE id=? AND status='pausado'",(body["id"],)).fetchone()
        if not r: raise ValueError("Esta produção já está ativa ou encerrada.")
        check_provider_keys()
        path=db.ROOT/"producoes"/r["channel"]/r["id"]/"progresso.json"
        if path.exists():
            cp=json.loads(path.read_text("utf8"))
            if cp.get("incerto"):
                # Versões anteriores marcavam a etapa antes de tentar abrir
                # o DPAPI. Esse caso é local e não representa consumo pago.
                local_vault_error="cofre" in (r["step"] or "").lower() or "chaves salvas" in (r["step"] or "").lower()
                if not local_vault_error and body.get("again") is not True: return {"confirm":CHECK}
                cp.pop("incerto");prod.atomic(path,cp)
        c.execute("UPDATE jobs SET status='produzindo',step='Retomando' WHERE id=?",(r["id"],))
    prod.launch(r["id"]);return {"id":r["id"]}


def voice_preview(voice_id):
    if not voice_id or not re.fullmatch(r"[\w-]{1,64}", voice_id):
        raise ValueError("Identificador de voz inválido.")
    cfg = db.setting("eleven", {})
    plain_key = db.crypt(cfg["key"], True) if cfg.get("key") else ""
    dest = db.ROOT / "painel" / "dados" / "amostras_voz" / f"{voice_id}.mp3"
    api.preview_voice_audio({**cfg, "plain_key": plain_key}, voice_id, dest)
    db.save_setting("eleven", {k: v for k, v in cfg.items() if k != "plain_key"})
    return dest


def open_folder(body):
    jid = body.get("id", "")
    with db.banco() as c:
        r = c.execute("SELECT channel, id FROM jobs WHERE id=?", (jid,)).fetchone()
    if not r:
        raise ValueError("Produção não encontrada.")
    folder = (db.ROOT / "producoes" / r["channel"] / r["id"]).resolve()
    if not folder.is_dir():
        raise ValueError("Pasta deste episódio não encontrada no disco.")
    try:
        if hasattr(os, "startfile"):
            os.startfile(str(folder))
        else:
            subprocess.Popen(["explorer.exe", str(folder)])
    except Exception as e:
        raise ValueError(f"Não foi possível abrir a pasta: {e}")
    return {"opened": True, "path": str(folder)}


def rerender(body):
    jid = body.get("id", "")
    with db.banco() as c:
        c.execute("BEGIN IMMEDIATE")
        r = c.execute("SELECT id, channel, status FROM jobs WHERE id=?", (jid,)).fetchone()
        if not r:
            raise ValueError("Produção não encontrada.")
        if r["status"] == "produzindo":
            raise ValueError("Este episódio já está sendo renderizado.")
        c.execute("UPDATE jobs SET status='produzindo',step='Re-renderizando localmente (0 tokens)...' WHERE id=?", (jid,))
    prod.launch_rerender(jid)
    return {"id": jid}


class Studio(BaseHTTPRequestHandler):
    def log_message(self,*args): pass

    def reply(self,status,data,mime="application/json"):
        if not isinstance(data,bytes): data=db.pack(data).encode()
        self.send_response(status);self.send_header("Content-Type",mime+"; charset=utf-8")
        self.send_header("Cache-Control","no-store");self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(data)));self.end_headers();self.wfile.write(data)

    def local(self):
        return self.headers.get("Host")==f"127.0.0.1:{self.server.server_port}"

    def do_HEAD(self):
        path=urlsplit(self.path).path
        if not self.local(): return self.reply(403,{"error":"Origem inválida."})
        if path=="/api/voice-preview":
            query=parse_qs(urlsplit(self.path).query)
            voice_id=query.get("voice",[""])[0]
            try:
                dest=voice_preview(voice_id)
                self.send_response(200);self.send_header("Content-Type","audio/mpeg")
                self.send_header("Content-Length",str(dest.stat().st_size))
                self.send_header("Accept-Ranges","bytes")
                self.send_header("Cache-Control","public, max-age=86400")
                self.end_headers()
                return
            except ValueError as ex: return self.reply(400,{"error":str(ex)})
            except Exception: return self.reply(500,{"error":"Não foi possível carregar a amostra da voz."})
        self.reply(404,{"error":"Arquivo indisponível."})

    def do_GET(self):
        path=urlsplit(self.path).path
        if not self.local(): return self.reply(403,{"error":"Origem inválida."})
        if path=="/api/state": return self.reply(200,state())
        if path=="/api/audio":
            query=parse_qs(urlsplit(self.path).query)
            jid=query.get("id",[""])[0]
            with db.banco() as c: r=c.execute("SELECT channel, id FROM jobs WHERE id=?",(jid,)).fetchone()
            if r:
                folder=(db.ROOT/"producoes"/r["channel"]/r["id"]).resolve()
                for audio_name,mime in [("narracao.mp3","audio/mpeg"),("voz.wav","audio/wav")]:
                    target=folder/audio_name
                    if target.is_file():
                        self.send_response(200);self.send_header("Content-Type",mime)
                        self.send_header("Content-Length",str(target.stat().st_size))
                        self.send_header("Cache-Control","no-cache")
                        self.end_headers()
                        with target.open("rb") as f: shutil.copyfileobj(f,self.wfile)
                        return
            return self.reply(404,{"error":"Áudio não encontrado."})
        if path=="/api/prompt":
            query=parse_qs(urlsplit(self.path).query)
            jid=query.get("id",[""])[0]
            with db.banco() as c: r=c.execute("SELECT channel, id FROM jobs WHERE id=?",(jid,)).fetchone()
            if r:
                prompt_file=db.ROOT/"producoes"/r["channel"]/r["id"]/"prompt-claude-code.md"
                if prompt_file.is_file():
                    return self.reply(200,{"prompt":prompt_file.read_text("utf8")})
            return self.reply(404,{"error":"Prompt para Claude Code ainda não gerado neste episódio."})
        if path=="/api/voice-preview":
            query=parse_qs(urlsplit(self.path).query)
            voice_id=query.get("voice",[""])[0]
            try:
                dest=voice_preview(voice_id)
                self.send_response(200);self.send_header("Content-Type","audio/mpeg")
                self.send_header("Content-Length",str(dest.stat().st_size))
                self.send_header("Accept-Ranges","bytes")
                self.send_header("Cache-Control","public, max-age=86400")
                self.end_headers()
                with dest.open("rb") as f: shutil.copyfileobj(f,self.wfile)
                try: self.wfile.flush()
                except Exception: pass
                return
            except ValueError as ex: return self.reply(400,{"error":str(ex)})
            except Exception: return self.reply(500,{"error":"Não foi possível carregar a amostra da voz."})
        if path in ASSETS:
            file,mime=ASSETS[path];return self.reply(200,(db.ROOT/file).read_bytes(),mime)
        if path.startswith("/arquivo/"):
            jid = path.split("/")[-1]
            with db.banco() as c: r=c.execute("SELECT output, channel, id FROM jobs WHERE id=?",(jid,)).fetchone()
            if r:
                file = (db.ROOT/r["output"]).resolve() if r["output"] else (db.ROOT/"producoes"/r["channel"]/r["id"]/"video.mp4").resolve()
                if file.is_relative_to((db.ROOT/"producoes").resolve()) and file.is_file():
                    self.send_response(200);self.send_header("Content-Type","video/mp4");self.send_header("Content-Length",str(file.stat().st_size))
                    self.end_headers()
                    with file.open("rb") as f: shutil.copyfileobj(f,self.wfile)
                    return
        self.reply(404,{"error":"Arquivo indisponível."})

    def do_POST(self):
        if not self.local() or self.headers.get("Origin")!="http://"+self.headers.get("Host","") or self.headers.get_content_type()!="application/json":
            return self.reply(403,{"error":"Reabra pelo inicializador local."})
        try:
            size=int(self.headers.get("Content-Length",0))
            if not 1<=size<=65536: raise ValueError("Tamanho de formulário inválido.")
            body=json.loads(self.rfile.read(size))
            action={"/api/connect":connect,"/api/channel":channel,
                    "/api/ideas":lambda b:{"ideas":prod.ideas(b.get("channel",""),b.get("model",""))},
                    "/api/generate":reserve,"/api/resume":resume,
                    "/api/rerender":rerender,
                    "/api/open-folder":open_folder}.get(self.path)
            if not action: return self.reply(404,{"error":"Rota desconhecida."})
            self.reply(200,action(body))
        except ValueError as ex: self.reply(400,{"error":str(ex)[:600]})
        except (KeyError,TypeError,AttributeError) as ex: self.reply(400,{"error":f"Resposta de API ou formulário incompatível ({type(ex).__name__}: {str(ex)[:150]}). Confira o modelo selecionado."})
        except Exception: self.reply(500,{"error":"Falha local ao concluir a operação."})


if __name__=="__main__":
    address="http://127.0.0.1:8764"
    try: server=ThreadingHTTPServer(("127.0.0.1",8764),Studio)
    except OSError:
        conn=HTTPConnection("127.0.0.1",8764,timeout=2)
        try:
            conn.request("GET","/api/state")
            if "channels" not in json.load(conn.getresponse()): raise ValueError("Porta 8764 ocupada.")
        finally:
            conn.close()
        webbrowser.open(address)
    else:
        db.init()
        print("Estúdio Corte — "+address,flush=True);webbrowser.open(address)
        with server: server.serve_forever()
