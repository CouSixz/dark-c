import React, {useMemo} from "react";
import * as THREE from "three";
import {Bench, Cam, StreetLamp, Stars} from "../style/extra";
import {Clock, Lights, Person, V3, clamp, lerp} from "../style/kit";
import {Box, Cyl, CanvasPlane,Shadow} from "../style/toon";
import {Pose} from "../style/puppet";
import {Dust, Glow} from "../style/props";

type Shape = "sphere"|"box"|"cylinder"|"cone"|"ring"|"globe"|"sun"|"light"|"clock"|"performer";
type Motion = "still"|"travel"|"arc"|"spin"|"pulse"|"appear"|"dim"|"fall";
type Joint = {pivot:V3;rotate:V3;slide:V3};
type Part = [Shape,string,V3,V3,V3?,Joint?];
export type Models = Record<string,Part[]>;
type Item = [string,V3,V3,number,Motion];
export type Stage = {set:"location"|"space"|"studio"|"plaza"|"stadium";light?:"day"|"night"|"dusk";frame:"actor"|"wide"|"detail";items:Item[];cue:string;beat:number};
const dark="#121c33";
// Silhuetas cartográficas simplificadas, em longitude/latitude. A rotação
// inicial enquadra as Américas e cada cena pode girar o planeta inteiro.
const continents:number[][][]=[
  [[-168,65],[-142,70],[-125,64],[-105,72],[-81,68],[-58,54],[-66,45],[-80,26],[-84,30],[-97,20],[-81,9],[-86,8],[-105,20],[-118,32],[-125,49],[-151,59]],
  [[-81,12],[-61,10],[-51,3],[-35,-5],[-39,-18],[-48,-28],[-57,-38],[-67,-55],[-74,-50],[-72,-34],[-76,-16],[-81,-5]],
  [[-54,82],[-22,79],[-34,64],[-45,59],[-58,70]],
  [[-16,32],[8,37],[32,31],[43,13],[51,11],[42,-4],[34,-24],[20,-35],[13,-27],[9,-6],[-8,5],[-18,17]],
  [[-10,36],[-9,45],[2,50],[6,61],[23,71],[42,66],[65,72],[112,75],[169,66],[178,55],[143,46],[129,34],[114,23],[105,10],[96,17],[78,8],[69,24],[51,25],[41,38],[26,40],[23,35],[12,42]],
  [[112,-22],[124,-15],[137,-12],[144,-17],[154,-28],[149,-38],[132,-32],[117,-35]],
];
function Earth({t}:{t:number}){
  const map=useMemo(()=>{
    const canvas=document.createElement("canvas");canvas.width=768;canvas.height=384;
    const ctx=canvas.getContext("2d")!;
    ctx.fillStyle="#25799e";ctx.fillRect(0,0,768,384);
    for(const polygon of continents){
      ctx.beginPath();polygon.forEach(([lon,lat],i)=>{
        const x=(lon+180)/360*768,y=(90-lat)/180*384;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
      });ctx.closePath();ctx.fillStyle="#81c595";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="#3b817c";ctx.stroke()
    }
    ctx.strokeStyle="#c2f2ea35";ctx.lineWidth=1;
    for(let x=0;x<768;x+=64)ctx.strokeRect(x,0,64,384);
    for(let y=0;y<384;y+=48)ctx.strokeRect(0,y,768,48);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex
  },[]);
  React.useEffect(()=>()=>map.dispose(),[map]);
  return <group rotation={[.08,-.46+t*.10,-.16]}>
    <mesh><sphereGeometry args={[.49,48,32]}/><meshStandardMaterial map={map} roughness={.85}/></mesh>
    <mesh><sphereGeometry args={[.505,48,32]}/><meshBasicMaterial color="#a5eaf2" side={THREE.BackSide}/></mesh>
  </group>
}
function Piece({part,t,visibility,progress}:{part:Part;t:number;visibility:number;progress:number}){
  const [shape,color,at,size,rotation=[0,0,0],joint]=part;
  const luminous=shape==="sun"||shape==="light";
  const geo=shape==="box"?<boxGeometry/>:shape==="cylinder"?<cylinderGeometry args={[.5,.5,1,32]}/>:
    shape==="cone"?<coneGeometry args={[.5,1,32]}/>:shape==="ring"?<torusGeometry args={[.41,.085,12,48]}/>:
    <sphereGeometry args={[.5,32,24]}/>;
  const content=<group position={joint?at.map((v,i)=>v-joint.pivot[i]) as V3:at} scale={size} rotation={rotation.map(THREE.MathUtils.degToRad) as V3}>
    {shape==="globe"?<Earth t={t}/>:
     shape==="clock"?<Clock p={[0,0,0]} r={.48} t={t} speed={1}/>:<>
       <mesh castShadow receiveShadow>{geo}
         <meshStandardMaterial color={color} roughness={.73} emissive={luminous?color:"#000000"} emissiveIntensity={luminous?.85:0}
           transparent={visibility<1} opacity={visibility}/>
       </mesh>
       {!luminous&&visibility>.6&&<mesh scale={1.025}>{geo}<meshBasicMaterial color={dark} side={THREE.BackSide}/></mesh>}
       {luminous&&<Glow p={[0,0,0]} r={shape==="sun"?1.35:.92} color={color} o={.55*visibility}/>}
       {shape==="sun"&&<mesh rotation={[.14,.3,0]}><torusGeometry args={[.56,.007,8,64]}/><meshBasicMaterial color={color} transparent opacity={visibility}/></mesh>}
     </>}
  </group>
  if(!joint)return content;
  return <group position={joint.pivot.map((v,i)=>v+joint.slide[i]*progress) as V3}
    rotation={joint.rotate.map(v=>THREE.MathUtils.degToRad(v*progress)) as V3}>{content}</group>
}
function pose(item:Item,t:number,duration:number,beat:number){
  if (!item || !Array.isArray(item)) {
    return {position:[0,0,0] as V3, scale:1, rotation:[0,0,0] as V3};
  }
  const [,from=[0,0,0],to=[0,0,0],scale=1,motion="still"]=item;
  const safeFrom = (Array.isArray(from) && from.length >= 3) ? from : [0,0,0];
  const safeTo = (Array.isArray(to) && to.length >= 3) ? to : safeFrom;
  // Antecipação curta deixa a ação legível mesmo quando a palavra cai no fim da fala.
  const begin=Math.min(Math.max(0,beat-.14),duration*.68);
  const u=clamp((t-begin)/Math.max(.18,duration-begin-.08));
  const k=motion==="fall"?u*u:u*u*(3-2*u);
  const position=safeFrom.map((v,i)=>lerp(v,safeTo[i] ?? v,k)) as V3;
  if(motion==="arc")position[1]+=Math.sin(Math.PI*k)*.65;
  const envelope=motion==="appear"?.015+.985*clamp(u*4):
    motion==="pulse"?1+.13*Math.sin(u*Math.PI*3):1;
  return {position,scale:(scale ?? 1)*envelope,rotation:[0,motion==="spin"?k*Math.PI*1.6:0,motion==="fall"?-.45*k:0] as V3};
}
function modelExtent(parts: Part[]): { minY: number; maxY: number; radiusXZ: number } {
  if (!Array.isArray(parts) || parts.length === 0) return { minY: -0.5, maxY: 0.5, radiusXZ: 0.5 };
  let minY = Infinity, maxY = -Infinity, maxR = 0.25;
  for (const part of parts) {
    if (!part || !Array.isArray(part)) continue;
    const [, , at, size, rot = [0, 0, 0]] = part;
    if (!size || !Array.isArray(size) || !at || !Array.isArray(at)) continue;
    const rotVec = (Array.isArray(rot) && rot.length >= 3) ? rot : [0, 0, 0];
    const e = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotVec.map(THREE.MathUtils.degToRad) as V3)).elements;
    const halfY = (Math.abs(e[1]) * (size[0] ?? 1) + Math.abs(e[5]) * (size[1] ?? 1) + Math.abs(e[9]) * (size[2] ?? 1)) / 2;
    minY = Math.min(minY, (at[1] ?? 0) - halfY);
    maxY = Math.max(maxY, (at[1] ?? 0) + halfY);
    const rx = Math.abs(at[0] ?? 0) + Math.max(size[0] ?? 0.4, size[2] ?? 0.4) * 0.5;
    const rz = Math.abs(at[2] ?? 0) + Math.max(size[0] ?? 0.4, size[2] ?? 0.4) * 0.5;
    maxR = Math.max(maxR, Math.hypot(rx, rz) * 0.72);
  }
  return {
    minY: isFinite(minY) ? minY : -0.5,
    maxY: isFinite(maxY) ? maxY : 0.5,
    radiusXZ: Math.min(1.6, maxR),
  };
}

