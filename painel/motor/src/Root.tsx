import React from "react";
import { Composition } from "remotion";
import "@fontsource/inter/900.css";
import { Main } from "./Main";
import { NvidiaV4 } from "./videos/NvidiaV4";
import { StickCorte, StickCorteProps } from "./videos/StickCorte";

const defaultCorteProps: StickCorteProps = {
  totalFrames: 180,
  shots: [
    {
      title: "Hook de Choque",
      fala: "Em menos de 10 minutos sua casa estaria coberta de lixo!",
      from: 0,
      frames: 90,
      mood: "shock",
      action: "jump_back",
      env: "office",
      trans: "flash",
      bg: "#161b26",
    },
    {
      title: "O Pânico Começa",
      fala: "Se elas parassem de trabalhar agora o ciclo travava!",
      from: 90,
      frames: 90,
      mood: "worry",
      action: "shiver_sweat",
      env: "street",
      trans: "zoom",
      bg: "#10141f",
    },
  ],
  words: [
    { word: "Em", start: 0.1, end: 0.3 },
    { word: "menos", start: 0.3, end: 0.6 },
    { word: "de", start: 0.6, end: 0.8 },
    { word: "10", start: 0.8, end: 1.1 },
    { word: "minutos", start: 1.1, end: 1.6 },
    { word: "sua", start: 1.7, end: 1.9 },
    { word: "casa", start: 1.9, end: 2.3 },
    { word: "estaria", start: 2.3, end: 2.7 },
    { word: "coberta!", start: 2.7, end: 3.1 },
  ],
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Corte"
      component={StickCorte}
      width={720}
      height={1280}
      fps={30}
      durationInFrames={1800}
      calculateMetadata={({ props }) => ({
        durationInFrames: (props as StickCorteProps)?.totalFrames || 900,
      })}
      defaultProps={defaultCorteProps}
    />
    <Composition id="Main" component={Main} width={720} height={1280} fps={30} durationInFrames={60} />
    <Composition id="NvidiaV4" component={NvidiaV4} width={720} height={1280} fps={30} durationInFrames={661} />
  </>
);
