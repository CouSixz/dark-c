"use strict";
const el=id=>document.getElementById(id);
let data,editing="",view="produce";
const searches=new Map();
const fold=value=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function searchable(id){
 const select=el(id),label=select.parentElement,name=label.firstChild.textContent.trim();
 const field=document.createElement("div"),input=document.createElement("input"),list=document.createElement("div");
 field.className="search-field";label.before(field);field.append(label,list);
 select.hidden=true;select.required=false;label.append(input);
 input.id=id+"Search";label.htmlFor=input.id;input.autocomplete="off";input.spellcheck=false;
 input.setAttribute("role","combobox");input.setAttribute("aria-autocomplete","list");
 list.id=id+"Matches";list.className="search-list";list.setAttribute("role","listbox");list.setAttribute("aria-label",name);
 input.setAttribute("aria-controls",list.id);
 let matches=[],active=-1;
 function close(){
  list.hidden=true;input.setAttribute("aria-expanded","false");input.removeAttribute("aria-activedescendant");
  input.value=select.selectedOptions[0]?.text||"";
 }
 function highlight(i){
  if(active>=0)list.children[active]?.setAttribute("aria-selected","false");
  active=i;const item=list.children[i];
  if(item){item.setAttribute("aria-selected","true");input.setAttribute("aria-activedescendant",item.id);item.scrollIntoView({block:"nearest"});}
 }
 function choose(i){
  if(!matches[i])return;
  select.value=matches[i].value;close();select.dispatchEvent(new Event("change",{bubbles:true}));
 }
 function render(query){
  const words=fold(query).trim().split(/\s+/);
  matches=Array.from(select.options).filter(o=>o.value&&words.every(w=>fold(o.text+" "+o.value).includes(w)));
  active=-1;input.removeAttribute("aria-activedescendant");
  list.replaceChildren(...matches.map((o,i)=>{
   const item=document.createElement("div");item.id=list.id+i;item.setAttribute("role","option");item.setAttribute("aria-selected","false");
   if(id==="voice"){
    item.className="voice-option";
    const span=document.createElement("span");span.textContent=o.text;span.className="voice-label";
    const playBtn=document.createElement("button");playBtn.type="button";playBtn.className="voice-preview-inline";
    const isP=Boolean(currentAudio&&currentVoiceId&&currentVoiceId===o.value&&!currentAudio.paused);
    playBtn.textContent=isP?"⏹ Parar":"▶ Ouvir";
    if(isP)playBtn.classList.add("playing");
    playBtn.title=isP?"Parar áudio":"Ouvir amostra desta voz";
    playBtn.dataset.voice=o.value;
    playBtn.addEventListener("mousedown",e=>e.stopPropagation());
    playBtn.onclick=e=>{
     e.stopPropagation();
     togglePreview(o.value);
    };
    item.append(span,playBtn);
   }else{
    item.textContent=o.text;
   }
   item.title=o.value;item.addEventListener("mousedown",e=>e.preventDefault());
   item.onclick=()=>choose(i);return item;
  }));
  if(!matches.length){const empty=document.createElement("div");empty.setAttribute("role","status");empty.textContent="Nenhum resultado";list.append(empty);}
  list.hidden=false;input.setAttribute("aria-expanded","true");list.scrollTop=0;
 }
 function open(){if(list.hidden){input.select();render("");}}
 input.onfocus=open;input.onclick=()=>{if(list.hidden)open();};input.oninput=()=>render(input.value);
 input.onblur=close;
 input.onkeydown=e=>{
  if(e.isComposing)return;
  if(e.key==="Escape"){close();input.select();return;}
  if(e.key==="Enter"&&!list.hidden){e.preventDefault();choose(active<0?0:active);return;}
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
   e.preventDefault();open();if(matches.length)highlight(active<0?(e.key==="ArrowDown"?0:matches.length-1):Math.max(0,Math.min(matches.length-1,active+(e.key==="ArrowDown"?1:-1))));
  }
 };
 searches.set(id,()=>{input.disabled=!select.value;close();});
 close();
}
for(const id of ["channel","model","tts","voice"])searchable(id);
const favoriteKeys={model:"corte:modelo-favorito",tts:"corte:modelo-voz-favorito",voice:"corte:voz-favorita"};
const favoriteNames={model:"modelo de roteiro",tts:"modelo de voz",voice:"voz"};
function getFavorite(f){try{return localStorage.getItem(favoriteKeys[f])||"";}catch{return "";}}
function toggleFavorite(f){
 const val=el(f).value;if(!val)return;
 try{
  if(val===getFavorite(f))localStorage.removeItem(favoriteKeys[f]);
  else localStorage.setItem(favoriteKeys[f],val);
  updateActions();
 }catch{message("O navegador não conseguiu salvar o favorito.");}
}
let currentAudio=null,currentVoiceId=null,voicePlayBtn=null;
function stopPreview(){
 if(currentAudio){
  currentAudio.pause();
  currentAudio.currentTime=0;
  currentAudio=null;
 }
 currentVoiceId=null;
 updateVoiceButtons();
}
function togglePreview(voiceId){
 if(!voiceId)return;
 if(currentAudio&&currentVoiceId===voiceId){
  stopPreview();
  return;
 }
 stopPreview();
 currentVoiceId=voiceId;
 updateVoiceButtons();
 const src="/api/voice-preview?voice="+encodeURIComponent(voiceId);
 const audio=new Audio(src);
 currentAudio=audio;
 audio.onplay=updateVoiceButtons;
 audio.onended=stopPreview;
 audio.onerror=async()=>{
  stopPreview();
  try{
   const r=await fetch("/api/voice-preview?voice="+encodeURIComponent(voiceId));
   if(!r.ok){
    const err=await r.json();
    if(err.error==="Arquivo indisponível."){
     message("Reinicie o estúdio (feche a janela do terminal e abra ABRIR ESTUDIO.cmd) para carregar as novas rotas do servidor.");
     return;
    }
    message(err.error||"Não foi possível carregar a amostra da voz.");
    return;
   }
  }catch{}
  message("Não foi possível reproduzir a amostra de áudio desta voz.");
 };
 audio.play().catch(e=>{
  stopPreview();
  message("Não foi possível reproduzir o áudio: "+(e.message||"reprodução bloqueada."));
 });
}
function updateVoiceButtons(){
 if(voicePlayBtn){
  const voiceVal=el("voice").value;
  const isPlaying=Boolean(currentAudio&&currentVoiceId&&currentVoiceId===voiceVal&&!currentAudio.paused);
  voicePlayBtn.disabled=!voiceVal;
  voicePlayBtn.textContent=isPlaying?"⏹":"▶";
  voicePlayBtn.classList.toggle("playing",isPlaying);
  voicePlayBtn.setAttribute("aria-pressed",String(isPlaying));
  voicePlayBtn.title=isPlaying?"Parar áudio":(!voiceVal?"Selecione uma voz para ouvir":"Ouvir amostra da voz selecionada");
  voicePlayBtn.setAttribute("aria-label",voicePlayBtn.title);
 }
 const matchesBox=el("voiceMatches");
 if(matchesBox){
  matchesBox.querySelectorAll(".voice-preview-inline").forEach(b=>{
   const vId=b.dataset.voice;
   const isP=Boolean(currentAudio&&currentVoiceId&&currentVoiceId===vId&&!currentAudio.paused);
   b.textContent=isP?"⏹ Parar":"▶ Ouvir";
   b.classList.toggle("playing",isP);
   b.title=isP?"Parar áudio":"Ouvir amostra desta voz";
  });
 }
}
const stars={};
for(const f of ["model","tts","voice"]){
 const container=document.createElement("div");
 container.className="field-actions";
 if(f==="voice"){
  container.classList.add("has-two");
  voicePlayBtn=document.createElement("button");
  voicePlayBtn.type="button";
  voicePlayBtn.className="preview-voice";
  voicePlayBtn.disabled=true;
  voicePlayBtn.textContent="▶";
  voicePlayBtn.title="Ouvir voz selecionada";
  voicePlayBtn.setAttribute("aria-label","Ouvir voz selecionada");
  voicePlayBtn.onclick=()=>togglePreview(el("voice").value);
  container.append(voicePlayBtn);
 }
 const star=document.createElement("button");
 star.type="button";
 star.className="favorite-btn favorite-"+f;
 if(f==="model")star.classList.add("favorite-model");
 star.disabled=true;
 star.textContent="☆";
 star.onclick=()=>toggleFavorite(f);
 container.append(star);
 stars[f]=star;
 el(f+"Search").closest(".search-field").append(container);
}
function updateActions(){
 for(const f of ["model","tts","voice"]){
  const val=el(f).value,selected=Boolean(val)&&val===getFavorite(f),star=stars[f];
  if(star){
   star.disabled=!val;
   star.textContent=selected?"★":"☆";
   star.setAttribute("aria-pressed",String(selected));
   star.title=selected?("Remover "+favoriteNames[f]+" favorito"):("Usar este "+favoriteNames[f]+" como favorito ao abrir");
   star.setAttribute("aria-label",star.title);
  }
 }
 updateVoiceButtons();
}
updateActions();
function syncSearches(){for(const sync of searches.values())sync();updateActions();}
function channelDefaults(save=false){
 const id=el("channel").value;
 const fields=["model","tts","voice","platform"];
 try{
  const key="corte:escolhas:"+id;
  if(save){if(id)localStorage.setItem(key,JSON.stringify(Object.fromEntries(fields.map(f=>[f,el(f).value]))));return;}
  const saved=JSON.parse((id&&localStorage.getItem(key))||"{}");
  for(const f of ["model","tts","voice"]){
   const fav=getFavorite(f);
   if(fav&&Array.from(el(f).options).some(o=>o.value===fav))saved[f]=fav;
  }
  for(const f of fields)if(Array.from(el(f).options).some(o=>o.value===saved[f]))el(f).value=saved[f];
 }catch{}
}
function message(s=""){el("notice").textContent=s;el("notice").hidden=!s;}
function openView(id){
 view=id; for(const v of ["produce","channels","history","settings"]) el(v).hidden=v!==id;
 document.querySelectorAll("nav button").forEach(b=>b.setAttribute("aria-current",b.dataset.view===id?"page":"false"));
}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{stopPreview();stopJobAudio();message();openView(b.dataset.view);});
function options(id,rows,empty){
 const select=el(id),previous=select.value;
 select.replaceChildren(...(rows.length?rows:[["",empty]]).map(([v,n])=>new Option(n,v)));
 if(rows.some(([v])=>v===previous))select.value=previous;
}
function suggestList(){
 el("ideas").replaceChildren();
 const batch=data?.batches[el("channel").value]||[];
 for(const s of batch){
  const label=document.createElement("label");label.className="choice";
  const input=document.createElement("input");input.type="radio";input.name="pick";input.value=s;
  label.append(input,document.createTextNode(s));el("ideas").append(label);
 }
}
function row(container,title,detail,action){
 const r=document.createElement("div");r.className="row";
 const block=document.createElement("div"),strong=document.createElement("strong"),p=document.createElement("p");
 strong.textContent=title;p.textContent=detail;block.append(strong,p);r.append(block);
 if(action)r.append(action);container.append(r);
}
function button(label,fn){const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=()=>run(b,fn);return b;}
let currentJobAudio=null,currentJobId=null,currentJobBtn=null;
function stopJobAudio(){
 if(currentJobAudio){currentJobAudio.pause();currentJobAudio.currentTime=0;currentJobAudio=null;}
 if(currentJobBtn){currentJobBtn.textContent="▶ Narração";currentJobBtn.classList.remove("playing");}
 currentJobId=null;currentJobBtn=null;
}
function toggleJobAudio(jid,btn){
 if(currentJobAudio&&currentJobId===jid){stopJobAudio();return;}
 stopJobAudio();stopPreview();
 currentJobId=jid;currentJobBtn=btn;btn.textContent="⏹ Parar";btn.classList.add("playing");
 const audio=new Audio("/api/audio?id="+encodeURIComponent(jid));
 currentJobAudio=audio;
 audio.onended=stopJobAudio;
 audio.onerror=()=>{stopJobAudio();message("Áudio da narração ainda não disponível para este episódio.");};
 audio.play().catch(e=>{stopJobAudio();message("Não foi possível reproduzir a narração.");});
}
function historyView(){
 const box=el("jobs");box.replaceChildren();
 const jobs=data.jobs.filter(j=>!el("historyFilter").value||j.channel===el("historyFilter").value);
 if(!jobs.length)box.textContent="Nenhuma produção neste histórico.";
 for(const j of jobs){
  const actions=document.createElement("div");actions.className="job-actions";
  if(j.output){
   const mp4Link=document.createElement("a");mp4Link.href="/arquivo/"+encodeURIComponent(j.id);
   mp4Link.textContent="▶ Abrir MP4";mp4Link.target="_blank";mp4Link.rel="noopener";mp4Link.className="btn-mp4-primary";
   actions.append(mp4Link);
  }
  const audioBtn=document.createElement("button");audioBtn.type="button";audioBtn.className="btn-audio";
  const isP=Boolean(currentJobAudio&&currentJobId===j.id&&!currentJobAudio.paused);
  audioBtn.textContent=isP?"⏹ Parar":"▶ Narração";
  if(isP)audioBtn.classList.add("playing");
  audioBtn.title="Ouvir dublagem gerada no ElevenLabs";
  audioBtn.onclick=()=>toggleJobAudio(j.id,audioBtn);
  actions.append(audioBtn);
  const folderBtn=document.createElement("button");folderBtn.type="button";folderBtn.className="btn-folder";
  folderBtn.textContent="📁 Pasta";
  folderBtn.title="Abrir pasta deste episódio no computador";
  folderBtn.onclick=async()=>{
   try{await post("open-folder",{id:j.id});}
   catch(e){message("Pasta ainda não disponível no disco.");}
  };
  actions.append(folderBtn);
  if(j.status!=="produzindo"&&j.output){
   const rerenderBtn=button("↻ Re-render (0 tokens)",async()=>{
    await post("rerender",{id:j.id});
    await refresh();historyView();
   });
   rerenderBtn.className="btn-rerender";
   rerenderBtn.title="Re-renderiza com o visual e legendas mais recentes sem gastar API";
   actions.append(rerenderBtn);
  }
  if(j.prompt){
   const copyBtn=document.createElement("button");copyBtn.type="button";copyBtn.className="btn-claude";
   copyBtn.textContent="📋 Resumo";
   copyBtn.title="Copiar resumo técnico da produção";
   copyBtn.onclick=async()=>{
    try{
     const res=await fetch("/api/prompt?id="+encodeURIComponent(j.id));
     if(!res.ok){const err=await res.json();throw new Error(err.error||"Resumo indisponível.");}
     const dataPrompt=await res.json();
     await navigator.clipboard.writeText(dataPrompt.prompt);
     copyBtn.textContent="✓ Copiado!";
     setTimeout(()=>{copyBtn.textContent="📋 Resumo";},2500);
    }catch(e){message(e.message||"Não foi possível copiar.");}
   };
   actions.append(copyBtn);
  }
  if(j.status==="pausado"){
   const resumeBtn=button("Retomar",async()=>{
    let result=await post("resume",{id:j.id});
    if(result.confirm && confirm(result.confirm)) await post("resume",{id:j.id,again:true});
    await refresh();historyView();
   });
   actions.append(resumeBtn);
  }
  const channel=data.channels.find(c=>c.id===j.channel)?.name||j.channel;
  row(box,j.idea,channel+" · "+j.status+" · "+j.step,actions);
 }
}
function edit(c){
 editing=c?.id||"";el("channelTitle").textContent=c?"Editar canal":"Novo canal";
 for(const [id,key] of [["name","name"],["link","link"],["description","description"],["hook","hook"],["style","style"],["direction","voice"]])el(id).value=c?.[key]||"";
 el("published").value="";
}
function show(){
 const cs=data.channels.map(c=>[c.id,c.name]),a=data.experiential?.catalog||{},e=data.eleven.catalog||{};
 options("channel",cs,"Cadastre um canal");options("historyFilter",[["","Todos os canais"],...cs]);
 options("model",(a.text||[]).map(x=>[x,x]),"Conecte a Experiential Labs");options("tts",(e.models||[]).map(x=>[x,x]),"Conecte o ElevenLabs");options("voice",(e.voices||[]).map(x=>[x.id,x.name]),"Conecte o ElevenLabs");
 el("gatewayStatus").textContent=data.experiential?.catalog?(a.text.length+" modelos de texto disponíveis para esta chave."):"Aguardando conexão.";
 el("elevenStatus").textContent=data.eleven.catalog?(e.models.length+" modelos PT-BR e "+e.voices.length+" vozes na conta."):"Aguardando conexão.";
 const ready=el("model").value&&el("voice").value&&el("tts").value&&el("channel").value;
 const keysReady=data.experiential?.key_ok===true&&data.eleven?.key_ok===true;
 el("generate").disabled=!ready||!keysReady;el("suggest").disabled=!el("model").value||!el("channel").value||data.experiential?.key_ok!==true;
 el("gatewayStatus").textContent=data.experiential?.catalog
  ? (data.experiential.key_ok===true? a.text.length+" modelos de texto disponíveis para esta chave.":"Catálogo salvo, mas a chave não pôde ser aberta. Cole a chave novamente.")
  : "Aguardando conexão.";
 el("elevenStatus").textContent=data.eleven.catalog
  ? (data.eleven.key_ok===true? e.models.length+" modelos PT-BR e "+e.voices.length+" vozes na conta.":"Catálogo salvo, mas a chave não pôde ser aberta. Cole a chave novamente.")
  : "Aguardando conexão.";
 el("ready").textContent=ready&&keysReady?"Conexões prontas. Apenas roteiro e voz usam créditos.":(!keysReady?"Cole novamente as chaves nas Configurações para produzir.":"Cadastre o canal e conecte suas contas para produzir.");
 channelDefaults();syncSearches();summary();suggestList();historyView();const box=el("channelList");box.replaceChildren();
 for(const c of data.channels)row(box,c.name,c.description,button("Editar",()=>edit(c)));
}
function summary(){
 const ac=data?.acervo;
 const acTxt=ac?` Acervo local: ${ac.modelos} objetos 3D e ${ac.animacoes} animações reutilizáveis (0 tokens quando já existem).`:"";
 el("summary").textContent="720 × 1280 · 30 fps. MP4 automático com cenas 3D, narração, trilha e legendas."+acTxt;
}
async function refresh(){const r=await fetch("/api/state",{cache:"no-store"});if(!r.ok)throw Error("Não foi possível ler o acervo.");data=await r.json();}
async function post(path,body){
 const r=await fetch("/api/"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;
}
async function run(b,fn){
 if(b.disabled)return;b.disabled=true;message();
 try{await fn();}catch(e){message(e.message);}finally{b.disabled=false;}
}
function form(id,fn){el(id).onsubmit=e=>{e.preventDefault();run(e.submitter||el(id).querySelector("button"),fn);};}
form("gatewayForm",async()=>{await post("connect",{provider:"experiential",key:el("gatewayKey").value});el("gatewayKey").value="";await refresh();show();message("Experiential Labs conectada. Catálogo atualizado.");});
form("elevenForm",async()=>{await post("connect",{provider:"eleven",key:el("elevenKey").value});el("elevenKey").value="";await refresh();show();message("ElevenLabs conectado. Modelos e vozes atualizados.");});
form("channelForm",async()=>{
 const result=await post("channel",{id:editing,name:el("name").value,description:el("description").value,hook:el("hook").value,style:el("style").value,voice:el("direction").value,link:el("link").value,published:el("published").value});
 await refresh();show();el("channel").value=result.id;el("channel").dispatchEvent(new Event("change"));edit(data.channels.find(c=>c.id===result.id));message("Canal salvo.");
});
form("produceForm",async()=>{
 const own=document.querySelector('input[name=mode]:checked').value==="mine";
 const idea=own?el("idea").value.trim():document.querySelector('input[name=pick]:checked')?.value;
 if(!idea)throw Error("Escreva sua ideia ou selecione uma sugestão.");
 await post("generate",{idea,channel:el("channel").value,model:el("model").value,voice:el("voice").value,tts:el("tts").value,seconds:Number(el("seconds").value),platform:el("platform").value});
 el("historyFilter").value=el("channel").value;await refresh();historyView();openView("history");message("Produção iniciada. Acompanhe as etapas abaixo.");
});
el("suggest").onclick=()=>run(el("suggest"),async()=>{
 const channel=el("channel").value;
 await post("ideas",{channel,model:el("model").value});await refresh();suggestList();
});
document.querySelectorAll("input[name=mode]").forEach(i=>i.onchange=()=>{el("mine").hidden=i.value!=="mine";el("assist").hidden=i.value!=="assist";});
el("seconds").oninput=summary;el("channel").onchange=()=>{channelDefaults();syncSearches();suggestList();};el("newChannel").onclick=()=>edit(null);el("historyFilter").onchange=historyView;
for(const f of ["model","tts","voice","platform"])el(f).onchange=()=>{if(f==="voice"&&currentVoiceId&&currentVoiceId!==el("voice").value)stopPreview();channelDefaults(true);updateActions();};
openView("produce");
refresh().then(show).catch(()=>message("Abra ABRIR ESTUDIO.cmd para iniciar este painel."));
setInterval(async()=>{if(view==="history"&&!document.hidden){try{await refresh();historyView();}catch{message("Estúdio desconectado. Reabra o inicializador.");}}},3500);
