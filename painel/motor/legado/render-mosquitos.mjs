import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';

const motor=path.dirname(fileURLToPath(import.meta.url));
const episode=path.resolve(motor,'../../producoes/e-se-no-brasil/1444db5614a34900892748aaab4c9a0b');
const read=name=>JSON.parse(fs.readFileSync(path.join(episode,name),'utf8'));
const source=read('cenas.json'),marks=read('marcas.json');
const chars=marks.characters,starts=marks.character_start_times_seconds,ends=marks.character_end_times_seconds;
assert.equal(chars.length,starts.length);assert.equal(chars.length,ends.length);
assert.equal(chars.join('').replace(/\s+/g,' ').trim(),source.shots.map(s=>s.fala).join(' '));
assert(starts.every((s,i)=>Number.isFinite(s)&&s>=0&&ends[i]>=s&&(!i||s>=starts[i-1])));
const totalFrames=2136;
const boundaries=[0,...chars.flatMap((c,i)=>c==='\n'?[Math.round(starts[i+1]*30)]:[]),totalFrames];
assert.equal(boundaries.length,10);
const captionGroups=[];
const shots=source.shots.map((s,index)=>({...s,from:boundaries[index],frames:boundaries[index+1]-boundaries[index]}));
let offset=0;
for(let scene=0;scene<9;scene++){
 const line=source.shots[scene].fala;
 const words=[...line.matchAll(/\S+/g)].map(m=>{
  const begin=offset+m.index,end=begin+m[0].length-1;
  return {text:m[0],from:Math.round(starts[begin]*30),to:Math.min(totalFrames,Math.ceil(ends[end]*30))};
 });
 let group=[];
 for(let i=0;i<words.length;i++){
  group.push(words[i]);
  if(group.length===4||(/[.!?]$/.test(words[i].text)&&group.length>=2)||i===words.length-1){
   captionGroups.push({from:group[0].from,to:Math.min(boundaries[scene+1],words[i+1]?.from??boundaries[scene+1]),words:group});group=[];
  }
 }
 offset+=line.length+1;
}
assert.equal(shots.reduce((n,s)=>n+s.frames,0),totalFrames);
assert(captionGroups.every(g=>g.to>g.from&&g.words.length<=4));
assert(fs.existsSync(path.join(episode,'audio/mixagem.wav')),'Gere a mixagem com painel/motor/som-mosquitos.py antes de renderizar.');
const props={...source,visual:'mosquitos-v1',seconds:totalFrames/30,totalFrames,shots,captionGroups,audioFile:'audio/mixagem.wav'};
fs.writeFileSync(path.join(episode,'cenas-direcao.json'),JSON.stringify(props,null,2));
const preview=path.join(episode,'previas');fs.mkdirSync(preview,{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(motor,'filme.jsx'),publicDir:episode});
const composition=await selectComposition({serveUrl,id:'Corte',inputProps:props});
if(process.argv.includes('--preview')){
 for(let i=0;i<9;i++){
  await renderStill({serveUrl,composition,inputProps:props,frame:shots[i].from+Math.min(100,shots[i].frames-1),output:path.join(preview,`cena-${i+1}.png`),scale:.5});
  console.log(`Prévia ${i+1}/9`);
 }
}else{
 const output=path.join(episode,'video.mp4');
 if(fs.existsSync(output))fs.copyFileSync(output,path.join(episode,`video-anterior-${Date.now()}.mp4`));
 let progress=-1;
 await renderMedia({serveUrl,composition,inputProps:props,codec:'h264',audioCodec:'aac',crf:18,pixelFormat:'yuv420p',outputLocation:output,concurrency:4,onProgress:p=>{const n=Math.floor(p.progress*20)*5;if(n!==progress){progress=n;console.log(`Render ${n}% (${p.renderedFrames}/2136)`);}}});
 console.log(output);
}

