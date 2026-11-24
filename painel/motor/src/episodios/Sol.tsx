import React, {useLayoutEffect, useMemo} from "react";
import * as THREE from "three";
import {ThreeCanvas} from "@remotion/three";
import {AbsoluteFill, Audio, Composition, registerRoot, staticFile, useCurrentFrame} from "remotion";
import "@fontsource/inter/900.css";

type Brush = CanvasRenderingContext2D;
type Point = [number,number];
type Shot = {from:number;frames:number};
type Word = {word:string;start:number;end:number};
type Props = {shots:Shot[];words:Word[];audioFile:string;totalFrames:number};
const ink="#101d32", night="#192e4a", teal="#40958f", pale="#ffeec9", gold="#ffbb42", coral="#f06550";
const sat=(n:number)=>Math.min(1,Math.max(0,n));
const smooth=(n:number)=>sat(n)**2*(3-2*sat(n));
const noise=(i:number)=>{const v=Math.sin(i*91.7+3.4)*4892;return v-Math.floor(v)};
function rect(c:Brush,x:number,y:number,w:number,h:number,color:string,r=0){
  c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();
}
function ellipse(c:Brush,x:number,y:number,rx:number,ry:number,color:string){
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);c.fill();
}
function path(c:Brush,points:Point[],color:string,stroke=0){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  if(stroke){c.strokeStyle=color;c.lineWidth=stroke;c.lineJoin="round";c.lineCap="round";c.stroke()}
  else{c.closePath();c.fillStyle=color;c.fill()}
}
function arc(c:Brush,x:number,y:number,r:number,a:number,b:number,color:string,width:number){
  c.beginPath();c.arc(x,y,r,a,b);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function group(c:Brush,x:number,y:number,s:number,angle:number,draw:()=>void){
  c.save();c.translate(x,y);c.rotate(angle);c.scale(s,s);draw();c.restore();
}
function label(c:Brush,txt:string,x:number,y:number,size:number,color=pale){
  c.font=`900 ${size}px Inter, Arial, sans-serif`;c.textAlign="center";c.fillStyle=color;c.fillText(txt,x,y);
}
function glow(c:Brush,x:number,y:number,r:number,color:string){
  const g=c.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color);g.addColorStop(1,"transparent");c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r)
}
function sun(c:Brush,x:number,y:number,r:number,t:number,dark:number){
  glow(c,x,y,r*2.2,"#ff944555");
  arc(c,x,y,r*1.15,0,7,"#ffbc6077",2);
  for(let i=0;i<48;i++){const a=i*Math.PI/24+t*.045; const d=r*(i%4===0?1.28:1.21);
    path(c,[[x+Math.cos(a)*r*1.16,y+Math.sin(a)*r*1.16],[x+Math.cos(a)*d,y+Math.sin(a)*d]],gold,i%4===0?3:1)}
  ellipse(c,x,y,r,r,gold);c.save();c.beginPath();c.arc(x,y,r,0,7);c.clip();
  for(let i=0;i<9;i++)rect(c,x-r,y+r*.17+i*r*.105,r*2,2+i*.48,"#e67937");
  ellipse(c,x-r*(2.15-2.15*dark),y,r*.99,r*.99,ink);c.restore();
}
function skyline(c:Brush,t:number,base:number,lit:number){
  for(let row=0;row<2;row++)for(let i=-2;i<17;i++){
    const h=65+noise(i+row*24)*210,w=45+row*21,x=i*w-(t*(row+1)*3)%48,y=base-h+row*65;
    rect(c,x,y,w-3,h+350,row?night:"#416175");
    rect(c,x+5,y-6,w*.42,6,row?night:"#416175");
    for(let a=0;a<3;a++)for(let b=0;b<Math.floor(h/30);b++)
      if(noise(i*219+a*12+b)<lit)rect(c,x+7+a*(w/3.5),y+12+b*27,5,9,row?"#ffd691":"#b1ad94");
  }
}
function candle(c:Brush,x:number,y:number,s:number,t:number){
  group(c,x,y,s,0,()=>{ellipse(c,0,2,28,7,ink);rect(c,-12,-54,24,55,"#ebcb9e",4);
    rect(c,-10,-51,4,23,pale,2);glow(c,0,-68,57,"#ffb63288");
    ellipse(c,Math.sin(t*7)*2,-67,6,12+2*Math.cos(t*8),gold);ellipse(c,0,-63,2.6,5,"#fff8cd")})
}
// Lia é construída em camadas, com rosto, pernas e braços articulados.
function lia(c:Brush,x:number,y:number,s:number,t:number,act:string){
  const run=act==="run", alarm=["alarm","spill","fall"].includes(act);
  group(c,x,y,s,act==="spill"?Math.sin(t*4)*.18:0,()=>{
    const step=run?Math.sin(t*12):0;
    ellipse(c,0,0,61,11,"#111e3288");
    for(const side of [-1,1]){const foot=side*(19+step*29);
      path(c,[[side*18,-85],[side*23-step*side*13,-49],[foot,-9-Math.max(0,step*side)*20]],ink,18);
      rect(c,foot-11,-13-Math.max(0,step*side)*20,35,13,pale,6)}
    const bob=run?Math.abs(step)*8:Math.sin(t*2.7)*2;
    group(c,0,-bob,1,0,()=>{
      rect(c,-50,-193,48,103,teal,13);path(c,[[-25,-206],[23,-203],[49,-86],[-48,-86]],gold);
      path(c,[[-24,-196],[0,-173],[25,-197]],"#df7838",5);
      path(c,[[0,-170],[0,-93]],"#e18936",2);
      const hand:Point=alarm?[67,-233]:act==="light"?[77,-170]:run?[60,-195]:[52,-139];
      path(c,[[26,-191],[51,-161],hand],gold,18);ellipse(c,...hand,9,10,"#c98164");
      if(act==="light"){group(c,...hand,1,-.23,()=>{rect(c,-6,-8,38,16,ink,5);
        path(c,[[31,-6],[235,-55],[235,34],[31,7]],"#ffe7a94a");rect(c,28,-9,5,18,pale,2)})}
      group(c,0,-239,1,act==="look"?-.13:0,()=>{
        ellipse(c,-7,1,47,50,ink);ellipse(c,1,3,39,43,"#d99770");
        for(let i=0;i<8;i++){const a=Math.PI+i*Math.PI/7;ellipse(c,Math.cos(a)*41-3,Math.sin(a)*31-9,14,13,ink)}
        ellipse(c,-4,-43,38,10,teal);rect(c,-33,-66,58,26,teal,10);
        for(const xx of [-12,17]){ellipse(c,xx,0,12,12,ink);ellipse(c,xx,0,9,9,pale);ellipse(c,xx+3,act==="look"?-4:0,4,5,ink)}
        path(c,[[-1,-1],[6,-1]],ink,4);
        if(alarm)ellipse(c,8,23,7,9,ink);else path(c,[[2,23],[9,25],[15,22]],ink,3)
      })
    })
  })
}
function bird(c:Brush,x:number,y:number,s:number,t:number){
  group(c,x,y,s,0,()=>{const flap=Math.sin(t*8)*16;
    path(c,[[-31,-10+flap],[-14,-4],[0,4],[13,-6],[29,-11+flap]],ink,5)})
}
function cart(c:Brush,x:number,y:number,s:number,col:string){
  group(c,x,y,s,0,()=>{rect(c,-60,-27,120,28,col,9);path(c,[[-38,-26],[-23,-49],[20,-49],[43,-26]],col);
    path(c,[[-29,-28],[-19,-43],[16,-43],[31,-28]],night);for(const a of [-35,37])ellipse(c,a,0,12,12,ink);
    rect(c,44,-19,12,6,pale,2)})
}
function windowFrame(c:Brush){
  for(const x of [35,335,637])rect(c,x,187,17,561,ink);
  for(const y of [180,456,740])rect(c,32,y,625,16,ink);
  rect(c,-30,759,785,350,"#36575e");rect(c,-20,752,770,12,pale)
}
function interior(c:Brush,i:number,p:number,t:number){
  windowFrame(c);
  if(i===2){rect(c,108,238,500,559,ink,13);
    const k=1-smooth((p-.14)*3);for(const side of [-1,1]){
      const x=side<0?121-k*111:360+k*111;rect(c,x,265,230,505,side<0?"#749493":"#668581");rect(c,x+12,285,4,450,"#aac5b2")}
    rect(c,296,188,127,58,ink,8);label(c,"12  ▾",359,228,30,coral)}
  if(i===1){path(c,[[360,0],[360,266]],ink,6);path(c,[[275,300],[325,244],[395,244],[446,300]],teal);
    if(p<.42){ellipse(c,360,309,26,35,pale);glow(c,360,319,155,"#ffdd6699")}
    else for(let j=0;j<14;j++){const a=j*2.4,k=sat((p-.42)*2.7);
      group(c,360+Math.cos(a)*k*194,310+Math.sin(a)*k*101+185*k*k,1,a+k*3,()=>path(c,[[-4,-7],[6,0],[0,12]],pale))}}
  if(i===3){group(c,320,515,1,-.12,()=>{rect(c,-128,-205,256,418,ink,32);
    rect(c,-112,-187,224,382,p<.46?teal:"#263849",22);if(p<.46)label(c,"12:00",0,-45,57);
    else{rect(c,-26,-10,52,23,coral,4);rect(c,-19,-5,34,13,night)}});return}
  lia(c,i===2?184:i===5?185+p*110:348,i===2?937:929,i===2?.86:1.34,t,
    i===1?"alarm":i===4?"spill":i===5?"light":"look");
  if(i===4){const k=smooth((p-.18)*1.65);group(c,435+84*k,643+210*k*k,1,k*2.8,()=>{
    arc(c,22,-9,15,0,7,pale,7);rect(c,-28,-35,56,51,pale,8);ellipse(c,0,-35,26,6,"#684439")});
    for(let j=0;j<8;j++)ellipse(c,445+Math.sin(j)*95*k,680+j*12*k,2+5*k,3+8*k,"#ae673e")}
}
function rio(c:Brush,p:number){
  path(c,[[-60,804],[70,675],[154,632],[210,557],[269,589],[357,723],[441,779],[528,636],[592,622],[655,690],[760,737],[770,1020],[-60,1020]],"#29475b");
  group(c,211,559,.85,0,()=>{ellipse(c,0,-112,12,13,ink);path(c,[[-10,-99],[-79,-108],[-82,-98],[-18,-74],[-26,-5],[25,-5],[16,-73],[82,-97],[79,-107],[11,-98]],ink)});
  c.fillStyle=`rgba(13,25,45,${smooth(p)*.52})`;c.fillRect(0,0,720,1280)
}
function earth(c:Brush,x:number,y:number,r:number,t:number){
  ellipse(c,x,y,r+3,r+3,"#93e2cc");ellipse(c,x,y,r,r,"#3b91ab");
  c.save();c.beginPath();c.arc(x,y,r,0,7);c.clip();
  group(c,x+Math.sin(t*.15)*r*.12,y,r,0,()=>{
    path(c,[[-.85,-.93],[-.09,-.94],[.05,-.71],[-.22,-.56],[-.3,-.23],[-.05,-.1],[-.15,.00],[-.53,-.31],[-.77,-.42]],"#9ac78e");
    path(c,[[-.16,-.12],[.11,-.09],[.37,.07],[.59,.14],[.45,.39],[.24,.53],[.13,.83],[-.04,.96],[-.15,.68],[-.16,.42],[-.37,.19]],"#a7ce92");
    for(let j=0;j<4;j++)rect(c,-.95+j*.46,-.49+j*.27,.4,.033,"#dfebce",.01)
  });ellipse(c,x+r*1.35,y,r*1.35,r*1.35,"#122b4b77");c.restore()
}
function orbit(c:Brush,i:number,p:number,t:number){
  const x=146,y=380,ex=525,ey=790;
  sun(c,x,y,i===16?77:88,t,i===13||i===15?.99:.04);
  path(c,[[x+61,y+66],[ex-64,ey-70]],"#577b8a",3);
  for(let j=0;j<13;j++){const k=(j/13+t*.16)%1;
    if((i===13||i===14)&&k>p-.24&&k<p+.06)continue;
    ellipse(c,x+67+k*244,y+70+k*266,4.5,4.5,gold)}
  earth(c,ex,ey,i===16?116:91,t);
  const k=smooth(p);ellipse(c,215+k*238,452+k*266,9,9,i===13?coral:pale);
  label(c,"SOL",x,525,24,gold);label(c,"TERRA",ex,945,24,"#b1e4da");
  if(i===14||i===15){rect(c,137,598,236,77,ink,12);label(c,i===14?"60 SEGUNDOS":"+ 8 MIN",255,649,34,pale)}
}
function port(c:Brush,p:number){
  for(let j=0;j<5;j++){const x=50+j*132;path(c,[[x,734],[x,428],[x+112,385],[x+119,396],[x+16,457]],"#576b73",9);path(c,[[x+98,406],[x+98,511]],ink,3)}
  path(c,[[19,715],[606,715],[533,812],[109,812]],ink);
  for(let j=0;j<12;j++)rect(c,79+j%6*71,680-Math.floor(j/6)*39,64,33,j%3?teal:coral,2);
  group(c,95+p*560,372-78*Math.sin(p*3.14),1,-.12,()=>path(c,[[-45,0],[-9,-5],[6,-30],[17,-29],[13,-5],[55,-4],[64,1],[13,6],[-6,21],[-14,20],[-10,6],[-42,8]],pale))
}
function background(c:Brush,i:number,p:number,t:number){
  const space=i>=12&&i<=16;const red=i===9||i===10;
  const grad=c.createLinearGradient(0,0,0,1280);
  grad.addColorStop(0,space?"#0b182d":red?"#741f45":i===0?"#396783":"#213854");
  grad.addColorStop(.56,space?"#243a55":red?"#f36e50":i>=17?"#445773":"#e4a47c");
  grad.addColorStop(1,ink);c.fillStyle=grad;c.fillRect(0,0,720,1280);
  for(let j=0;j<85;j++){const x=noise(j)*720,y=noise(j+120)*1100;ellipse(c,x,y,.6+noise(j+81)*1.4,1,pale)}
  if(!space){
    if(i===0||i===19)sun(c,360,415,145,t,i===0?smooth((p-.36)*2.7):1-smooth((p-.33)*1.7));
    else if(red)sun(c,512,371,126,t,.83);
    skyline(c,t,810,i===0?1-.82*p:i>=17?.62:.48)
  }
}
function action(c:Brush,i:number,p:number,t:number){
  if(i>=1&&i<=5){interior(c,i,p,t);return}
  if(i>=12&&i<=16){orbit(c,i,p,t);return}
  if(i===7){rio(c,p);return} if(i===8){port(c,p);return}
  if(i===6){for(let j=0;j<5;j++){const y=680+j*69;rect(c,0,y,720,65,j%2?"#405465":"#4f5965");
    for(let a=-1;a<6;a++)cart(c,a*170+110*Math.min(p,.43)*(j%2?-1:1)+j*23,y+43,.78,[teal,coral,gold][(j+a+6)%3])}return}
  if(i===10){for(let j=0;j<7;j++)bird(c,79+j*86+Math.sin(t+j)*25,377+j%3*44+p*p*207,.65+noise(j),t+j);
    group(c,320,820,1.6,-.13,()=>{ellipse(c,0,0,42,25,ink);ellipse(c,29,-29,18,28,ink);
      path(c,[[21,-46],[25,-72],[37,-49],[58,-65],[64,-57],[41,-34]],ink);
      for(const x of [-23,13])path(c,[[x,13],[x-4,42]],ink,9);path(c,[[-35,-3],[-58,-34]],ink,9)});return}
  if(i===17||i===18){for(let j=0;j<32;j++){const row=Math.floor(j/8);
    candle(c,27+j%8*92+(row%2)*30,603+row*81,.36+row*.12,t+j)}
    lia(c,260,980,1.03,t,"look");candle(c,365,847,.82,t);return}
  lia(c,i===11?355:211,998,i===11?1.75:1.06,t,"look");
  if(i===11){for(let j=0;j<5;j++)bird(c,j*164+p*56,394+Math.sin(j)*58,.65,t+j)}
}
const headings=["O SOL APAGOU","CURTO-CIRCUITO","ENTRE ANDARES","MEIO-DIA","NO ESCURO","NA JANELA","SÃO PAULO","RIO DE JANEIRO","NO CAIS","CÉU VERMELHO","SEM RUMO","CADÊ O SOL?","A VIAGEM DA LUZ","O ATRASO","UM MINUTO","HORA MARCADA","AINDA HÁ LUZ","A VIGÍLIA","NOITE EMPRESTADA","E SE…"];
function Layer({paint,z,shift}:{paint:(c:Brush)=>void;z:number;shift:number}){
  const asset=useMemo(()=>{const canvas=document.createElement("canvas");canvas.width=720;canvas.height=1280;
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=false;tex.minFilter=THREE.LinearFilter;
    return {c:canvas.getContext("2d")!,tex}},[]);
  const {c,tex}=asset;c.clearRect(0,0,720,1280);paint(c);tex.needsUpdate=true;
  useLayoutEffect(()=>()=>tex.dispose(),[tex]);
  return <mesh position={[shift,0,z]}><planeGeometry args={[750,1334]}/><meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false}/></mesh>
}
const Filme:React.FC<Props>=({shots,words,audioFile})=>{
  const f=useCurrentFrame(),t=f/30;
  const i=Math.max(0,shots.findIndex(s=>f>=s.from&&f<s.from+s.frames)),s=shots[i];
  const p=sat((f-s.from)/s.frames),caption=words.find(w=>t>=w.start&&t<w.end+.018);
  const space=i>=12&&i<=16;const phase=i===19?"HIPÓTESE":space?"TEMPO DA LUZ":i>=17?"DE VOLTA À TERRA":"CENÁRIO IMAGINADO";
  return <AbsoluteFill style={{background:ink,color:pale,fontFamily:"Inter, Arial"}}>
    {audioFile&&<Audio src={staticFile(audioFile)}/>}
    <ThreeCanvas width={720} height={1280} camera={{position:[0,0,1000],fov:65.24,near:1,far:2000}} gl={{alpha:true,antialias:true}}>
      <Layer z={0} shift={Math.sin(t*.7)*3} paint={c=>background(c,i,p,t)}/>
      <Layer z={13+p*13} shift={(p-.5)*(i%2?12:-12)} paint={c=>action(c,i,p,t)}/>
    </ThreeCanvas>
    <AbsoluteFill style={{background:"linear-gradient(180deg,#0e1e3544,transparent 26%,transparent 66%,#0a162ad9 98%)"}}/>
    <div style={{position:"absolute",left:48,right:48,top:71,display:"flex",alignItems:"center",gap:15,color:space?"#a9e3d8":"#ffcb70",fontSize:18,letterSpacing:3,fontWeight:900}}>
      <span style={{width:41,height:4,background:"currentColor"}}/>{phase}</div>
    <div style={{position:"absolute",top:106,left:45,right:30,fontSize:i===0?64:45,lineHeight:1,fontWeight:900,letterSpacing:-2}}>{headings[i]}</div>
    {caption&&<div style={{position:"absolute",left:28,right:28,bottom:150,textAlign:"center",fontSize:Math.min(76,820/caption.word.length),fontWeight:900,letterSpacing:-2,textShadow:"0 4px 0 #101d32, 0 0 14px #101d32",transform:`translateY(${4*(1-sat((t-caption.start)*14))}px)`}}>{caption.word}</div>}
    <div style={{position:"absolute",left:49,right:49,bottom:90,height:2,background:"#e6cfab44"}}><div style={{height:3,width:`${100*f/(shots[shots.length-1].from+shots[shots.length-1].frames)}%`,background:gold}}/></div>
  </AbsoluteFill>
};
const Root=()=> <Composition id="Sol" component={Filme} width={720} height={1280} fps={30} durationInFrames={1830} defaultProps={{shots:[{from:0,frames:1830}],words:[] as Word[],audioFile:"",totalFrames:1830}} calculateMetadata={({props})=>({durationInFrames:props.totalFrames})}/>;
registerRoot(Root);

