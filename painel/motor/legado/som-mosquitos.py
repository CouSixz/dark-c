"""Sonoplastia local determinística do episódio; não usa APIs nem altera a voz original."""
import array, json, math, random, subprocess, wave, shutil
from pathlib import Path
from datetime import datetime
ROOT=Path(__file__).resolve().parents[2]
EP=ROOT/'producoes/e-se-no-brasil/1444db5614a34900892748aaab4c9a0b'
FF=next((ROOT/'painel/motor/node_modules/@remotion').glob('compositor-*/ffmpeg.exe'))
OUT=EP/'audio'; OUT.mkdir(exist_ok=True)
backup=EP/'edicoes'/('som-'+datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True)
shutil.copy2(EP/'video.mp4',backup/'video-anterior.mp4')
shutil.copytree(OUT,backup/'audio-anterior',dirs_exist_ok=True)
SR=48000; DURATION=71.2; N=round(SR*DURATION)
marks=json.loads((EP/'marcas.json').read_text('utf8'))
voice=array.array('f',[0])*N
for c,a,b in zip(marks['characters'],marks['character_start_times_seconds'],marks['character_end_times_seconds']):
    if c.isalnum():
        for k in range(max(0,int((a-.045)*SR)),min(N,int((b+.12)*SR))): voice[k]=1
# Smooth attenuation envelope; 18 ms attack, 220 ms release.
duck=array.array('f',[0])*N
v=0
for k in range(N):
    target=voice[k]; v+=(target-v)*(1/(SR*(.018 if target>v else .22))); duck[k]=1-.65*v
fx=array.array('f',[0])*N; music=array.array('f',[0])*N
rng=random.Random(1444); events=[]
def event(scene,kind,start,dur,gain=-22,freq=650):
    assert math.isfinite(start) and math.isfinite(dur) and start>=0 and dur>0 and start+dur<=DURATION
    # Ganhos abaixo mantêm os efeitos 7 dB abaixo da versão v2.
    events.append(dict(cena=scene,som=kind,inicio_s=start,duracao_s=dur,ganho_db=gain,origem='sintese local original',frequencia_hz=freq))
    amp=10**(gain/20); phase=0; smooth=0
    for j in range(round(dur*SR)):
        k=round(start*SR)+j
        if k>=N: break
        t=j/SR; u=t/dur; edge=min(1,t/(.002 if kind=='relogio' else .008),(dur-t)/.025)
        if kind=='zumbido':
            hz=freq+25*math.sin(t*7); phase+=math.tau*hz/SR
            value=sum(math.sin(phase*h)/h for h in range(1,9))/1.7
            env=math.sin(math.pi*u)**.5*(.8+.2*math.sin(t*18))
        elif kind=='transicao':
            noise=rng.uniform(-1,1); smooth=.83*smooth+.17*noise
            value=smooth*2.5; env=math.sin(math.pi*u)**2
        elif kind=='agua':
            phase+=math.tau*(freq+500*u)/SR; value=math.sin(phase); env=math.exp(-u*7)*edge
        elif kind=='relogio':
            value=.6*math.sin(math.tau*freq*t)+.4*rng.uniform(-1,1); env=math.exp(-t*65)*edge
        elif kind=='vidro':
            value=(math.sin(math.tau*freq*t)+.3*math.sin(math.tau*freq*2.71*t))/1.3; env=math.exp(-u*5)*edge
        else:
            value=(math.sin(math.tau*freq*t)+.22*math.sin(math.tau*freq*2*t))/1.22; env=math.exp(-u*4)*edge
        fx[k]+=amp*value*env*edge*(.78+.22*duck[k])
# Cues derived from the nine scene boundaries and actual narration timings.
event(1,'zumbido',.15,2.9,-18,450)
event(1,'vidro',4.65,.6,-21,880)
# Silence is intentional at the opening of the bedroom.
event(2,'transicao',12.6,.65,-23)
event(3,'sinal',14,.45,-23,740)
event(3,'sinal',14.65,.4,-25,880)
for t in [21.2,30.08,39.12,48.4,63.28]: event(next(i+1 for i,v in enumerate([0,6.24,14,21.2,30.08,39.12,48.4,57.6,63.28]) if v==t),'transicao',t,.45,-22)
for j,t in enumerate([23.2,24.0,25.0,28.2]):event(4,'vidro',t,.32,-25,650+j*100)
event(5,'sinal',31.5,.4,-26,540)
for j,t in enumerate([43.0,43.5,44.1]):event(6,'agua',t,.35,-23,320+j*80)
for j,t in enumerate([50.7,52.1,55.9]):event(7,'sinal',t,.4,-25,700+j*130)
for t in [57.6,58.6,59.6]:event(8,'relogio',t,.16,-21,1700)
event(8,'vidro',57.6,1.4,-22,523)
event(8,'zumbido',58.9,3.7,-20,470)
for j,t in enumerate([64.0,65.2,67.3,69.2]):event(9,'vidro',t,.55,-26,523*2**(j/12))
# Light original marimba motif, sparse, ducked underneath speech.
notes=[261.63,329.63,392,493.88,440,392,329.63,293.66]
for idx,start in enumerate([x*1.2 for x in range(59)]):
    if 6.0<start<9.0:continue
    freq=notes[idx%len(notes)]
    for j in range(int(.8*SR)):
        k=round(start*SR)+j
        if k>=N:break
        t=j/SR; env=math.exp(-t*7)*min(1,t/.009)*min(1,(DURATION-k/SR)/1.2)
        music[k]+=.027*env*(math.sin(math.tau*freq*t)+.22*math.sin(math.tau*freq*3*t))*duck[k]
def wav(path,data):
    pcm=array.array('h',(round(max(-1,min(1,x))*32767) for x in data))
    with wave.open(str(path),'wb') as w:w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(pcm.tobytes())
for name,data in [('efeitos.wav',fx),('musica.wav',music)]:wav(OUT/name,data)
(OUT/'plano-sonoro.json').write_text(json.dumps({'duracao_s':DURATION,'eventos':events,'musica':'Motivo original de marimba sintetizada; silêncio na entrada do quarto.','ducking':'Música: até 9.1 dB; efeitos: até 1.34 dB. Ataque 18 ms, retorno 220 ms.'},ensure_ascii=False,indent=2),'utf8')
def run(args):return subprocess.run([str(FF),'-hide_banner','-y',*map(str,args)],check=True,capture_output=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
run(['-i',EP/'narracao.mp3','-i',OUT/'efeitos.wav','-i',OUT/'musica.wav','-filter_complex','[0:a][1:a][2:a]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-16:TP=-2:LRA=11[a]','-map','[a]','-ar',SR,'-ac',2,'-t',DURATION,OUT/'mixagem.wav'])
run(['-i',EP/'video.mp4','-i',OUT/'mixagem.wav','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',DURATION,'-movflags','+faststart',EP/'video-com-som.mp4'])
check=run(['-i',EP/'video-com-som.mp4','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-c:a','pcm_s16le','-vn','-'])
log=check.stderr.decode('utf8','replace');(OUT/'verificacao-loudness.txt').write_text(log,'utf8')
metrics=json.loads(log[log.rfind('{'):log.rfind('}')+1]);assert float(metrics['input_tp'])<=-1.5,metrics
(EP/'video-com-som.mp4').replace(EP/'video.mp4')
print(json.dumps({'eventos':len(events),'loudness':metrics['input_i'],'true_peak':metrics['input_tp'],'video':str(EP/'video.mp4')},ensure_ascii=False))