function bottom(parts: Part[]) {
  return modelExtent(parts).minY;
}

export function resolveStageItems(
  stage: Stage,
  models?: Models,
  actorKeepOut?: { x: number; z: number; r: number }
): Item[] {
  const raw = Array.isArray(stage?.items) ? stage.items : [];
  if (!models || raw.length === 0) return raw;

  const placed: Array<{ item: Item; r: number; minY: number; maxY: number; isProp: boolean }> = [];
  for (const orig of raw) {
    if (!orig || !Array.isArray(orig) || !orig[0]) continue;
    const name = orig[0];
    const parts = models[name];
    const ext = parts ? modelExtent(parts) : { minY: -0.5, maxY: 0.5, radiusXZ: 0.45 };
    const sc = orig[3] ?? 1;
    const from: V3 = Array.isArray(orig[1]) && orig[1].length >= 3 ? [orig[1][0], orig[1][1], orig[1][2]] : [0.8, 0.5, -0.3];
    const to: V3 = Array.isArray(orig[2]) && orig[2].length >= 3 ? [orig[2][0], orig[2][1], orig[2][2]] : [...from];
    const motion = (orig[4] ?? "still") as Motion;
    const isPerformer = Array.isArray(parts) && parts.some((p) => p && p[0] === "performer");
    const r = Math.max(0.25, ext.radiusXZ * sc);
    const minY = ext.minY * sc;
    const maxY = ext.maxY * sc;

    if (motion !== "travel" && !isPerformer) {
      // 1. Mantém objetos fora do corpo do personagem principal
      if (actorKeepOut) {
        for (const pt of [from, to]) {
          const dx = pt[0] - actorKeepOut.x;
          const dz = pt[2] - actorKeepOut.z;
          const dist = Math.hypot(dx, dz);
          const minDist = actorKeepOut.r + r * 0.85;
          if (dist < minDist) {
            pt[0] = Math.min(2.2, Math.max(0.42, actorKeepOut.x + minDist));
          }
        }
      }

      // 2. Separa objetos lado a lado no plano XZ (preservando objetos empilhados no eixo Y)
      for (const prev of placed) {
        if (!prev.isProp || prev.item[4] === "travel") continue;
        const pFrom = prev.item[1];
        const horiz = Math.hypot(from[0] - pFrom[0], from[2] - pFrom[2]);
        const dy = Math.abs(from[1] - pFrom[1]);
        const stacked = horiz < 0.32 && dy >= 0.32 * Math.min(sc, prev.item[3] ?? 1);
        if (stacked) continue;

        const yA0 = from[1] + minY, yA1 = from[1] + maxY;
        const yB0 = pFrom[1] + prev.minY, yB1 = pFrom[1] + prev.maxY;
        const yOverlap = yA0 < yB1 - 0.05 && yB0 < yA1 - 0.05;
        const minSep = r + prev.r + 0.16;
        if (yOverlap && horiz < minSep) {
          const push = minSep - horiz;
          let ux = horiz > 0.02 ? (from[0] - pFrom[0]) / horiz : 0.85;
          let uz = horiz > 0.02 ? (from[2] - pFrom[2]) / horiz : 0.52;
          // Se empurrar para cima do ator, desloca em +x/+z
          if (actorKeepOut && from[0] + ux * push < actorKeepOut.x + actorKeepOut.r + r * 0.5) {
            ux = Math.abs(ux) + 0.35;
            const len = Math.hypot(ux, uz) || 1;
            ux /= len; uz /= len;
          }
          const dx = ux * push, dz = uz * push;
          from[0] = Math.max(-2.1, Math.min(2.35, from[0] + dx));
          from[2] = Math.max(-1.8, Math.min(0.85, from[2] + dz));
          to[0] = Math.max(-2.1, Math.min(2.35, to[0] + dx));
          to[2] = Math.max(-1.8, Math.min(0.85, to[2] + dz));
        }
      }
    }

    placed.push({
      item: [name, from, to, sc, motion],
      r,
      minY,
      maxY,
      isProp: !isPerformer,
    });
  }
  return placed.map((p) => p.item);
}

