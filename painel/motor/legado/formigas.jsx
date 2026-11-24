import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';

const C={bg:'#0a1a2f',gold:'#f2c94c',teal:'#2ec4b6',pink:'#e6398a',white:'#f5f1de',soil:'#243a50',orange:'#ff874f'};
const clamp=(x)=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const titles=[['E SE AS FORMIGAS','PARASSEM?'],['UM JARDIM','SEM TRÂNSITO.'],['QUEM RECOLHE','OS RESTOS?'],['SEMENTES','SEM CARONA.'],['POR DENTRO','DO SOLO.'],['UMA COISA','PUXA A OUTRA.'],['O INVISÍVEL','FAZ FALTA.'],['PEQUENAS','ENGENHEIRAS.'],['ELAS VOLTAM.','VOCÊ VÊ.']];
const labels=['A GREVE MINÚSCULA','NENHUMA FILEIRA','RECICLAGEM EM PAUSA','TRANSPORTE EM PAUSA','CICLO EM PAUSA','TUDO CONECTADO','FIM DA TARDE','RECICLAR • AERAR • PLANTAR','NO DIA SEGUINTE'];

function Ant({x=0,y=0,s=1,color=C.teal,t=0,walk=false,flip=false,leaf=false}){
 const stride=walk?Math.sin(t*15)*13:0;
 return <g transform={`translate(${x} ${y}) scale(${flip?-s:s} ${s})`}>
  <ellipse cy="38" rx="85" ry="12" fill="#000" opacity=".17"/>
  {[-1,1].map(side=>[0,1,2].map(i=><path key={`${side}${i}`} d={`M ${-23+i*23} 0 Q ${-48+i*38} ${side*28} ${-57+i*48+stride*(i===1?-1:1)} ${side*43}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"/>))}
  <ellipse cx="-54" cy="-7" rx="39" ry="28" fill={color}/><ellipse cx="0" cy="-9" rx="23" ry="20" fill={color}/><circle cx="41" cy="-17" r="29" fill={color}/>
  <ellipse cx="-61" cy="-18" rx="21" ry="8" fill="white" opacity=".22"/><circle cx="49" cy="-25" r="9" fill={C.white}/><circle cx="52" cy="-25" r="4" fill={C.bg}/>
  <path d="M 48 -41 Q 49 -72 70 -72 M 30 -42 Q 25 -66 12 -69" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"/>
  {leaf&&<g transform="translate(10 -100) rotate(-25)"><path d="M 0 40 Q -75 -10 0 -74 Q 66 -8 0 40" fill={C.gold}/><path d="M 0 38 V -49" stroke="#b0802a" strokeWidth="4"/></g>}
 </g>;
}
function Plant({x,y,s=1,color=C.teal}){return <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M 0 0 Q -12 -65 0 -130" stroke={color} strokeWidth="12" fill="none"/><path d="M -3 -54 Q -95 -49 -73 -125 Q -7 -125 -3 -54 M -3 -83 Q 68 -75 78 -155 Q 11 -160 -3 -83" fill={color}/><path d="M -58 -106 L -6 -61 M 56 -130 L 0 -89" stroke={C.bg} strokeWidth="4" opacity=".3"/></g>}
function Seed({x,y,s=1,rot=0,color=C.gold}){return <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}><ellipse rx="25" ry="37" fill={color}/><path d="M -5 -23 Q -18 0 -6 21" stroke="white" strokeWidth="5" fill="none" opacity=".4"/></g>}
function Ground({soil=false}){return <g><ellipse cx="450" cy="670" rx="393" ry="90" fill="#000" opacity=".2"/><path d="M 62 528 L 451 372 L 838 528 L 450 706 Z" fill={C.teal}/><path d="M 62 528 L 450 706 L 450 790 L 62 608 Z" fill={soil?'#76544a':'#177d7c'}/><path d="M 450 706 L 838 528 L 838 608 L 450 790 Z" fill={soil?'#523e42':'#126167'}/></g>}
function Badge({x,y,text,color=C.gold}){return <g transform={`translate(${x} ${y})`}><rect x="-155" y="-29" width="310" height="58" rx="29" fill={color}/><text y="9" textAnchor="middle" fill={C.bg} fontSize={text.length>19?20:text.length>15?22:25} fontWeight="900">{text}</text></g>}
function Bird({x,y,s=1}){return <g transform={`translate(${x} ${y}) scale(${s})`}><ellipse rx="57" ry="40" fill={C.gold}/><circle cx="35" cy="-34" r="32" fill={C.gold}/><path d="M 62 -40 L 100 -23 L 62 -16" fill={C.orange}/><circle cx="43" cy="-41" r="6" fill={C.bg}/><path d="M -5 32 L -10 63 M 23 32 L 20 63" stroke={C.gold} strokeWidth="8"/><path d="M -22 -10 Q -64 35 16 20" fill="#c68f35"/></g>}
function Tableau({index,t,p}){
 const entry=ease(t*2), bob=Math.sin(t*2)*6;
 return <svg viewBox="0 0 900 900" style={{width:900,height:900,overflow:'hidden'}}>
  <defs><radialGradient id="halo"><stop stopColor={index===6?C.orange:C.teal} stopOpacity=".18"/><stop offset="1" stopColor={C.bg} stopOpacity="0"/></radialGradient></defs>
  <circle cx="450" cy="425" r="455" fill="url(#halo)"/>
  {[...Array(18)].map((_,i)=><circle key={i} cx={50+(i*137)%800} cy={80+(i*191)%710+Math.sin(t+i)*7} r={i%3===0?4:2} fill={C.teal} opacity=".22"/>)}
  <g transform={`translate(450 450) scale(${.90+.1*entry+.025*p}) translate(-450 -450)`}>
  {index===0&&<>
   <circle cx="450" cy="435" r="290" fill="none" stroke={C.teal} strokeOpacity=".2" strokeWidth="2"/>
   <circle cx="450" cy="435" r="250" fill="none" stroke={C.gold} strokeWidth="3" strokeDasharray="12 17" transform={`rotate(${t*4} 450 435)`}/>
   <Ant x={450} y={415+bob} s={2.6} t={t} walk={t<1.5}/>
   <g transform={`translate(650 260) rotate(${Math.sin(t)*3})`}><path d="M 0 0 V 220" stroke={C.white} strokeWidth="10"/><rect x="-100" y="-65" width="200" height="100" rx="16" fill={C.pink}/><text textAnchor="middle" y="-4" fontSize="35" fill="white" fontWeight="900">GREVE!</text></g>
   <Ant x={240} y={680} s={.75} color={C.pink}/><Ant x={640} y={680} s={.75} color={C.gold}/>
   <Badge x={450} y={770} text="BRASIL INTEIRO"/>
  </>}
  {index===1&&<>
   <circle cx="690" cy={170+bob} r="76" fill={C.gold}/><Ground/>
   <path d="M 140 544 Q 320 412 435 562 T 760 560" fill="none" stroke={C.gold} strokeWidth="12" strokeDasharray="14 20" opacity={.5-.25*p}/>
   <Plant x={210} y={480} s={1.3}/><Plant x={650} y={480} s={1.6} color={C.gold}/><Plant x={720} y={590} s={.8}/>
   <g transform={`translate(420 ${310+bob})`}><circle r="72" fill={C.bg} stroke={C.pink} strokeWidth="6"/><path d="M -20 -28 V 28 M 20 -28 V 28" stroke={C.pink} strokeWidth="15"/></g>
   <Badge x={450} y={790} text="CADÊ A FILEIRA?" color={C.pink}/>
  </>}
  {index===2&&<>
   <Ground soil/>
   {[...Array(20)].map((_,i)=>{const fall=ease((t-i*.19)*1.4);return <g key={i} transform={`translate(${205+(i*101)%480} ${550-Math.floor(i/5)*49-(1-fall)*650}) rotate(${i*47})`} opacity={fall}><Seed x={0} y={0} s={.7+i%3*.25} color={[C.orange,C.gold,C.pink][i%3]}/>{i%2===0&&<path d="M -40 0 Q -35 -88 40 -58 Q 68 0 -40 0" fill={C.teal}/>}</g>})}
   <path d={`M 760 430 V ${430-180*ease(t/3)} l -20 25 m 20 -25 l 20 25`} stroke={C.pink} strokeWidth="12" fill="none" strokeLinecap="round"/>
   <Badge x={450} y={790} text="RESTOS ACUMULADOS"/>
  </>}
  {index===3&&<>
   <Ground/><Plant x={230} y={445} s={1.8}/><Plant x={730} y={570} s={1.2}/>
   <path d="M 260 560 Q 400 420 640 550" stroke={C.white} opacity=".5" strokeWidth="6" strokeDasharray="12 14" fill="none"/>
   {[0,1,2].map(i=><Seed key={i} x={330+i*83} y={560+i%2*28} rot={i*55} s={1.1}/>)}
   <g transform={`translate(500 ${300+bob})`}><circle r="72" fill={C.pink}/><path d="M -23 -23 L 23 23 M 23 -23 L -23 23" stroke={C.white} strokeWidth="12" strokeLinecap="round"/></g>
   <Badge x={450} y={790} text="ESPERANDO CARONA"/>
  </>}
  {index===4&&<>
   <rect x="90" y="330" width="720" height="390" rx="40" fill={C.soil}/><path d="M 90 350 Q 260 300 450 350 T 810 350" stroke={C.teal} strokeWidth="35" fill="none"/>
   <Plant x={230} y={330} s={1}/><Plant x={680} y={330} s={.8}/>
   <path d="M 440 360 V 450 Q 440 510 330 510 H 230 M 440 450 Q 440 570 600 570 H 680 M 440 510 V 650" stroke="#57717e" strokeWidth="27" fill="none" strokeLinecap="round"/>
   {[...Array(32)].map((_,i)=><circle key={i} cx={115+(i*97)%670} cy={400+(i*71)%280} r={3+i%5} fill={C.gold} opacity=".2"/>)}
   {[0,1,2].map(i=><g key={i} transform={`translate(${310+i*140} ${230-(t*22+i*40)%120})`} opacity={.6*(1-p)}><path d="M 0 25 V -25 M -12 -10 L 0 -25 L 12 -10" stroke={C.teal} strokeWidth="7" fill="none"/></g>)}
   <Badge x={450} y={790} text="CICLO EM PAUSA" color={C.pink}/>
  </>}
  {index===5&&<>
   {[0,1,2,3].map(i=>{const fall=ease((t-1-i*.7)*1.4);return <g key={i} transform={`translate(${160+i*170} 650) rotate(${fall*23})`}><rect x="-55" y="-280" width="110" height="280" rx="18" fill={[C.gold,C.teal,C.orange,C.pink][i]}/><rect x="-39" y="-262" width="78" height="235" rx="10" fill={C.bg} opacity=".15"/><circle cx="0" cy="-90" r="13" fill={C.white}/><circle cx="0" cy="-145" r="13" fill={C.white}/></g>})}
   <Seed x={160} y={260} s={1.1}/><Plant x={340} y={300} s={.65}/><Bird x={525} y={250} s={.65}/>
   <g transform="translate(715 245)"><circle cy="-28" r="26" fill={C.white}/><path d="M -35 80 V 20 Q 0 -20 35 20 V 80" fill={C.white}/></g>
   <path d="M 220 260 H 275 M 400 260 H 450 M 595 260 H 650" stroke={C.white} strokeWidth="5" strokeDasharray="9 9"/>
   <Badge x={450} y={790} text="EFEITO DOMINÓ"/>
  </>}
  {index===6&&<>
   <circle cx="620" cy="310" r="130" fill={C.orange}/><Ground soil/>
   <path d="M 230 550 Q 330 250 560 550 Z" fill="#ab7954"/><ellipse cx="400" cy="500" rx="52" ry="27" fill={C.bg}/>
   <g transform={`translate(400 ${340+bob})`}><circle r="75" fill={C.pink}/><path d="M -23 -30 V 30 M 23 -30 V 30" stroke={C.white} strokeWidth="17"/></g>
   <Plant x={700} y={600} s={1}/><Badge x={450} y={790} text="FORMIGUEIRO EM PAUSA" color={C.pink}/>
  </>}
  {index===7&&<>
   <circle cx="450" cy="435" r="260" fill="none" stroke={C.teal} strokeWidth="5" strokeDasharray="14 15" transform={`rotate(${t*8} 450 435)`}/>
   <Ant x={450} y={440+bob} s={2} color={C.gold} t={t} walk leaf/>
   {[[230,230,'RECICLAM',C.teal],[700,610,'AERAM',C.pink],[350,710,'PLANTAM',C.gold]].map(([x,y,text,color],i)=><g key={text} opacity={ease(t*2-i*.7)}><Badge x={x} y={y} text={text} color={color}/></g>)}
  </>}
  {index===8&&<>
   <circle cx="680" cy="190" r="85" fill={C.gold}/><Ground/><Plant x={180} y={475} s={1.4}/><Plant x={705} y={570} s={1.2}/>
   {[0,1,2,3,4].map(i=><Ant key={i} x={130+(t*64+i*145)%660} y={540+(i%2)*62} s={.65} color={i%2?C.pink:C.gold} t={t+i} walk leaf={i%2===0}/>)}
   <g transform={`translate(420 ${260+bob})`}><path d="M -120 0 Q 0 -120 120 0 Q 0 120 -120 0" fill={C.white}/><circle r="49" fill={C.teal}/><circle r="25" fill={C.bg}/><circle cx="12" cy="-15" r="9" fill="white"/></g>
   <Badge x={450} y={790} text="AGORA VOCÊ VÊ."/>
  </>}
  </g>
 </svg>;
}

export function Formigas({shots,captionGroups,audioFile,totalFrames}){
 const frame=useCurrentFrame();
 const index=Math.max(0,shots.findIndex(s=>frame>=s.from&&frame<s.from+s.frames));
 const shot=shots[index],local=frame-shot.from,t=local/30,p=local/shot.frames;
 const group=captionGroups.find(g=>frame>=g.from&&frame<g.to);
 const enter=ease(local/13),exit=clamp((shot.frames-local)/9);
 const title=titles[index];
 return <AbsoluteFill style={{background:C.bg,color:C.white,fontFamily:'Arial, sans-serif',overflow:'hidden'}}>
  {audioFile&&<Audio src={staticFile(audioFile)}/>}
  <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 45%, #123446 0%, transparent 67%)'}}/>
  <div style={{position:'absolute',left:70,top:91,display:'flex',alignItems:'center',gap:17,fontSize:25,fontWeight:800,letterSpacing:3}}><span style={{width:13,height:13,background:C.gold,borderRadius:20}}/>E SE NO BRASIL</div>
  <div style={{position:'absolute',right:88,top:94,fontSize:21,color:C.teal,letterSpacing:3}}>HIPÓTESE</div>
  <div style={{position:'absolute',left:72,top:195,fontSize:22,fontWeight:700,letterSpacing:4,color:C.teal}}>{String(index+1).padStart(2,'0')} / 09 — {labels[index]}</div>
  <div style={{position:'absolute',left:66,top:257,fontWeight:900,fontSize:79,lineHeight:1.04,letterSpacing:-3,transform:`translateY(${(1-enter)*35}px)`,opacity:enter}}>{title[0]}<br/><span style={{color:C.gold}}>{title[1]}</span></div>
  <div style={{position:'absolute',left:55,top:470,opacity:Math.min(enter+.2,exit),transform:`translateX(${(1-enter)*60}px)`}}><Tableau index={index} t={t} p={p}/></div>
  <div style={{position:'absolute',left:76,right:112,top:1400,minHeight:180,display:'flex',justifyContent:'center',alignContent:'center',flexWrap:'wrap',gap:'12px 14px',fontWeight:900,fontSize:57,lineHeight:1.18,textAlign:'center'}}>
   {group?.words.map((w,i)=>{const active=frame>=w.from&&frame<w.to;return <span key={`${group.from}-${i}`} style={{display:'inline-block',color:active?C.bg:C.white,background:active?C.gold:'transparent',padding:'5px 10px',borderRadius:12,transform:active?'scale(1.045)':'none'}}>{w.text}</span>})}
  </div>
  <div style={{position:'absolute',left:77,right:115,top:1650,fontSize:21,color:'#94a9b8',textAlign:'center'}}>{index>=2&&index<=6?'Cenário hipotético • efeitos ilustrados sem escala de tempo':'Um mundo inteiro acontece debaixo dos seus pés.'}</div>
  <div style={{position:'absolute',left:75,right:112,top:1720,display:'flex',gap:9}}>{shots.map((s,i)=><div key={i} style={{height:5,flex:1,background:'#294153',borderRadius:9,overflow:'hidden'}}><div style={{height:5,width:`${i<index?100:i===index?p*100:0}%`,background:C.teal}}/></div>)}</div>
  <div style={{position:'absolute',left:75,top:1750,fontSize:18,letterSpacing:3,color:'#7494a8'}}>E SE…</div>
 </AbsoluteFill>;
}
