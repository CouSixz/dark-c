"""Monta a edição autoral de O Sol apagou a partir da tomada já sincronizada."""
import json
import math
from array import array
from functools import lru_cache
from pathlib import Path
import random
import shutil
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import acervo as db
import producao as prod
import som_automatico as som

RATE = som.RATE
SOURCE = "2774028956b644118aca602aef0aebd9"
CHANNEL = "e-se-no-brasil"

@lru_cache(maxsize=128)
def instrument(kind, midi, length):
    freq = 440 * 2 ** ((midi-69)/12)
    rng = random.Random(midi)
    sample = array("h")
    drift = 0
    for i in range(round(length * RATE)):
        t = i / RATE
        a = math.tau * freq * t
        fade = min(1, t*140, (length-t)*42)
        if kind == "felt":
            value = (math.sin(a)+0.36*math.sin(2*a)+0.12*math.sin(3*a))*math.exp(-4*t)
        elif kind == "glass":
            value = (math.sin(a)+0.31*math.sin(2.73*a)+0.18*math.sin(4.11*a))*math.exp(-2.8*t)
        elif kind == "bow":
            value = (math.sin(a)+0.45*math.sin(a*1.005)+0.18*math.sin(2*a))*math.sin(math.pi*t/length)**1.5
        elif kind == "brush":
            drift = 0.82*drift + 0.18*rng.uniform(-1,1)
            value = drift*math.exp(-8*t)*3
        elif kind == "knock":
            value = math.sin(a+7*(1-math.exp(-40*t)))*math.exp(-14*t)
        else:
            value = math.sin(a + 12*math.sin(17*t))*math.exp(-3*t)
        sample.append(round(6800*value*fade))
    return sample


def soundtrack(props):
    duration = props["totalFrames"]/30
    music = array("i",[0])*round(duration*RATE)
    fx = array("i",[0])*len(music)
    shots = props["shots"]
    words = props["words"]
    cues = []
    # Motivo de três notas: no apartamento é piano abafado. No espaço,
    # a mesma figura se abre em quintas, com caudas de vidro e silêncio.
    bass = [50,46,48,45,50,53,46,48,45,43,46,45,55,50,53,48,55,50,46,45]
    for i, shot in enumerate(shots):
        at = shot["from"]/30
        length = shot["frames"]/30
        cosmic = 12 <= i <= 16
        root = bass[i]
        som.overlay(music,instrument("bow",root-12,round(length,2)),at,.83)
        tones = (12,19,26) if cosmic else (12,15,19)
        for n, degree in enumerate(tones):
            when = at + length*(.06,.39,.67)[n]
            som.overlay(music,instrument("glass" if cosmic else "felt",root+degree,1.3),when,.72 if cosmic else .88)
        if 5<=i<=11:
            for j in range(6):
                som.overlay(music,instrument("brush" if j%2 else "knock",39,.22),at+j*length/6,.68)
    # Os sons pontuais seguem a palavra de cada plano na montagem.
    accents = [
        ("apaga","knock",32),("explode","glass",95),("batem","knock",38),("morre","slide",60),
        ("café","glass",84),("lanterna","knock",79),("para","brush",48),("some","bow",47),
        ("aviões","slide",64),("vermelho","bow",43),("uivam","slide",74),("cima","glass",83),
        ("luz","glass",91),("breu","bow",42),("minuto","glass",86),("pontual","knock",82),
        ("oito","glass",86),("velas","brush",72),("noite","bow",45),("acontece","felt",69)]
    for shot,(word,kind,pitch) in zip(shots,accents):
        start,end = shot["from"]/30,(shot["from"]+shot["frames"])/30
        when = next((w["start"] for w in words if start<=w["start"]<end and
                     w["word"].casefold().startswith(word)),start+.35*(end-start))
        cues.append({"t":round(when,4),"sfx":kind,"palavra":word})
        som.overlay(fx,instrument(kind,pitch,.8),when,1.25)
        if word=="explode":
            for n in range(5):
                som.overlay(fx,instrument("glass",99+n*2,.25),when+.042*n,.48)
        elif word=="batem":
            som.overlay(fx,instrument("knock",33,.42),when+.24,1.1)
    return cues,music,fx


def main():
    source = db.ROOT/"producoes"/CHANNEL/SOURCE
    props = json.loads((source/"cenas.json").read_text("utf8"))
    if len(props["shots"]) != 20:
        raise ValueError("Esta direção requer as vinte falas do episódio do Sol.")
    job = db.uid()
    folder = source.parent/job
    folder.mkdir()
    for name in ("narracao.mp3","roteiro.json","roteiro.txt","marcas.json","voz.wav"):
        shutil.copy2(source/name,folder/name)
    props["composition"]="Sol"
    prod.atomic(folder/"cenas.json",props)
    with db.banco() as conn:
        row=conn.execute("SELECT idea,request FROM jobs WHERE id=?",(SOURCE,)).fetchone()
        req=json.loads(row["request"])
        req.update(edicao_de=SOURCE,composicao="Sol")
        conn.execute("INSERT INTO jobs(id,channel,idea,request,status,step) VALUES(?,?,?,?,?,?)",
                     (job,CHANNEL,row["idea"]+" · Edição autoral",db.pack(req),"produzindo","Compondo trilha e efeitos"))
    print(folder,flush=True)
    try:
        node,cli,ff=prod.bins()
        mix=som.mix(folder,folder/"voz.wav",props["shots"],props["totalFrames"]/30,ff,None,
                    prod.command,prod.atomic,score=soundtrack(props))
        db.update(job,"produzindo","Renderizando Lia e a viagem da luz")
        with tempfile.TemporaryDirectory(prefix="sol-cinema-") as tmp:
            public=Path(tmp)
            (public/"audio").mkdir()
            shutil.copy2(mix,public/"audio/mix.wav")
            args=[node,cli,"render","src/episodios/Sol.tsx","Sol",folder/"video.tmp.mp4",
                  f"--public-dir={public}",f"--props={folder/'cenas.json'}","--codec=h264",
                  "--audio-codec=aac","--concurrency=4","--log=warn"]
            try:
                prod.command([*args,"--gl=angle"],timeout=7200,cwd=prod.MOTOR)
            except ValueError:
                prod.command([*args,"--gl=swangle"],timeout=7200,cwd=prod.MOTOR)
        (folder/"video.tmp.mp4").replace(folder/"video.mp4")
        db.update(job,"pronto","Edição autoral · O Sol apagou",(folder/"video.mp4").relative_to(db.ROOT).as_posix())
    except Exception as exc:
        db.update(job,"pausado",str(exc)[:500])
        raise

if __name__=="__main__":
    main()

