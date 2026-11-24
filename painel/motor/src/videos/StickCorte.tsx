import React from "react";
import * as THREE from "three";
import {Models, Stage, StageBackdrop, StageCamera, StageObjects} from "./DirectedStage";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  spring,
  Easing,
  Audio,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Shadow, Box, Cyl, Ball, CanvasPlane } from "../style/toon";
import { Look, Pose } from "../style/puppet";
import { Person, Lights, Desk, Clock, seg, lerp, clamp, V3 } from "../style/kit";
import {
  Floor,
  WallDoor,
  SideWall,
  Glow,
  Frame,
  Cabinet,
  Plant,
  Shelf,
  WindowCity,
  Lamp,
  Monitor,
  Chair,
  Rug,
  Dust,
} from "../style/props";
import {
  Cam,
  Building,
  StreetLamp,
  Hydrant,
  Bench,
  Arrow3D,
  Globe,
  Stars,
} from "../style/extra";

const FPS = 30;
const LEAD = 5;
const TAIL = 0;

export interface AnimKeyframe {
  at: number;
  x?: number;
  y?: number;
  z?: number;
  roll?: number;
  arms?: Pose["arms"];
  armR?: [number, number];
  armL?: [number, number];
  mood?: Pose["mood"];
  squash?: number;
  hunch?: number;
  tilt?: number;
  nerv?: number;
  sweat?: number;
  air?: number;
  walk?: number;
  speed?: number;
  lookX?: number;
  flip?: boolean;
  shake?: number;
}

export interface AnimSpec {
  descricao?: string;
  loop?: boolean;
  keyframes: AnimKeyframe[];
}

