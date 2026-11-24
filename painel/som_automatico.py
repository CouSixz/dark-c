"""Trilha instrumental e sonoplastia locais. Todas as posições usam o relógio da montagem."""
from array import array
import json
import math
import shutil
import subprocess
import wave

RATE = 48000
NORMALIZE = "loudnorm=I=-14:TP=-1.5:LRA=7"


def events_for(shots):
    result = []
    total = len(shots)
    for i, shot in enumerate(shots):
        start = shot["from"] / 30
        length = shot["frames"] / 30
        cues = set()

        action = shot.get("action")
        sfx_req = shot.get("sfx")

        if i == total - 2:
            cues.add((0.0, "scratch"))
        elif i == total - 3:
            cues.add((0.0, "riser"))
        elif action == "run" and i % 3 == 0:
            cues.add((0.3, "stamp"))
        elif shot.get("trans") == "whip" and i % 2 == 1:
            cues.add((0.0, "whoosh"))
        elif sfx_req in {"impact", "alarm", "chime", "riser", "ding", "pop", "click"}:
            cues.add((0.2, sfx_req))
        elif action in {"shock", "jump_back"}:
            cues.add((0.4, "impact"))
        elif action in {"sweat_panic", "shiver_sweat"}:
            cues.add((0.3, "alarm"))

        if i == total - 1 and not cues:
            cues.add((0.5, "chime"))

        # At most 1 SFX per shot to maintain professional, clear audio
        chosen = sorted(cues)[:1]

        result.extend({"t": round(start + dt, 5), "sfx": name}
                      for dt, name in chosen if dt < length)
    return result


def note(freq, duration, bass=False, sweep=0):
    samples = array("h")
    for i in range(round(duration * RATE)):
        t = i / RATE
        phase = math.tau * (freq * t + sweep * t * t / 2)
        env = min(1, t * 160, (duration - t) * 60) * math.exp(-t * (4 if bass else 8))
        samples.append(round(5700 * env * (math.sin(phase) + 0.3 * math.sin(phase * 3))))
    return samples


def read_pcm(path):
    with wave.open(str(path)) as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1, 2, RATE):
            raise ValueError(f"Formato de áudio incompatível: {path.name}")
        return array("h", w.readframes(w.getnframes()))


def write_pcm(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        w.writeframes(samples.tobytes())


def overlay(track, sound, start, gain):
    offset = round(start * RATE)
    for i in range(min(len(sound), len(track) - offset)):
        track[offset+i] += round(sound[i] * gain)


def stems(shots, duration, cues, library):
    music = array("i", [0]) * round(duration * RATE)
    fx = array("i", [0]) * len(music)
    tense = sum(s.get("mood") in ("shock", "panic", "worry", "angry") for s in shots) >= len(shots)/2
    scale = [0, 3 if tense else 4, 7, 10 if tense else 12]
    beat = 0.48 if tense else 0.54
    cache = {}
    scene_index = 0
    for i in range(math.ceil(duration * 2 / beat)):
        when = i * beat / 2
        while scene_index+1 < len(shots) and when >= shots[scene_index+1]["from"]/30:
            scene_index += 1
        stage = shots[scene_index].get("stage",{})
        space = stage.get("set") == "space"
        if stage and (when < .32 or (space and i%2) or (stage.get("light")=="night" and i%4==3)):
            continue
        bass = i % 4 == 0
        root = (0, -5, -2, -7)[i // 16 % 4]
        pitch = root + (0 if bass else scale[(0, 2, 1, 3, 1, 2, 3, 0)[i % 8]])
        key = (pitch, bass, space)
        if key not in cache:
            cache[key] = note((110 if bass else 660 if space else 440) * 2 ** (pitch/12),
                              beat * (2.4 if space else 1.6 if bass else 0.9), bass)
        overlay(music, cache[key], when, 1.2 if bass else 0.85)
        if space and not bass:
            overlay(music, cache[key], when+.18, .23)
    sounds = {"alarm": note(620, 0.38, sweep=750), "scratch": note(720, 0.19, sweep=-3600)}
    for cue in cues:
        name = cue["sfx"]
        if name not in sounds:
            sounds[name] = read_pcm(library / (name + ".wav"))
        overlay(fx, sounds[name], cue["t"], 0.27)
    return music, fx


def duck(music, fx, voice):
    # Detector RMS de dez milissegundos, com ataque rápido e retorno de 240 ms.
    gain = 1
    for start in range(0, len(music), 480):
        chunk = voice[start:start+480]
        rms = math.sqrt(sum(x*x for x in chunk) / max(1, len(chunk)))
        target = 10 ** (-16 * min(1, rms / 1100) / 20)
        end = gain + (target - gain) * (0.8 if target < gain else 0.04)
        for i in range(start, min(start+480, len(music))):
            g = gain + (end-gain) * (i-start)/480
            music[i] = round(music[i] * g)
            fx[i] = round(fx[i] * math.sqrt(g))
        gain = end


def mix(folder, voice, shots, duration, bundled, library, run, atomic, *, score=None):
    directory = folder / "audio"
    directory.mkdir(exist_ok=True)
    if score is None:
        cues = events_for(shots)
        music, fx = stems(shots, duration, cues, library)
    else:
        cues, music, fx = score
    atomic(directory / "sfx-events.json", cues)
    ff = shutil.which("ffmpeg") or str(bundled)
    native = b" sidechaincompress " in run([ff, "-hide_banner", "-filters"])
    normalized = directory / "voz-normalizada.wav"
    run([ff, "-y", "-v", "error", "-i", voice, "-af", NORMALIZE, "-ar", RATE, "-ac", 1, normalized])
    if not native:
        duck(music, fx, read_pcm(normalized))
    inputs = ["-i", normalized]
    for name, track in (("musica", music), ("efeitos", fx)):
        path = directory / (name + ".wav")
        write_pcm(path, array("h", (min(32767, max(-32768, x)) for x in track)))
        inputs.extend(["-i", path])
    graph = ("[0:a]asplit=3[v][key1][key2];"
             "[1:a][key1]sidechaincompress=threshold=0.026:ratio=8:attack=8:release=240[m];"
             "[2:a][key2]sidechaincompress=threshold=0.055:ratio=3:attack=5:release=120[e];"
             "[v][m][e]" if native else "[0:a][1:a][2:a]")
    graph += "amix=inputs=3:normalize=0," + NORMALIZE
    base = [str(ff), "-hide_banner", "-nostats", "-y", *map(str, inputs), "-filter_complex"]
    analysis = subprocess.run(base + [graph + ":print_format=json", "-f", "null", "-"],
                              capture_output=True, check=True).stderr.decode("utf8", "replace")
    stats = json.loads(analysis[analysis.rindex("{"):analysis.rindex("}")+1])
    if all(math.isfinite(float(stats["input_"+k])) for k in ("i","tp","lra","thresh")):
        graph += (f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
                  f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
                  f":offset={stats['target_offset']}:linear=true")
    tmp = directory / "mix.tmp.wav"
    run(base + [graph, "-ar", RATE, "-t", duration, tmp])
    tmp.replace(directory / "mix.wav")
    return directory / "mix.wav"
