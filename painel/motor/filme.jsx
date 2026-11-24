import React, {useMemo} from 'react';
import {AbsoluteFill, Composition, Sequence, registerRoot, useCurrentFrame} from 'remotion';
import * as T from 'three';
import {SVGRenderer} from 'three/examples/jsm/renderers/SVGRenderer.js';
import {Formigas} from './formigas';
import {Mosquitos} from './mosquitos';

const shapes={
 sphere:()=>new T.IcosahedronGeometry(1,1), box:()=>new T.BoxGeometry(1.6,1.6,1.6),
 cylinder:()=>new T.CylinderGeometry(.85,.85,1.65,18), cone:()=>new T.ConeGeometry(.95,1.9,16),
 ring:()=>new T.TorusGeometry(.9,.21,8,28), disc:()=>new T.CylinderGeometry(1,1,.2,32),
 capsule:()=>new T.CapsuleGeometry(.49,1,4,12)
};
function part(parent,geometry,color,x,y,z){
 const mesh=new T.Mesh(geometry,new T.MeshLambertMaterial({color,flatShading:true}));
 mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function figure(o){
 const group=new T.Group(),round=new T.SphereGeometry(1,14,10),ink='#392d29';
 if(o.shape==='person'){
   part(group,new T.CapsuleGeometry(.37,.47,3,12),o.color,0,-.22,0);
   part(group,round,'#d69c72',0,.63,0).scale.set(.49,.51,.39);
   for(const side of [-1,1]){
     part(group,round,ink,side*.16,.67,.36).scale.set(.048,.064,.04);
     part(group,new T.CapsuleGeometry(.10,.42,3,8),ink,side*.18,-.94,0);
     part(group,new T.CapsuleGeometry(.09,.38,3,8),o.color,side*.45,-.16,0).rotation.z=side*.24;
   }
 }else if(o.shape==='bus'){
   part(group,new T.BoxGeometry(2.5,1.14,.83),o.color,0,0,0);
   for(let i=-2;i<=2;i++)part(group,new T.BoxGeometry(.34,.39,.04),'#a9d4d5',i*.45,.18,.43);
   for(const x of [-.79,.79])part(group,round,ink,x,-.55,.29).scale.set(.27,.27,.18);
 }else if(o.shape==='cup'){
   part(group,new T.CylinderGeometry(.61,.44,.88,24),o.color,0,0,0);
   part(group,new T.CylinderGeometry(.55,.55,.025,24),ink,0,.45,0);
   part(group,new T.TorusGeometry(.25,.07,6,18),o.color,.64,.06,0);
 }else if(o.shape==='bread'){
   part(group,new T.IcosahedronGeometry(1,2),o.color,0,0,0).scale.set(.95,.67,.86);
   for(const x of [-.37,0,.37])part(group,round,'#c4803e',x,.25,.61).scale.set(.07,.11,.055);
 }else part(group,shapes[o.shape](),o.color,0,0,0);
 return group;
}
function illustration(objects,color) {
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-5,5,5,-5,.1,100);
 camera.position.set(0,1.2,15);camera.lookAt(0,0,0);
 const renderer=new SVGRenderer();renderer.setSize(880,880);renderer.setPrecision(2);
 scene.add(new T.AmbientLight(0xfff4da,1.65));
 const lamp=new T.DirectionalLight(0xffedce,1.8);lamp.position.set(-3,5,7);scene.add(lamp);
 const meshes=objects.map(o=>{
   const mesh=figure(o);
   scene.add(mesh); mesh.scale.set(...o.scale);return mesh;
 });
 return progress=>{
   const u=progress*progress*(3-2*progress);
   meshes.forEach((mesh,i)=>{
     const o=objects[i];mesh.position.set(...o.start.map((n,k)=>n+(o.end[k]-n)*u));
     mesh.rotation.set(...o.turn.map(n=>n*Math.PI/180*u));
   });
   camera.zoom=1+.045*u;camera.updateProjectionMatrix();renderer.render(scene,camera);
   renderer.domElement.style.backgroundColor=color;
   return renderer.domElement.outerHTML;
 };
}
function Shot({shot,palette,index,total,channel}){
 const frame=useCurrentFrame(),p=frame/Math.max(1,shot.frames-1);
 const draw=useMemo(()=>illustration(shot.objects,palette[1]),[shot,palette]);
 const cue=shot.captions.filter(c=>c.frame<=frame).at(-1)?.text||'';
 return <AbsoluteFill style={{background:palette[0],fontFamily:'Arial, sans-serif',color:'#fff7e6'}}>
   <div style={{position:'absolute',top:95,left:86,fontWeight:700,fontSize:33,letterSpacing:3,maxWidth:840}}>{channel}</div>
   <div style={{position:'absolute',top:225,left:80,right:110,fontWeight:800,fontSize:78,letterSpacing:-3,lineHeight:1.05}}>{shot.title}</div>
   <div style={{position:'absolute',top:465,left:82,width:880,height:880,borderRadius:55,overflow:'hidden',border:'5px solid #ffffff28',boxShadow:'0 15px 0 #0003'}} dangerouslySetInnerHTML={{__html:draw(p)}}/>
   <div style={{position:'absolute',top:1430,left:95,right:135,textAlign:'center',fontSize:53,fontWeight:700,lineHeight:1.17}}>{cue}</div>
   <div style={{position:'absolute',bottom:195,left:92,right:122,height:5,background:'#ffffff24'}}><div style={{height:5,width:((index+p)/total*100)+'%',background:'#fff7df'}}/></div>
 </AbsoluteFill>;
}
function Film(props){
 const {shots,palette,channel}=props;
 if(props.visual==='formigas-v1') return <Formigas {...props}/>;
 if(props.visual==='mosquitos-v1') return <Mosquitos {...props}/>;
 let start=0;
 return <AbsoluteFill>{shots.map((shot,i)=>{const from=start;start+=shot.frames;
 return <Sequence key={i} from={from} durationInFrames={shot.frames}><Shot shot={shot} channel={channel} palette={palette} index={i} total={shots.length}/></Sequence>})}</AbsoluteFill>
}
registerRoot(()=> <Composition id="Corte" width={1080} height={1920} fps={30} durationInFrames={1830} component={Film} defaultProps={{seconds:61,shots:[],palette:['#19231d','#d9c593'],channel:''}} calculateMetadata={({props})=>({durationInFrames:props.totalFrames??Math.round(props.seconds*30)})}/>);