export interface ShotConfig {
  stage?: Stage;
  title?: string;
  fala: string;
  from: number;
  frames: number;
  mood?: "shock" | "worry" | "panic" | "grin" | "laugh" | "angry" | "deadpan" | "smile";
  action?: string;
  animacao?: string;
  env?: string;
  cam?: "push" | "orbit" | "whip" | "low_angle" | "shake" | "dutch";
  trans?: "ghost" | "zoom" | "flash" | "whip";
  sfx?: string;
  bg?: string;
  prop?: "coin" | "singularity" | "globe" | "clock" | "warning" | "screen" | "building" | "taxi" | "none";
  highlightText?: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface StickCorteProps extends Record<string, unknown> {
  models?: Models;
  animations?: Record<string, AnimSpec>;
  shots: ShotConfig[];
  words?: WordTiming[];
  scriptTokens?: string[];
  totalFrames?: number;
  audioFile?: string;
  character?: Look;
}

const defaultCharacter: Look = {
  skin: "#fbe3c8",
  body: "#ff6b35",
  outfit: "hoodie",
  hair: "short",
  hairColor: "#1b1b2a",
  shoe: "#1b1b2a",
};

type Ctx = { t: number; f: number; relT: number; dur: number; shot: ShotConfig };

/* ---------- 3D Hero Props ---------- */
export const Coin3D: React.FC<{ p: V3; t: number; s?: number }> = ({ p, t, s = 1 }) => (
  <group position={p} scale={s} rotation={[0.2, t * 2.8, 0]}>
    <Cyl p={[0, 0, 0]} rt={0.65} rb={0.65} h={0.12} color="#f2c94c" line={3} rot={[Math.PI / 2, 0, 0]} />
    <mesh position={[0, 0, 0.07]}>
      <circleGeometry args={[0.55, 32]} />
      <meshStandardMaterial color="#ffe082" roughness={0.3} metalness={0.7} />
    </mesh>
    <mesh position={[0, 0, -0.07]} rotation={[0, Math.PI, 0]}>
      <circleGeometry args={[0.55, 32]} />
      <meshStandardMaterial color="#ffe082" roughness={0.3} metalness={0.7} />
    </mesh>
    <Glow p={[0, 0, 0]} r={1.6} color="rgba(255,220,70,0.6)" o={0.45} />
  </group>
);

export const Singularity3D: React.FC<{ p: V3; t: number; s?: number }> = ({ p, t, s = 1 }) => (
  <group position={p} scale={s}>
    {/* Event horizon (pitch black sphere with back-side outline) */}
    <mesh>
      <sphereGeometry args={[0.45, 32, 32]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
    <mesh scale={1.08}>
      <sphereGeometry args={[0.45, 32, 32]} />
      <meshBasicMaterial color="#ff5500" side={THREE.BackSide} />
    </mesh>
    {/* Swirling incandescent accretion disc */}
    <group rotation={[1.1, t * 2.2, 0]}>
      <mesh>
        <torusGeometry args={[0.95, 0.22, 16, 64]} />
        <meshStandardMaterial color="#ff7700" emissive="#ff3300" emissiveIntensity={0.85} roughness={0.4} />
      </mesh>
      <mesh scale={1.28}>
        <torusGeometry args={[1.05, 0.1, 8, 48]} />
        <meshBasicMaterial color="#ffd000" transparent opacity={0.65} />
      </mesh>
    </group>
    <Glow p={[0, 0, 0]} r={3.0} color="rgba(255,100,20,0.7)" o={0.55} />
  </group>
);

export const Warning3D: React.FC<{ p: V3; t: number; s?: number }> = ({ p, t, s = 1 }) => {
  const pulse = 1 + 0.12 * Math.sin(t * 8);
  return (
    <group position={p} scale={s * pulse} rotation={[0, Math.sin(t * 2) * 0.3, 0]}>
      <CanvasPlane p={[0, 0, 0]} s={[1.8, 1.8]} px={[256, 256]} draw={(c, W, H) => {
        c.clearRect(0, 0, W, H);
        c.beginPath();
        c.moveTo(W / 2, 16);
        c.lineTo(W - 16, H - 24);
        c.lineTo(16, H - 24);
        c.closePath();
        c.fillStyle = "#ffcc00";
        c.fill();
        c.lineWidth = 14;
        c.strokeStyle = "#111111";
        c.stroke();
        c.fillStyle = "#111111";
        c.font = "900 110px Inter, Arial";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("!", W / 2, H * 0.62);
      }} />
      <Glow p={[0, 0, 0]} r={2.5} color="rgba(255,60,40,0.7)" o={0.5} />
    </group>
  );
};

export const HoloScreen3D: React.FC<{ p: V3; t: number; s?: number }> = ({ p, t, s = 1 }) => (
  <group position={p} scale={s} rotation={[0, -0.25, 0]}>
    <CanvasPlane p={[0, 0, 0]} s={[2.8, 1.8]} px={[560, 360]} additive draw={(c, W, H) => {
      c.clearRect(0, 0, W, H);
      c.fillStyle = "rgba(10,35,60,0.65)";
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "#2ee6c5";
      c.lineWidth = 6;
      c.strokeRect(4, 4, W - 8, H - 8);
      c.font = "900 32px Inter, Arial";
      c.fillStyle = "#2ee6c5";
      c.fillText("ANOMALIA DETECTADA", 24, 45);
      // animated waveform
      c.lineWidth = 4;
      c.strokeStyle = "#ff4466";
      c.beginPath();
      for (let x = 0; x < W; x += 10) {
        const y = H * 0.6 + Math.sin(x * 0.05 + t * 9) * 45;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }} />
    <Glow p={[0, 0, 0]} r={3} color="rgba(46,230,197,0.4)" o={0.3} />
  </group>
);

export const SoccerBall3D: React.FC<{ p: V3; t: number; s?: number; rotSpeed?: number }> = ({ p, t, s = 1, rotSpeed = 3 }) => (
  <group position={p} scale={s} rotation={[t * rotSpeed * 0.7, t * rotSpeed, 0]}>
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[0.55, 32, 32]} />
      <meshStandardMaterial color="#f8fafc" roughness={0.4} />
    </mesh>
    {[
      [0, 0.55, 0], [0, -0.55, 0],
      [0.48, 0.2, 0.2], [-0.48, -0.2, -0.2],
      [-0.48, 0.2, 0.2], [0.48, -0.2, -0.2],
      [0.2, 0.2, 0.48], [-0.2, -0.2, -0.48],
      [-0.2, 0.2, -0.48], [0.2, -0.2, 0.48]
    ].map((pos, i) => (
      <mesh key={i} position={pos as V3}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
    ))}
    <Glow p={[0, 0, 0]} r={1.6} color="rgba(255,255,255,0.4)" o={0.3} />
  </group>
);

export const GoalPost3D: React.FC<{ p: V3; t: number; s?: number }> = ({ p, t, s = 1 }) => (
  <group position={p} scale={s}>
    <Cyl p={[-1.6, 1.1, 0]} rt={0.08} rb={0.08} h={2.2} color="#ffffff" />
    <Cyl p={[1.6, 1.1, 0]} rt={0.08} rb={0.08} h={2.2} color="#ffffff" />
    <Cyl p={[0, 2.2, 0]} rt={0.08} rb={0.08} h={3.36} color="#ffffff" rot={[0, 0, Math.PI / 2]} />
    <Box p={[0, 1.1, -0.6]} s={[3.2, 2.2, 1.2]} color="#ffffff" transparent opacity={0.3} />
    <Glow p={[0, 1.5, 0]} r={2.8} color="rgba(255,255,255,0.4)" o={0.25} />
  </group>
);

export const Scale3D: React.FC<{ p: V3; t: number; s?: number }> = ({ p, t, s = 1 }) => (
  <group position={p} scale={s} rotation={[0, Math.sin(t * 1.5) * 0.2, 0]}>
    <Cyl p={[0, 0.1, 0]} rt={0.9} rb={0.9} h={0.2} color="#334155" />
    <Cyl p={[0, 0.7, -0.3]} rt={0.08} rb={0.08} h={1.2} color="#64748b" />
    <group position={[0, 1.4, -0.3]} rotation={[0.2, 0, 0]}>
      <Cyl p={[0, 0, 0]} rt={0.55} rb={0.55} h={0.12} color="#ffffff" rot={[Math.PI / 2, 0, 0]} />
      <Cyl p={[0, 0.15, 0.07]} rt={0.02} rb={0.02} h={0.35} color="#ef4444" rot={[0, 0, -0.8 + Math.sin(t * 4) * 0.1]} />
    </group>
    <Glow p={[0, 1.4, -0.3]} r={1.8} color="rgba(100,200,255,0.4)" o={0.3} />
  </group>
);

export const Cleat3D: React.FC<{ p: V3; t: number; s?: number }> = ({ p, t, s = 1 }) => (
  <group position={p} scale={s} rotation={[0.2, t * 1.8, -0.1]}>
    <Box p={[0, 0.2, 0]} s={[0.5, 0.35, 1.3]} color="#111827" />
    <Box p={[0, 0.45, -0.2]} s={[0.45, 0.4, 0.65]} color="#ef4444" />
    {[-0.15, 0.15].map(x =>
      [-0.4, -0.1, 0.2, 0.5].map((z, j) => (
        <Box key={`${x}-${z}-${j}`} p={[x, 0.01, z]} s={[0.08, 0.1, 0.08]} color="#facc15" />
      ))
    )}
    <Glow p={[0, 0.3, 0]} r={1.8} color="rgba(239,68,68,0.4)" o={0.35} />
  </group>
);

/* ---------- Dynamic Scene Transition Wrapper ---------- */
const SceneWrapper: React.FC<{
  startFrame: number;
  durationFrames: number;
  first?: boolean;
  trans?: "ghost" | "zoom" | "flash" | "whip";
  bg: string;
  children: (c: { t: number; f: number }) => React.ReactNode;
}> = ({ startFrame, durationFrames, first, trans = "ghost", bg, children }) => {
  const from = startFrame;
  const dur = durationFrames + TAIL;

  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <SceneInner from={from} first={first} trans={trans} bg={bg}>
        {children}
      </SceneInner>
    </Sequence>
  );
};

const SceneInner: React.FC<{
  from: number;
  first?: boolean;
  trans: "ghost" | "zoom" | "flash" | "whip";
  bg: string;
  children: (c: { t: number; f: number }) => React.ReactNode;
}> = ({ from, first, trans, bg, children }) => {
  const f = useCurrentFrame();
  const t = (f + from) / FPS;
  const k = first ? 1 : clamp(f / (LEAD + 2));
  const ke = Easing.out(Easing.cubic)(k);

  const sc = !first && trans === "zoom" ? lerp(1.18, 1, ke) : 1;
  const tx = !first && trans === "whip" ? (1 - ke) * 720 : 0;

  return (
    <AbsoluteFill
      style={{
        opacity: first || trans === "flash" || trans === "whip" ? 1 : lerp(0.25, 1, k),
        transform: `translateX(${tx.toFixed(1)}px) scale(${sc.toFixed(4)})`,
        background: bg,
        filter: "saturate(1.22) contrast(1.05)",
      }}
    >
      <ThreeCanvas
        width={720}
        height={1280}
        camera={{ fov: 62, position: [0, 2, 8], near: 0.1, far: 200 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[bg]} />
        {children({ t, f })}
      </ThreeCanvas>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "radial-gradient(circle at 50% 48%, transparent 58%, rgba(5,10,20,0.52) 100%)",
        }}
      />
      {!first && trans === "flash" ? (
        <AbsoluteFill
          style={{ background: "#ffffff", opacity: 1 - clamp(f / 7) }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/* ---------- 3D Environment Builders ---------- */
const OfficeSet: React.FC<{ t: number; f: number; isNight?: boolean }> = ({ t, f, isNight }) => (
  <>
    <Lights warm={isNight ? "#7ab0ff" : "#fff2df"} />
    <Floor kind="plank" a="#8a4a28" b="#7a3f22" unit={2} w={24} d={24} />
    <WallDoor z={-7} W={26} kind="wood" a="#b2713d" b="#a2662f" door={{ x: 4.6, w: 2.4, h: 4.2 }} base="#5a2e18" />
    <SideWall x={-10} kind="plain" a="#6d3a1e" b="#6d3a1e" />
    <SideWall x={10} kind="plain" a="#6d3a1e" b="#6d3a1e" />
    <WindowCity p={[-6.2, 4.2, -6.9]} s={[3.2, 3.8]} dusk={!isNight} />
    <WindowCity p={[6.2, 4.2, -6.9]} s={[3.2, 3.8]} dusk={!isNight} />
    <Desk p={[-4.8, 0, -5.2]} w={3.2} top="#e2c8a2" leg="#5a3d28" />
    <Monitor p={[-5.1, 1.1, -5.2]} rot={[0, 0.2, 0]} screen={Math.sin(t * 6) > 0.92 ? "#cadad2" : isNight ? "#ff3b4b" : "#2ee6c5"} />
    <Monitor p={[-4.0, 1.1, -5.1]} rot={[0, -0.15, 0]} screen="#f2c94c" />
    <Lamp p={[-5.8, 1.1, -5.1]} color="#ffe082" />
    <Plant p={[3.8, 0, -4.8]} s={1.3} />
    <Frame p={[0, 4.2, -6.85]} s={[2.1, 1.5]} art={2} />
    <Chair p={[-4.6, 0, -4.1]} />
    <Cabinet p={[2.4, 0, -6.2]} />
    <Rug p={[0, 0, -1.2]} s={[5.8, 4.2]} a="#243447" b="#f2c94c" />
    <Dust t={t} n={18} area={[4, 5, 4]} />
  </>
);

const StreetSet: React.FC<{ t: number; f: number; light?: Stage["light"] }> = ({ t, f, light = "night" }) => (
  <>
    <Lights warm={light === "day" ? "#fff2cc" : light === "dusk" ? "#ffb580" : "#85a3c2"} />
    <Stars p={[0, 8, -18]} s={[46, 24]} t={t} n={light==="night"?140:0}
      top={light==="night"?"#0a0624":light==="day"?"#438bbb":"#5e577e"}
      bottom={light==="night"?"#3a1a6e":light==="day"?"#c6e9dc":"#efaa84"} />
    <Floor kind="tile" a="#2b2d42" b="#1f2030" unit={1.5} w={30} d={30} />
    <Building p={[-8, 0, -9]} s={[6, light==="night"?18:6, 5]} color={light==="night"?"#1d2238":"#b29780"} />
    <Building p={[0, 0, -11]} s={[8, light==="night"?22:4, 6]} color={light==="night"?"#252b48":"#78a5a2"} />
    <Building p={[8, 0, -9]} s={[6, light==="night"?18:7, 5]} color={light==="night"?"#181c30":"#d79866"} />
    <StreetLamp p={[-4.5, 0, -4.5]} />
    <StreetLamp p={[4.5, 0, -4.5]} />
    {Array.from({length: 8}, (_, i) => <Box key={i} p={[(i - 3.5) * 1.2, 0.03, -2.8]} s={[0.55, 0.04, 1.6]} color="#e2d8af" />)}
    <Hydrant p={[3.8, 0, -3.2]} />
    <Bench p={[-3.5, 0, -4.0]} rotY={0.3} />
    <Glow p={[0, 7, -8]} r={6} color="rgba(255,200,80,0.3)" o={0.25} />
    {/* Background crowd character */}
    <Person p={[-4.5, 0, -5.5]} h={2.2} look={{skin: "#cb916e", body: "#3b5998", outfit: "shirt", hair: "short"}} pose={{t: f, mood: "worry", arms: "head", nerv: 0.6}} f={f} />
    <Person p={[4.5, 0, -6.5]} h={2.0} look={{skin: "#fbe3c8", body: "#7b3294", outfit: "hoodie", hair: "swept"}} pose={{t: f, mood: "shock", arms: "point", nerv: 0.5}} f={f} />
  </>
);

const LabSet: React.FC<{ t: number; f: number; alert?: boolean }> = ({ t, f, alert }) => (
  <>
    <Lights warm={alert ? "#ff4060" : "#55e0ff"} />
    <Floor kind="tile" a={alert ? "#2a1518" : "#0e3542"} b={alert ? "#1c0d10" : "#09242d"} unit={1.8} w={28} d={28} />
    <WallDoor z={-7.5} W={28} kind="plain" a={alert ? "#38171c" : "#0b2a36"} b={alert ? "#38171c" : "#0b2a36"} base="#06151c" />
    <SideWall x={-10} kind="plain" a="#0b2a36" b="#0b2a36" />
    <SideWall x={10} kind="plain" a="#0b2a36" b="#0b2a36" />
    <CanvasPlane
      p={[0, 4.8, -7.3]}
      s={[8.8, 4.2]}
      px={[880, 420]}
      frame={alert ? "#ff2a3b" : "#2ee6c5"}
      draw={(ctx, W, H) => {
        ctx.fillStyle = alert ? "#1c080b" : "#04151e";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = alert ? "rgba(255,60,80,0.25)" : "rgba(46,230,197,0.2)";
        ctx.lineWidth = 2;
        for (let i = 1; i < 7; i++) {
          ctx.beginPath();
          ctx.moveTo(0, (H * i) / 7);
          ctx.lineTo(W, (H * i) / 7);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo((W * i) / 7, 0);
          ctx.lineTo((W * i) / 7, H);
          ctx.stroke();
        }
        ctx.fillStyle = alert ? "#ff4060" : "#2ee6c5";
        ctx.font = "900 36px Inter, Arial";
        ctx.fillText(alert ? "⚠️ ALERTA MÁXIMO • IMPACTO" : "SISTEMA DE ANÁLISE • ATIVO", 30, 50);

        // animated sine/waveform
        ctx.lineWidth = 6;
        ctx.strokeStyle = alert ? "#ff2a3b" : "#f2c94c";
        ctx.beginPath();
        for (let x = 0; x < W; x += 10) {
          const y = H * 0.55 + Math.sin(x * 0.03 + t * 6) * (alert ? 60 : 35);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }}
    />
    <Glow p={[0, 4.8, -6.8]} r={5} color={alert ? "rgba(255,40,60,0.8)" : "rgba(46,230,197,0.6)"} o={0.3} />
    <Desk p={[0, 0, -5]} />
    {Array.from({length: 12}, (_, i) => <Cyl key={i} p={[(i - 5.5) * 0.23, 1.38, -5]} rt={0.09} h={0.46} color={i % 2 ? "#2ee6c5" : "#ff7890"} />)}
    <Shelf p={[-4.5, 0, -6.5]} />
    <Shelf p={[4.5, 0, -6.5]} />
    <Person p={[-3.8, 0, -4.8]} h={2.1} look={{skin: "#fbe3c8", body: "#2e86c1", outfit: "suit", hair: "short"}} pose={{t: f, mood: "worry", arms: "hold"}} f={f} />
  </>
);

const DangerSet: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const flash = Math.sin(t * 8) > 0;
  return (
    <>
      <Lights warm={flash ? "#ff2b3b" : "#ff7700"} />
      <Floor kind="tile" a="#241416" b="#180c0d" unit={2} w={30} d={30} />
      <WallDoor z={-7} W={26} kind="plain" a="#2c1216" b="#2c1216" base="#140608" />
      {Array.from({length: 16}, (_, i) => <Box key={i} p={[(i % 8 - 3.5) * 1.1, 0.25, -2 - Math.floor(i / 8) * 2]} rot={[0, i, i * 0.4]} s={[0.8, 0.5, 0.7]} color={i % 3 ? "#633b43" : "#ff7338"} />)}
      <Arrow3D p={[0, 3.5, -4]} L={3.2} rot={[0, 0, Math.PI]} color="#ff2a3b" />
      <Glow p={[0, 4, -4]} r={6} color="rgba(255,40,60,0.9)" o={0.45 + (flash ? 0.2 : 0)} />
      <Dust t={t} n={24} area={[5, 6, 5]} color="rgba(255,80,80,.9)" />
      <Person p={[3.8, 0, -4.5]} h={2.1} look={{skin: "#cb916e", body: "#b03a2e", outfit: "hoodie"}} pose={{t: f, mood: "shock", arms: "shrug", walk: f * 0.45, speed: 1}} f={f} />
    </>
  );
};

const NatureSet: React.FC<{ t: number; f: number }> = ({ t, f }) => (
  <>
    <Lights warm="#fff8e7" />
    <Floor kind="plank" a="#2b593f" b="#1f442e" unit={2} w={30} d={30} />
    <Stars t={t} />
    {Array.from({length: 12}, (_, i) => <Ball key={i} p={[Math.cos(i * 2.4) * 3.5, 2.8 + Math.sin(i * 2.4) * 2.4, -5]} r={0.09 + i % 3 * 0.06} color="#eeb67d" />)}
    <Globe p={[0, 2.8, -4.5]} r={2.2} rotY={t * 0.4} />
    <Plant p={[-3.8, 0, -3.2]} s={1.8} />
    <Plant p={[3.8, 0, -3.2]} s={1.8} />
    <Plant p={[-2.4, 0, -1.8]} s={1.2} />
    <Plant p={[2.4, 0, -1.8]} s={1.2} />
    <Glow p={[0, 3, -4]} r={5} color="rgba(46,230,197,0.4)" o={0.25} />
    <Dust t={t} n={20} area={[4, 5, 4]} />
  </>
);

const StadiumSet: React.FC<{ t: number; f: number }> = ({ t, f }) => (
  <>
    <Lights warm="#f0fdf4" />
    <Floor kind="plank" a="#237a3b" b="#1e6b33" unit={3} w={36} d={36} />
    <Box p={[0, 0.005, -3.5]} s={[24, 0.005, 0.15]} color="#ffffff" line={0} />
    <group position={[0, 0.006, -3.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh><ringGeometry args={[3.2, 3.35, 32]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh><circleGeometry args={[0.2, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
    </group>
    {/* Goalpost in background */}
    <group position={[0, 0, -8.5]}>
      <Cyl p={[-3, 1.5, 0]} rt={0.09} rb={0.09} h={3.0} color="#ffffff" />
      <Cyl p={[3, 1.5, 0]} rt={0.09} rb={0.09} h={3.0} color="#ffffff" />
      <Cyl p={[0, 3.0, 0]} rt={0.09} rb={0.09} h={6.18} color="#ffffff" rot={[0, 0, Math.PI / 2]} />
      <Box p={[0, 1.5, -1]} s={[6, 3.0, 2]} color="#ffffff" transparent opacity={0.25} />
    </group>
    {/* Grandstands / Arquibancada */}
    {Array.from({ length: 5 }, (_, i) => (
      <Box key={i} p={[0, i * 0.8 + 1.2, -12 - i * 1.8]} s={[36, 0.8, 2]} color={i % 2 ? "#1e3a5f" : "#2b4c7e"} line={0} />
    ))}
    {/* Crowd in stands */}
    {Array.from({ length: 28 }, (_, i) => (
      <Ball key={i} p={[(i % 14 - 6.5) * 2.2, Math.floor(i / 14) * 0.8 + 2.1, -12 - Math.floor(i / 14) * 1.8]} r={0.24} color={["#ffcc00", "#e63946", "#457b9d", "#2a9d8f", "#ffffff"][i % 5]} />
    ))}
    {/* Stadium Floodlight Towers */}
    {[-10, 10].map(x => (
      <group key={x} position={[x, 0, -9]}>
        <Cyl p={[0, 5, 0]} rt={0.2} rb={0.3} h={10} color="#607d8b" />
        <Box p={[0, 10.2, 0]} s={[2.2, 1.2, 0.8]} color="#eceff1" />
        <Glow p={[0, 10.2, 0]} r={5} color="rgba(255,255,255,0.7)" o={0.65} />
      </group>
    ))}
    <Dust t={t} n={16} area={[5, 5, 5]} color="rgba(255,255,255,0.5)" />
  </>
);

/* ---------- Declarative Keyframe Animation Evaluator ---------- */
function evalAnimSpec(
  spec: AnimSpec,
  relT: number,
  dur: number,
  t: number,
  fallbackMood: Pose["mood"]
): { x: number; y: number; z: number; roll: number; shake: number; pose: Pose } {
  const kfs = [...spec.keyframes].sort((a, b) => a.at - b.at);
  const rawU = spec.loop ? (relT / 1.45) % 1 : clamp(relT / Math.max(0.25, dur));
  let k0 = kfs[0];
  let k1 = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (rawU >= kfs[i].at && rawU <= kfs[i + 1].at) {
      k0 = kfs[i];
      k1 = kfs[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, k1.at - k0.at);
  const local = clamp((rawU - k0.at) / span);
  const s = local * local * (3 - 2 * local);

  const num = (a: number | undefined, b: number | undefined, def = 0) => lerp(a ?? def, b ?? (a ?? def), s);
  const walkRate = num(k0.walk, k1.walk, 0);
  const armR = k0.armR || k1.armR
    ? ([lerp(k0.armR?.[0] ?? 0.25, k1.armR?.[0] ?? k0.armR?.[0] ?? 0.25, s), lerp(k0.armR?.[1] ?? 0.5, k1.armR?.[1] ?? k0.armR?.[1] ?? 0.5, s)] as [number, number])
    : undefined;
  const armL = k0.armL || k1.armL
    ? ([lerp(k0.armL?.[0] ?? -0.25, k1.armL?.[0] ?? k0.armL?.[0] ?? -0.25, s), lerp(k0.armL?.[1] ?? 0.5, k1.armL?.[1] ?? k0.armL?.[1] ?? 0.5, s)] as [number, number])
    : undefined;

  const pick = local < 0.5 ? k0 : k1;
  const moodVal = (pick.mood ?? k0.mood ?? fallbackMood) as Pose["mood"];

  return {
    x: num(k0.x, k1.x, 0),
    y: num(k0.y, k1.y, 0),
    z: num(k0.z, k1.z, 0),
    roll: num(k0.roll, k1.roll, 0),
    shake: num(k0.shake, k1.shake, 0),
    pose: {
      t,
      mood: moodVal === ("panic" as string) ? "shock" : moodVal,
      arms: pick.arms ?? k0.arms ?? "down",
      armR,
      armL,
      squash: num(k0.squash, k1.squash, 0),
      hunch: num(k0.hunch, k1.hunch, 0),
      tilt: num(k0.tilt, k1.tilt, 0),
      nerv: num(k0.nerv, k1.nerv, 0),
      sweat: num(k0.sweat, k1.sweat, 0),
      lookX: num(k0.lookX, k1.lookX, 0),
      walk: walkRate > 0 ? relT * walkRate : undefined,
      speed: num(k0.speed, k1.speed, 0),
      air: pick.air ?? k0.air ?? 0,
      flip: pick.flip ?? k0.flip ?? false,
    },
  };
}

/* ---------- Dynamic Scene Renderer ---------- */
const SceneContent: React.FC<Ctx & {character: Look; models?: Models; animations?: Record<string, AnimSpec>}> = ({ t, f, relT, dur, shot, character, models, animations }) => {
  const mood = shot.mood || "shock";
  const action = shot.animacao || shot.action || "jump_back";
  const env = shot.env || "office";

  // Compute character dynamic pose and position
  let charX = 0;
  let charY = 0;
  let charZ = 0;
  let pose: Pose = { t, mood: "shock" };
  let camShake = 0;
  let bodyRoll = 0;

  const customAnim = animations?.[action] || (shot.action ? animations?.[shot.action] : undefined);
  if (customAnim && Array.isArray(customAnim.keyframes) && customAnim.keyframes.length >= 2) {
    const res = evalAnimSpec(customAnim, relT, dur, t, mood === "panic" ? "shock" : mood);
    charX = res.x;
    charY = res.y;
    charZ = res.z;
    bodyRoll = res.roll;
    camShake = res.shake;
    pose = res.pose;
  } else if (action === "jump_back" || action === "shock") {
    // 0.0 - 0.2s anticipation, 0.2 - 0.6s leap into air, 0.6s+ land and trembling
    const jumpStart = 0.25;
    const jumpDur = 0.45;
    const jt = clamp((relT - jumpStart) / jumpDur);
    const air = relT > jumpStart && relT < jumpStart + jumpDur ? 4 * jt * (1 - jt) * 0.85 : 0;
    const land = relT >= jumpStart + jumpDur ? Math.max(0, 1 - (relT - jumpStart - jumpDur) / 0.25) : 0;
    const sq = relT < jumpStart ? -0.18 * seg(relT, 0, jumpStart) : relT < jumpStart + jumpDur ? 0.2 : -0.25 * land;

    charX = lerp(0, 1.2, Easing.out(Easing.quad)(jt));
    charY = air;
    pose = {
      t,
      mood: "shock",
      arms: "head",
      air: air > 0.05 ? 1 : 0,
      squash: sq,
      nerv: relT > jumpStart ? 0.75 : 0.2,
      sweat: relT > jumpStart + jumpDur ? 1 : 0,
    };
    if (relT >= jumpStart + jumpDur && relT <= jumpStart + jumpDur + 0.3) {
      camShake = 0.08 * (1 - (relT - jumpStart - jumpDur) / 0.3);
    }
  } else if (action === "shiver_sweat" || action === "sweat_panic") {
    // hunched trembling with sweat droplets
    const lookX = Math.sin(relT * 3.5) * 0.4;
    pose = {
      t,
      mood: mood === "panic" ? "shock" : "worry",
      arms: "chest",
      hunch: 0.35,
      nerv: 0.9,
      sweat: 1,
      lookX,
    };
    charX = Math.sin(relT * 2) * 0.2;
  } else if (action === "run") {
    // sprint across the scene
    const prog = clamp(relT / Math.max(1, dur));
    charX = lerp(-2.8, 2.8, prog);
    pose = {
      t,
      mood: "shock",
      arms: "shrug",
      walk: relT * 14,
      speed: 1,
      flip: false,
      hunch: 0.2,
    };
  } else if (action === "point") {
    // stepping forward and pointing urgently
    const step = seg(relT, 0, 0.4);
    charZ = lerp(-1, 0.4, step);
    pose = {
      t,
      mood: mood === "panic" ? "shock" : mood,
      arms: "point",
      armK: 1,
      hunch: 0.1,
    };
  } else if (action === "fall") {
    // tumble down
    const fallT = seg(relT, 0.2, 0.6);
    bodyRoll = lerp(0, -Math.PI / 2.2, fallT);
    pose = {
      t,
      mood: "shock",
      arms: "head",
      squash: fallT * -0.3,
    };
  } else if (action === "celebrate") {
    const hop = Math.abs(Math.sin(relT * 6)) * 0.4;
    charY = hop;
    pose = {
      t,
      mood: "grin",
      arms: "up",
      air: hop > 0.05 ? 1 : 0,
    };
  } else {
    // normal talking with natural idle bob
    pose = {
      t,
      mood: mood === "panic" ? "shock" : mood,
      arms: action === "drink" ? "hold" : relT % 3 > 1.5 ? "shrug" : "down",
      nerv: 0.1,
    };
  }

  const orbit = shot.cam === "orbit";
  const whip = shot.cam === "whip";
  const low = shot.cam === "low_angle";
  const roll = shot.cam === "dutch" ? 0.13 : whip ? -0.07 : 0;
  const target: V3 = [charX * 0.72, 1.85, charZ];

  // Dynamic Hero Prop (somente quando não há objetos dirigidos no stage)
  const stage = models ? shot.stage : undefined;
  const hasStageItems = Boolean(stage && Array.isArray(stage.items) && stage.items.length > 0);
  const stageHasPerformer = Boolean(
    hasStageItems && stage!.items.some((it) => it && models?.[it[0]]?.some((p) => p && p[0] === "performer"))
  );
  const showMainActor = !stageHasPerformer && (!stage || (stage.frame !== "detail" && stage.set !== "space"));

  if (showMainActor && hasStageItems) {
    if (action === "run") {
      charX = lerp(-1.75, -0.35, clamp(relT / Math.max(0.5, dur)));
      charZ = 0.65;
    } else {
      charX = Math.max(-1.85, Math.min(-0.35, -1.25 + charX * 0.22));
    }
  }
  const actorKeepOut = showMainActor && hasStageItems ? { x: -1.15, z: 0, r: 0.92 } : undefined;

  const falaLower = (shot.fala || "").toLowerCase();
  const heroProp = hasStageItems
    ? "none"
    : shot.prop || (
        falaLower.includes("bola") || falaLower.includes("futebol") || falaLower.includes("passe") || falaLower.includes("cruzamento") ? "ball" :
        falaLower.includes("travessão") || falaLower.includes("trave") || falaLower.includes("gol") || falaLower.includes("tiro de meta") ? "goal" :
        falaLower.includes("balança") || falaLower.includes("balanca") || falaLower.includes("quilo") || falaLower.includes("peso") || falaLower.includes("pesando") ? "scale" :
        falaLower.includes("chuteira") || falaLower.includes("atrito") || falaLower.includes("sprint") || falaLower.includes("frear") ? "cleat" :
        falaLower.includes("moeda") ? "coin" :
        falaLower.includes("buraco negro") || falaLower.includes("singularidade") ? "singularity" :
        falaLower.includes("terra") || falaLower.includes("planeta") || falaLower.includes("globo") ? "globe" :
        falaLower.includes("segundo") || falaLower.includes("minuto") || falaLower.includes("hora") || falaLower.includes("relógio") ? "clock" :
        falaLower.includes("alerta") || falaLower.includes("perigo") || falaLower.includes("cuidado") ? "warning" :
        falaLower.includes("análise") || falaLower.includes("dados") || falaLower.includes("sistema") ? "screen" :
        "none"
      );
  const propX = charX <= 0 ? 1.6 : -1.6;
  const propY = 1.9 + Math.sin(t * 3) * 0.08;
  const propZ = -1.2;

  const isStadium = env === "stadium" || env === "campo_futebol" ||
    falaLower.includes("maracanã") || falaLower.includes("maracana") ||
    falaLower.includes("futebol") || falaLower.includes("estádio") || falaLower.includes("estadio") ||
    falaLower.includes("gramado") || falaLower.includes("tiro de meta") || falaLower.includes("chuteira") ||
    falaLower.includes("jogadores") || falaLower.includes("goleiro") || falaLower.includes("travessão");

  return (
    <>
      {stage ? <StageCamera stage={stage} t={relT} duration={dur} cam={shot.cam} models={models} actorKeepOut={actorKeepOut}/> : <Cam t={relT} keys={[
        {t: 0, pos: [orbit ? -3 : whip ? 3 : 0.8, low ? 0.65 : 2.1, 7.8], look: target, roll},
        {t: dur * 0.5, pos: [0.25, low ? 0.95 : 2.4, 6.8], look: target, roll: roll * 0.3},
        {t: dur, pos: [orbit ? 2.8 : -0.45, 1.9, 5.9], look: target, roll: -roll},
      ]} impacts={[[0, shot.sfx === "impact" ? 0.14 : 0], [0.6, action === "fall" ? 0.12 : 0]]}
        quake={camShake + (shot.cam === "shake" ? 0.025 : 0)} />}

      {stage && stage.set !== "location" ? <StageBackdrop stage={stage} t={t}/> : isStadium ? (
        <StadiumSet t={t} f={f} />
      ) : env === "office" || env === "bedroom" ? (
        <OfficeSet t={t} f={f} isNight={mood === "shock" || mood === "panic"} />
      ) : env === "street" || env === "city" || env === "city_street" ? (
        <StreetSet t={t} f={f} light={stage ? stage.light ?? "day" : "night"} />
      ) : env === "lab" || env === "laboratory" ? (
        <LabSet t={t} f={f} alert={mood === "shock"} />
      ) : env === "apocalypse" || env === "apocalypse_red" ? (
        <DangerSet t={t} f={f} />
      ) : env === "nature" || env === "nature_space" ? (
        <NatureSet t={t} f={f} />
      ) : (
        <OfficeSet t={t} f={f} />
      )}

      {/* Hero 3D Prop */}
      {heroProp === "ball" ? (
        <SoccerBall3D p={[propX, propY, propZ]} t={t} s={1.1} />
      ) : heroProp === "goal" ? (
        <GoalPost3D p={[propX, propY, propZ]} t={t} s={0.9} />
      ) : heroProp === "scale" ? (
        <Scale3D p={[propX, propY, propZ]} t={t} s={1.05} />
      ) : heroProp === "cleat" ? (
        <Cleat3D p={[propX, propY, propZ]} t={t} s={1.1} />
      ) : heroProp === "coin" ? (
        <Coin3D p={[propX, propY, propZ]} t={t} s={1.1} />
      ) : heroProp === "singularity" ? (
        <Singularity3D p={[propX, propY, propZ]} t={t} s={1.1} />
      ) : heroProp === "globe" ? (
        <Globe p={[propX, propY, propZ]} r={1.2} rotY={t * 0.5} />
      ) : heroProp === "clock" ? (
        <group position={[propX, propY, propZ]}>
          <Clock p={[0, 0, 0]} r={0.9} t={t} speed={2} />
          <Glow p={[0, 0, 0]} r={1.8} color="rgba(255,200,80,0.5)" o={0.35} />
        </group>
      ) : heroProp === "warning" ? (
        <Warning3D p={[propX, propY, propZ]} t={t} s={1.1} />
      ) : heroProp === "screen" ? (
        <HoloScreen3D p={[propX, propY, propZ]} t={t} s={1.0} />
      ) : null}

      {stage && models && <StageObjects stage={stage} models={models} t={relT} duration={dur} acting={{...pose,t:f}} actorKeepOut={actorKeepOut}/>}

      {/* Rim light cartoon para recorte nítido no cenário */}
      <directionalLight position={[-4, 3.5, -3]} intensity={0.75} color="#8ecae6" />

      {/* Main Stickman Actor (oculto em close de detalhe ou espaço sem ator) */}
      {showMainActor ? (
        <>
          <Shadow p={[charX, 0, charZ]} r={1.05 - Math.min(0.6, charY * 0.25)} />
          <group rotation={[0, 0, bodyRoll]}>
            <Person
              p={[charX, charY, charZ]}
              shadow={false}
              h={3.45}
              look={character}
              f={f}
              pose={{...pose, t: f}}
            />
          </group>
        </>
      ) : null}
    </>
  );
};

/* ---------- Editorial Pill Karaoke Captions (Sem efeito pump) ---------- */
export const EditorialCaptions: React.FC<{ words?: WordTiming[]; shots?: ShotConfig[] }> = ({
  words = [],
  shots = [],
}) => {
  const frame = useCurrentFrame();
  const now = frame / FPS;

  const phrases = React.useMemo(() => {
    const safeWords = (words || []).filter((w) => w && w.word && Number.isFinite(w.start));
    const safeShots = shots || [];
    const cutSeconds = safeShots.map((s) => (s.from + s.frames) / FPS);
    const result: WordTiming[][] = [];
    let phrase: WordTiming[] = [];

    for (let i = 0; i < safeWords.length; i++) {
      const w = safeWords[i];
      const prev = phrase[phrase.length - 1];
      const crossedCut = prev && cutSeconds.some((cut) => prev.start < cut - 0.03 && w.start >= cut - 0.03);
      const nextLen = [...phrase, w].map((x) => x.word).join(" ").length;
      if (
        phrase.length &&
        (phrase.length >= 4 ||
          crossedCut ||
          w.start - prev.end > 0.28 ||
          nextLen > 24)
      ) {
        result.push(phrase);
        phrase = [];
      }
      phrase.push(w);
      if (/[.!?;:]$/.test(w.word)) {
        result.push(phrase);
        phrase = [];
      }
    }
    if (phrase.length) result.push(phrase);
    return result;
  }, [words, shots]);

  const phrase = phrases.find(
    (group) =>
      group &&
      group.length > 0 &&
      now >= group[0].start - 0.02 &&
      now <= (group[group.length - 1]?.end ?? group[0].start) + 0.09
  );
  if (!phrase) return null;

  const line = phrase.map((w) => w.word).join(" ");
  const enter = clamp((now - phrase[0].start + 0.02) / 0.09);
  const slideY = lerp(5, 0, Easing.out(Easing.cubic)(enter));
  const fontSize = Math.min(44, Math.max(30, Math.round(780 / Math.max(12, line.length))));

  return (
    <div
      style={{
        position: "absolute",
        left: 36,
        right: 36,
        bottom: 192,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 50,
        opacity: enter,
        transform: `translateY(${slideY.toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(9, 13, 24, 0.84)",
          border: "2px solid rgba(255, 255, 255, 0.14)",
          borderRadius: 20,
          padding: "13px 26px",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.48)",
          textAlign: "center",
          fontFamily: "Inter, Arial, sans-serif",
          fontWeight: 800,
          fontSize,
          lineHeight: 1.22,
          letterSpacing: "0.2px",
          maxWidth: 640,
        }}
      >
        {phrase.map((w, i) => {
          const isActive = now >= w.start - 0.01 && now <= w.end + 0.05;
          const isPast = now > w.end + 0.05;
          const isKey = /[0-9]|segundo|minuto|brasil|sol|moeda|buraco|terra|gravidade|gol|bola/i.test(w.word);
          const color = isActive
            ? isKey ? "#38bdf8" : "#ffd43b"
            : isPast
            ? "#e2e8f0"
            : "#ffffff";
          return (
            <React.Fragment key={`${w.start}-${i}`}>
              {i > 0 ? " " : ""}
              <span
                style={{
                  color,
                  textShadow: isActive ? "0 0 14px rgba(255, 212, 59, 0.35)" : "0 2px 4px rgba(0,0,0,0.6)",
                }}
              >
                {w.word}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- Main StickCorte Composition ---------- */
export const StickCorte: React.FC<StickCorteProps> = (props) => {
  const { shots = [], words = [], audioFile } = props;

  return (
    <AbsoluteFill style={{ background: "#0b0d1a" }}>
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}

      {(shots || []).map((shot, idx) => {
        const bg = shot.bg || (shot.env === "nature" || shot.env === "nature_space" ? "#1b3a2a" : shot.env === "lab" || shot.env === "laboratory" ? "#071e28" : shot.env === "street" || shot.env === "city_street" ? "#141724" : "#1a1e29");
        return (
          <SceneWrapper
            key={idx}
            first={idx === 0}
            startFrame={shot.from}
            durationFrames={shot.frames}
            trans={shot.trans || (idx % 3 === 1 ? "zoom" : idx % 3 === 2 ? "whip" : "ghost")}
            bg={bg}
          >
            {({ t, f }) => {
              const relT = f / FPS;
              const dur = shot.frames / FPS;
              return (
                <SceneContent
                  t={t}
                  f={f}
                  relT={relT}
                  dur={dur}
                  shot={shot}
                  models={props.models}
                  animations={props.animations}
                  character={props.character ?? defaultCharacter}
                />
              );
            }}
          </SceneWrapper>
        );
      })}

      {words && <EditorialCaptions words={words} shots={shots} />}
    </AbsoluteFill>
  );
};