export function StageObjects({
  stage,
  models,
  t,
  duration,
  acting,
  actorKeepOut,
}: {
  stage: Stage;
  models: Models;
  t: number;
  duration: number;
  acting: Pose;
  actorKeepOut?: { x: number; z: number; r: number };
}) {
  const items = useMemo(
    () => resolveStageItems(stage, models, actorKeepOut),
    [stage, models, actorKeepOut?.x, actorKeepOut?.z, actorKeepOut?.r]
  );
  if (!items.length || !models) return null;
  return <>{items.map((item, i) => {
    if (!item || !item[0] || !models[item[0]]) return null;
    const parts = models[item[0]] ?? [];
    const body = Array.isArray(parts) ? parts.find((p) => p && p[0] === "performer") : undefined;
    const anim = pose(item, t, duration, stage.beat ?? 0), pos = anim.position;
    if (stage.set !== "space") pos[1] = Math.max(pos[1], .035 - bottom(parts) * anim.scale);
    if (body && body[3]) {
      const h = item[3] * (body[3][1] ?? 1) * 1.55;
      const feet: V3 = [pos[0], Math.max(.03, pos[1] - h / 2), pos[2]];
      return <Person key={i} p={feet} h={h} f={Math.round(t * 30)}
        look={{ body: body[1] ?? "#ff6b35", skin: "#cb916e", hair: "swept", hairColor: "#352a32", outfit: "shirt", shoe: "#243343" }}
        pose={i === 0 || stage.frame === "actor" ? acting : { t: t * 30, mood: "smile", lookX: Math.sin(t) * .3 }} />;
    }
    const movingLight = item[4] === "travel" && Array.isArray(parts) && parts.some((p) => p && p[0] === "light");
    const modelColor = (Array.isArray(parts) && parts[0] && parts[0][1]) ? parts[0][1] : "#f2c94c";
    return <React.Fragment key={i}>
      {movingLight && Array.from({ length: 12 }, (_, j) => {
        const tail = pose(item, Math.max(0, t - (j + 1) * .038), duration, stage.beat ?? 0);
        return <mesh key={j} position={tail.position}><sphereGeometry args={[item[3] * .17 * (1 - j / 13), 12, 8]} />
          <meshBasicMaterial color={modelColor} transparent opacity={.6 - j * .04} /></mesh>;
      })}
      {stage.set !== "space" && pos[1] < 1.3 && <Shadow p={[pos[0], .018, pos[2]]} r={item[3] * .38} o={.22} />}
      <group {...anim}>
        {Array.isArray(parts) && parts.map((part, j) => <Piece key={j} part={part} t={t}
          progress={clamp((t - Math.min(stage.beat ?? 0, duration * .68)) / Math.max(.2, duration - Math.min(stage.beat ?? 0, duration * .68)))}
          visibility={item[4] === "dim" ? 1 - .96 * clamp((t - Math.min(stage.beat ?? 0, duration * .72)) / .48) : 1} />)}
      </group>
    </React.Fragment>;
  })}</>;
}
export function StageBackdrop({stage,t}:{stage:Stage;t:number}){
  if(stage.set==="stadium"){
    const day=stage.light!=="night";
    return <>
      <hemisphereLight args={[day?"#e2f0d9":"#1a2a3a",day?"#275a27":"#0e1a14",1.6]}/>
      <directionalLight position={[0,12,6]} intensity={day?2.6:1.8} color="#ffffff" castShadow/>
      {/* Stadium grass pitch */}
      <mesh position={[0,-.01,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[48,48]}/>
        <meshStandardMaterial color="#2d7c38" roughness={0.8}/>
      </mesh>
      {/* Pitch Lines (center circle, midline) */}
      <Box p={[0,.002,-4]} s={[28,.003,.12]} color="#ffffff" line={0}/>
      <group position={[0,.003,-4]} rotation={[-Math.PI/2,0,0]}>
        <mesh><ringGeometry args={[3.8,3.95,32]}/><meshBasicMaterial color="#ffffff"/></mesh>
        <mesh><circleGeometry args={[.22,16]}/><meshBasicMaterial color="#ffffff"/></mesh>
      </group>
      {/* Goal Post in background */}
      <group position={[0,0,-10]}>
        <Cyl p={[-3.2,1.6,0]} rt={.1} rb={.1} h={3.2} color="#ffffff"/>
        <Cyl p={[3.2,1.6,0]} rt={.1} rb={.1} h={3.2} color="#ffffff"/>
        <Cyl p={[0,3.2,0]} rt={.1} rb={.1} h={6.5} color="#ffffff" rot={[0,0,Math.PI/2]}/>
        <Box p={[0,1.6,-1.2]} s={[6.4,3.2,2.4]} color="#e8eff5" transparent opacity={0.3}/>
      </group>
      {/* Stadium Grandstands in background */}
      {Array.from({length:6},(_,i)=>(
        <Box key={i} p={[0,i*.75+1.2,-14-i*2]} s={[44,.8,2.4]} color={i%2?"#1b324b":"#254465"} line={0}/>
      ))}
      {/* Crowd dots */}
      {Array.from({length:32},(_,i)=>(
        <mesh key={i} position={[(i%16-7.5)*2.4,Math.floor(i/16)*.75+2.2,-14-Math.floor(i/16)*2]}>
          <sphereGeometry args={[.28,8,8]}/>
          <meshBasicMaterial color={["#ffd166","#ef476f","#06d6a0","#118ab2","#ffffff"][i%5]}/>
        </mesh>
      ))}
      {/* Stadium Floodlight Towers */}
      {[-12,12].map(x=>(
        <group key={x} position={[x,0,-12]}>
          <Cyl p={[0,6,0]} rt={.25} rb={.4} h={12} color="#78909c"/>
          <Box p={[0,12,0]} s={[2.8,1.4,1]} color="#cfd8dc"/>
          <Glow p={[0,12,0]} r={6} color="rgba(255,255,255,0.8)" o={0.7}/>
        </group>
      ))}
      <Dust t={t} n={18} area={[6,6,6]} color="rgba(255,255,255,.6)"/>
    </>
  }
  if(stage.set==="plaza"){
    const day=stage.light!=="night", dusk=stage.light==="dusk";
    return <>
      <hemisphereLight args={[day?"#fff0d1":"#b8cff2",day?"#b39b84":"#51657c",1.45]}/>
      <directionalLight position={[4,7,4]} intensity={day?2.2:.65} color={dusk?"#ffbe9d":"#ffedcd"}/>
      <Stars p={[0,5,-16]} s={[66,39]} n={day?0:45} t={t}
        top={day?(dusk?"#806278":"#68add2"):"#10243d"} bottom={day?"#f9ddad":"#43556f"}/>
      <Box p={[0,-.15,0]} s={[32,.28,30]} color={day?"#cebaa0":"#5b6775"} line={0}/>
      {Array.from({length:14},(_,i)=><Box key={i} p={[0,.001,-8+i*1.4]} s={[30,.003,.016]} color={day?"#9a8c75":"#505766"} line={0}/>)}
      {Array.from({length:9},(_,i)=>{
        const x=(i-4)*2.9,y=2.2+Math.sin(i*2)*.55;
        return <group key={i} position={[x,0,-8]}>
          <Box p={[0,y/2,0]} s={[2.8,y,2.2]} color={day?["#d99e73","#87b8ae","#edc897"][i%3]:"#4b5d72"}/>
          <Box p={[0,y+.08,0]} s={[3,.17,2.4]} color={day?"#f5dfb7":"#90a2ab"}/>
          {[-.8,0,.8].map((dx,j)=><Box key={j} p={[dx,1.15,1.14]} s={[.43,.86,.05]} color={day?"#457578":j===1?"#ffca79":"#263e53"}/>)}
        </group>
      })}
      {[-4,3.8].map(x=><group key={x} position={[x,0,-3.7]}>
        <Cyl p={[0,.28,0]} rt={.75} rb={.65} h={.56} color="#b17860"/>
        <Cyl p={[0,2,0]} rt={.12} rb={.2} h={3.6} color="#8e7255"/>
        {Array.from({length:9},(_,i)=><group key={i} position={[0,3.7,0]} rotation={[0,i*.698+t*.012,0]}>
          <mesh position={[.64,-.15,0]} rotation={[0,0,-.24]} scale={[1.72,.23,.55]}><sphereGeometry args={[.5,14,8]}/>
            <meshStandardMaterial color={day?(i%2?"#397c60":"#609864"):"#2c5051"}/></mesh>
        </group>)}
      </group>)}
      <Bench p={[-2.8,0,-4.4]} rotY={.12}/><StreetLamp p={[2.4,0,-4.2]} h={3.6} on={day?0:1}/>
    </>
  }
  return <><Lights warm={stage.set==="space"?"#ffdc96":"#ffe8cf"}/>
    {stage.set==="space"?<CanvasPlane isStatic p={[0,4,-18]} s={[78,78]} px={[1024,1024]} draw={(c,w,h)=>{
      const sky=c.createRadialGradient(w*.46,h*.46,0,w*.5,h*.5,w*.64);
      sky.addColorStop(0,"#233e59");sky.addColorStop(.5,"#10243d");sky.addColorStop(1,"#070e20");
      c.fillStyle=sky;c.fillRect(0,0,w,h);
      const noise=(n:number)=>{const x=Math.sin(n*93.7+1.8)*4821;return x-Math.floor(x)};
      for(let i=0;i<2200;i++){const r=.28+noise(i+990)*.92;c.fillStyle=i%5?"#adc5d9":"#ffe0a5";
        c.fillRect(noise(i)*w,noise(i+3120)*h,r,r)}
    }}/>:<>
      <mesh position={[0,-.12,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[65,65]}/><meshStandardMaterial color="#344958"/></mesh>
      <Dust t={t} n={14} area={[4,4,3]}/>
    </>}
  </>
}
export function StageCamera({
  stage,
  t,
  duration,
  cam,
  models,
  actorKeepOut,
}: {
  stage: Stage;
  t: number;
  duration: number;
  cam?: string;
  models?: Models;
  actorKeepOut?: { x: number; z: number; r: number };
}) {
  const items = useMemo(
    () => resolveStageItems(stage, models, actorKeepOut),
    [stage, models, actorKeepOut?.x, actorKeepOut?.z, actorKeepOut?.r]
  );
  const focus = (items.length > 0 && items[0]) ? items[0] : ["default", [0, 1, 0] as V3, [0, 1, 0] as V3, 1, "still" as Motion];
  const points = stage?.frame === "detail" ? [focus] : (items.length > 0 ? items : [focus]);
  const xs: number[] = [], ys: number[] = [], zs: number[] = [];
  for (const item of points) {
    if (!item || !Array.isArray(item) || !item[1] || !item[2]) continue;
    const radius = (item[3] ?? 1) * .58;
    for (const pos of [item[1], item[2]]) {
      if (Array.isArray(pos) && typeof pos[0] === "number") {
        xs.push(pos[0] - radius, pos[0] + radius); ys.push(pos[1] - radius, pos[1] + radius); zs.push(pos[2] + radius);
      }
    }
  }
  if (xs.length === 0) { xs.push(-1, 1); ys.push(0, 3); zs.push(0, 5); }
  if (actorKeepOut && stage?.frame !== "detail") {
    xs.push(actorKeepOut.x - 1.25, actorKeepOut.x + 0.85);
    ys.push(0, 3.6);
    zs.push(actorKeepOut.z + 0.35);
  }
  const mid = (a: number[]) => (Math.min(...a) + Math.max(...a)) / 2;
  const focusX = mid(xs), focusY = mid(ys);
  const distance = Math.max(3.1, (Math.max(...xs) - Math.min(...xs)) * 1.88, (Math.max(...ys) - Math.min(...ys)) * 1.15);
  const z = Math.max(...zs) + distance, orbit = cam === "orbit" ? 1.1 : cam === "whip" ? -.8 : .32;
  const height = focusY < .85 ? distance * (stage?.frame === "detail" ? .85 : .28) :
    cam === "low_angle" ? -.35 : stage?.frame === "detail" ? distance * .42 : .72;
  const lookZ = (focus[1] && focus[2] && typeof focus[1][2] === "number" && typeof focus[2][2] === "number") ? (focus[1][2] + focus[2][2]) / 2 : 0;
  const look: V3 = [focusX, focusY, lookZ];
  const endPose = pose(focus, t, duration, stage?.beat ?? 0);
  const end = endPose?.position ?? [focusX, focusY, lookZ];
  const aim: V3 = [lerp(focusX, end[0] ?? focusX, .13), lerp(focusY, end[1] ?? focusY, .13), look[2]];
  return <Cam t={t} keys={[
    { t: 0, pos: [focusX - orbit, focusY + height, z + .8], look, roll: cam === "dutch" ? .085 : 0, fov: 55 },
    { t: duration * .46, pos: [focusX, focusY + height * .72, z + .16], look: aim, fov: 54 },
    { t: duration, pos: [focusX + orbit * .75, focusY + height * .4, z], look: aim, fov: 54 }
  ]} impacts={cam === "shake" ? [[stage?.beat ?? 0, .09]] : []} />;
}
