"""Regressões da produção local, com roteiro e locução simulados."""
import copy
import json
import subprocess
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave

import producao as prod


def example():
    return {"fala": "O chão treme e a cidade inteira acorda.", "action": "run",
            "mood": "panic", "env": "city_street", "cam": "orbit", "trans": "whip", "sfx": "impact"}


class Pipeline(unittest.TestCase):
    def test_modelagem_e_cue_de_outro_tema(self):
        shots = [dict(example(),fala="A roda gira.")]
        models = {"roda":[["ring","#58e6c5",[0,0,0],[1,1,.2]]]}
        scene = {"set":"studio","frame":"detail","cue":"gira","items":[
            ["roda",[0,1,0],[1,1,0],1,"spin"]]}
        req={"model":"modelo-escolhido","profile":{"name":"Oficina"},"idea":"Bicicleta"}
        with patch.object(prod.api,"chat",side_effect=[{"models":models},{"scenes":[scene]}]) as chat:
            art=prod.direcao.create({},req,shots)
        self.assertEqual([c.args[1] for c in chat.call_args_list],["modelo-escolhido"]*2)
        shots[0]["stage"]=art["scenes"][0]
        props=prod.layout({"shots":shots,"models":art["models"]},{},shots[0]["fala"],3,3)
        self.assertEqual(props["shots"][0]["stage"]["beat"],props["words"][-1]["start"])
        invalid=copy.deepcopy(art)
        invalid["scenes"][0]["items"][0][0]="desconhecido"
        with self.assertRaises(ValueError):
            prod.direcao.validate(invalid,shots)

    def test_direcao_de_voz_preserva_marcas_faladas(self):
        shots=[{"fala":"Olha!"},{"fala":"O que mudou?"},{"fala":"A roda girou."}]
        plain="\n".join(s["fala"] for s in shots)
        sent=prod.voice_text("eleven_v4_turbo",shots)
        self.assertTrue(sent.startswith("[excited] Olha!"))
        self.assertEqual(prod.voice_text("eleven_multilingual_v2",shots),plain)
        marks={"characters":list(sent),"character_start_times_seconds":list(range(len(sent))),
               "character_end_times_seconds":list(range(1,len(sent)+1))}
        kept=prod.spoken_alignment(marks,sent)
        self.assertEqual("".join(kept["characters"]),plain)
        self.assertEqual(kept["character_start_times_seconds"][0],sent.index("Olha!"))

    def test_articulacao_de_tampa_limita_rotacao_e_deslocamento(self):
        joint={"pivot":[-.5,.2,0],"rotate":[0,0,105],"slide":[0,0,0]}
        data={"models":{"caixa":[["box","#cdf",[0,.2,0],[1,.1,.6],[0,0,0],joint]]},"scenes":[]}
        self.assertEqual(prod.direcao.validate(data,[])["models"]["caixa"][0][1],"#ccddff")
        joint["rotate"]=[0,float("nan"),0]
        with self.assertRaises(ValueError):
            prod.direcao.validate(data,[])

    def test_invalid_then_valid(self):
        fala_longa = "O chão treme agora e a cidade inteira acorda no susto com o barulho estranho vindo direto do horizonte de Brasília."
        good = {"shots": [dict(example(), fala=fala_longa) for _ in range(8)]}
        bad = copy.deepcopy(good)
        for shot in bad["shots"]:
            shot["fala"] = "Corra!"
        with patch.object(prod.db, "banco"), patch.object(prod.db, "history", return_value=[]), \
             patch.object(prod.api, "chat", side_effect=[bad, good]) as chat:
            plan = prod.create_plan({}, {"seconds": 61, "idea": "Cidade", "model": "mock",
                                         "profile": {}, "platform": "Shorts"}, "teste")
        self.assertEqual(chat.call_count, 2)
        self.assertEqual(len(plan["shots"]), 8)

    def test_upper_limit_without_alignment(self):
        for seconds in (61, 62, 63, 64, 65):
            plan = {"shots": [example() for _ in range(8)]}
            spoken = " ".join(s["fala"] for s in plan["shots"])
            props = prod.layout(plan, {}, spoken, 53, seconds)
            self.assertEqual(sum(s["frames"] for s in props["shots"]), seconds*30)
            self.assertTrue(all(150 <= s["frames"] <= 300 for s in props["shots"]))
            self.assertEqual(props["words"][-1]["end"], seconds)

    def test_alignment_and_mix(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            ff = prod.bins()[2]
            plan = {"shots": [example() for _ in range(8)]}
            spoken = "\n".join(s["fala"] for s in plan["shots"])
            original = folder / "original.wav"
            prod.command([ff, "-v", "error", "-f", "lavfi", "-i", "sine=frequency=235",
                          "-t", "72", "-ar", "48000", original])
            timing = {"characters": list(spoken),
                      "character_start_times_seconds": [72*(i/len(spoken))**1.1 for i in range(len(spoken))],
                      "character_end_times_seconds": [72*((i+1)/len(spoken))**1.1 for i in range(len(spoken))]}
            props = prod.layout(plan, timing, spoken, 72, 61)
            self.assertEqual(props["totalFrames"], 1830)
            self.assertTrue(all(150 <= s["frames"] <= 300 for s in props["shots"]))
            for shot, word in zip(props["shots"], props["words"][::8]):
                self.assertAlmostEqual(word["start"], shot["from"]/30, delta=0.002)
            voice = folder / "voz.wav"
            prod.fit_voice(ff, original, voice, props["shots"])
            mix = prod.mix_sfx(folder, voice, props["shots"], 61)
            with wave.open(str(mix)) as audio:
                self.assertEqual(audio.getnframes(), 61*audio.getframerate())
            measured = subprocess.run([str(ff), "-hide_banner", "-nostats", "-i", str(mix),
                                       "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                                      capture_output=True, check=True).stderr.decode()
            stats = json.loads(measured[measured.rindex("{"):measured.rindex("}")+1])
            self.assertAlmostEqual(float(stats["input_i"]), -14, delta=0.3)
            self.assertLessEqual(float(stats["input_tp"]), -1.5)
            self.assertNotEqual(mix.read_bytes(), voice.read_bytes())
            events = json.loads((mix.parent / "sfx-events.json").read_text())
            self.assertTrue({"scratch", "riser", "stamp", "whoosh"} <= {e["sfx"] for e in events})
            self.assertAlmostEqual(props["words"][-1]["end"], 61, places=3)

    def test_regex_acervo_reusa_e_cria_apenas_faltantes(self):
        models_lib = {
            "bola_futebol": [["sphere", "#ffffff", [0, 0, 0], [1, 1, 1]]],
            "trave_gol": [["box", "#ffffff", [0, 0, 0], [2, 2, 1]]],
        }
        anims_lib = {
            "jump_back": {"loop": False, "keyframes": [{"at": 0.0, "x": 0}, {"at": 1.0, "x": 1}]},
            "chutar_bola": {"loop": False, "keyframes": [{"at": 0.0, "x": -1}, {"at": 1.0, "x": 0}]},
        }
        shots = [
            {
                "fala": "A bola voa em direção ao gol!",
                "animacao": "chutar",  # casa por regex -> chutar_bola
                "objetos": [
                    {"nome": "Bola de Futebol", "de": [0, 1, 0], "para": [1, 2, 0], "escala": 1.1, "mov": "arc"},  # regex -> bola_futebol
                    {"nome": "apito_juiz", "de": [-1, 1, 0], "para": [-1, 1, 0], "escala": 0.8, "mov": "pulse"},  # faltante!
                ],
                "env": "stadium",
            },
            {
                "fala": "O juiz mergulha na piscina!",
                "animacao": "mergulhar_piscina",  # faltante!
                "objetos": ["trave"],  # regex -> trave_gol
                "env": "stadium",
            },
        ]
        res = prod.direcao.resolve_missing_assets(shots, models_lib, anims_lib)
        self.assertEqual(res["reused_models"], ["bola_futebol", "trave_gol"])
        self.assertEqual(res["reused_anims"], ["chutar_bola"])
        self.assertEqual(list(res["missing_models"].keys()), ["apito_juiz"])
        self.assertEqual(list(res["missing_anims"].keys()), ["mergulhar_piscina"])

        # Se nada faltar, NENHUMA chamada à API é feita (0 tokens!)
        with patch.object(prod.api, "chat") as no_chat:
            prod.direcao.ensure_missing_models({}, "mock", "Teste", {}, library=models_lib)
            prod.direcao.ensure_missing_animations({}, "mock", {}, anims_library=anims_lib)
        self.assertEqual(no_chat.call_count, 0)

        # Quando falta 1 modelo e 1 animação, cria apenas o que faltou e atualiza a biblioteca
        fake_model_resp = {"models": {"apito_juiz": [["cylinder", "#ffcc00", [0, 0, 0], [0.5, 0.3, 0.3]]]}}
        fake_anim_resp = {"animations": {"mergulhar_piscina": {"loop": False, "keyframes": [{"at": 0, "y": 1}, {"at": 1, "y": 0, "roll": -1.4}]}}}
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            with patch.object(prod.db, "MODELS_CATALOG", tmp_path / "m.json"), \
                 patch.object(prod.db, "ANIMATIONS_CATALOG", tmp_path / "a.json"), \
                 patch.object(prod.api, "chat", side_effect=[fake_model_resp, fake_anim_resp]):
                updated_m, created_m = prod.direcao.ensure_missing_models({}, "mock", "Futebol", res["missing_models"], library=dict(models_lib))
                updated_a, created_a = prod.direcao.ensure_missing_animations({}, "mock", res["missing_anims"], anims_library=dict(anims_lib))
                self.assertEqual(created_m, ["apito_juiz"])
                self.assertEqual(created_a, ["mergulhar_piscina"])
                built = prod.direcao.build_stages_from_plan({"shots": shots}, updated_m, updated_a)
                self.assertIn("apito_juiz", built["models"])
                self.assertIn("mergulhar_piscina", built["animations"])
                self.assertEqual(built["scenes"][0]["set"], "stadium")


if __name__ == "__main__":
    unittest.main()
