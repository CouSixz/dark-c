// 2D cartoon puppet v4: expressive facial features, animated cartoon eyes, sneakers, cartoon hands, and rich micro-acting.
export type Look = {
  skin: string; body: string; pants?: string; outfit?: "suit" | "leather" | "blazer" | "hoodie" | "shirt"; tie?: string; shirt?: string;
  hair?: "none" | "short" | "bob" | "swept" | "grey" | "spiky"; hairColor?: string; glasses?: boolean; badge?: string; hat?: string; shoe?: string;
};
export type Arms = "down" | "up" | "hold" | "point" | "head" | "chest" | "box" | "shrug";
export type Pose = {
  t: number; walk?: number /* phase radians */; speed?: number /* 0..1 stride amplitude */; mood?: "grin" | "smile" | "shock" | "deadpan" | "worry" | "angry" | "laugh" | "gulp";
  arms?: Arms; armK?: number; armR?: [number, number]; armL?: [number, number]; armRK?: number; armLK?: number; /* IK hand targets in puppet-height units: x from body centre (screen right +), y from feet up */ nerv?: number; sweat?: number; squash?: number; tilt?: number; lookX?: number; flip?: boolean; hunch?: number; air?: number;
};
export const INK = "#0b0d1a";
const sh = (c: CanvasRenderingContext2D, color: string, f: () => void) => { c.save(); f(); c.restore(); };
export function drawPuppet(c: CanvasRenderingContext2D, W: number, H: number, look: Look, p: Pose) {
  c.clearRect(0, 0, W, H); c.save();
  const S = W / 400, cx = W / 2, feetY = H * 0.945, nerv = p.nerv ?? 0;
  const sq = p.squash ?? 0, tilt = p.tilt ?? 0;
  if (p.flip) { c.translate(W, 0); c.scale(-1, 1); }
  // shiver: whole-body jitter (suave em 30fps)
  const jx = nerv > 0.5 ? Math.sin(p.t * 1.15) * 1.6 * S * (nerv - 0.5) * 2 : 0, jy = 0;
  c.translate(cx + jx, feetY + jy); c.rotate(tilt); c.scale(1 - sq * 0.55, 1 + sq); c.translate(-cx, -feetY);
  c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = INK;
  const w = p.walk, amp = p.speed ?? 0, moving = w !== undefined && amp > 0;
  const breath = Math.sin(p.t * 0.12) * 0.012, hunch = p.hunch ?? 0;
  const bodyTopBase = H * 0.48, bodyH = H * 0.25 * (1 + breath), bodyW = W * 0.40;
  const bob = moving ? Math.abs(Math.sin(w!)) * 9 * S * amp : 0;
  const bodyTop = bodyTopBase - bob + hunch * 8 * S;
  const shoe = look.shoe ?? "#2563eb";
  const pants = look.pants ?? "#1e293b";

  // legs & modern sneakers (margem segura acima da borda inferior)
  for (const s of [-1, 1]) {
    const ph = moving ? Math.sin(w! + (s > 0 ? Math.PI : 0)) : 0, lift = moving ? Math.max(0, Math.cos(w! + (s > 0 ? Math.PI : 0))) : 0;
    const sw = moving ? ph * 40 * S * amp : s * 15 * S + (p.air ? s * 15 * S : 0);
    const x0 = cx + s * 22 * S, y0 = bodyTop + bodyH - 8 * S, fy = feetY - 14 * S - (moving ? lift * 14 * S * amp : 0) - (p.air ?? 0) * 18 * S;
    
    // Pants leg (chunky cartoon style)
    c.lineWidth = 15 * S; c.strokeStyle = INK;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + sw * 0.2, (y0 + fy) / 2, x0 + sw, fy); c.stroke();
    c.lineWidth = 11 * S; c.strokeStyle = pants;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + sw * 0.2, (y0 + fy) / 2, x0 + sw, fy); c.stroke();

    // Cartoon Sneaker
    const sx = x0 + sw, sy = fy;
    // White Rubber Sole
    c.fillStyle = "#ffffff"; c.strokeStyle = INK; c.lineWidth = 4 * S;
    c.beginPath(); c.roundRect(sx - 6 * S, sy + 2 * S, 36 * S, 11 * S, 5 * S); c.fill(); c.stroke();
    // Colored Sneaker Body
    c.fillStyle = shoe;
    c.beginPath();
    c.moveTo(sx - 4 * S, sy + 2 * S);
    c.lineTo(sx + 5 * S, sy - 10 * S);
    c.lineTo(sx + 18 * S, sy - 8 * S);
    c.lineTo(sx + 27 * S, sy + 2 * S);
    c.closePath();
    c.fill(); c.stroke();
    // White Toe Cap
    c.fillStyle = "#ffffff";
    c.beginPath(); c.arc(sx + 23 * S, sy + 1 * S, 6 * S, 0, 7); c.fill(); c.stroke();
  }

  // arms & cartoon hands
  const mode = p.arms ?? "down", ak = p.armK ?? 1;
  const hr = W * 0.225;
  const hyBase = bodyTop - hr * 0.54, hxBase = cx + hunch * 14 * S;
  for (const s of [-1, 1]) {
    const swing = moving ? Math.sin(w! + (s > 0 ? 0 : Math.PI)) * 28 * S * amp : 0;
    const sx = cx + s * bodyW * 0.46, sy = bodyTop + bodyH * 0.22;
    let ex = sx + s * 36 * S, ey = bodyTop + bodyH * 0.82 + swing * 0.3, bend = 12 * S;
    const tremble = nerv ? Math.sin(p.t * 1.2 + s) * 4 * S * nerv : 0;
    const target = (tx: number, ty: number) => { ex = ex + (tx - ex) * ak; ey = ey + (ty - ey) * ak; };
    if (mode === "up") target(sx + s * 18 * S, sy - 108 * S);
    if (mode === "head") { target(hxBase + s * hr * 0.96, hyBase + hr * 0.05); bend = 34 * S; }
    if (mode === "chest") target(cx + s * 14 * S, bodyTop + bodyH * 0.38);
    if (mode === "hold") target(cx + s * 28 * S, bodyTop + bodyH * 0.5);
    if (mode === "box") target(cx + s * 44 * S, bodyTop + bodyH * 0.58);
    if (mode === "shrug") target(sx + s * 42 * S, sy + 20 * S);
    if (mode === "point" && s > 0) target(sx + 68 * S, sy - 12 * S);
    const ik = s > 0 ? p.armR : p.armL, ikK = s > 0 ? (p.armRK ?? 1) : (p.armLK ?? 1);
    if (ik) { const tx = cx + ik[0] * H * 0.72, ty = (0.945 - ik[1]) * H; ex = ex + (tx - ex) * ikK; ey = ey + (ty - ey) * ikK; bend = 14 * S; }
    ex = Math.max(24 * S, Math.min(W - 24 * S, ex + tremble));
    ey = Math.max(24 * S, Math.min(H - 24 * S, ey + tremble * 0.6));

    // Sleeve
    c.lineWidth = 14 * S; c.strokeStyle = INK;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo((sx + ex) / 2 + s * bend, (sy + ey) / 2 + 12 * S, ex, ey); c.stroke();
    c.lineWidth = 10 * S; c.strokeStyle = look.body;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo((sx + ex) / 2 + s * bend, (sy + ey) / 2 + 12 * S, ex, ey); c.stroke();

    // Cartoon Hand (Skin Tone + Outline + Thumb)
    c.lineWidth = 4 * S; c.strokeStyle = INK; c.fillStyle = look.skin;
    c.beginPath(); c.arc(ex, ey, 13 * S, 0, 7); c.fill(); c.stroke();
    // Thumb nub
    c.beginPath(); c.arc(ex + s * 7 * S, ey - 4 * S, 5.5 * S, 0, 7); c.fill(); c.stroke();
  }

  // torso
  const torso = () => { c.beginPath(); c.moveTo(cx - bodyW / 2, bodyTop + 26 * S); c.quadraticCurveTo(cx - bodyW / 2 - 10 * S, bodyTop + bodyH * 0.9, cx, bodyTop + bodyH); c.quadraticCurveTo(cx + bodyW / 2 + 10 * S, bodyTop + bodyH * 0.9, cx + bodyW / 2, bodyTop + 26 * S); c.quadraticCurveTo(cx, bodyTop - 16 * S, cx - bodyW / 2, bodyTop + 26 * S); };
  c.lineWidth = 10 * S; c.fillStyle = look.body; torso(); c.fill();
  c.save(); torso(); c.clip();
  const o = look.outfit ?? "hoodie"; c.lineWidth = 6 * S;
  if (o === "suit" || o === "blazer") {
    c.fillStyle = look.shirt ?? "#f4f4f4"; c.beginPath(); c.moveTo(cx - 28 * S, bodyTop - 4 * S); c.lineTo(cx + 28 * S, bodyTop - 4 * S); c.lineTo(cx, bodyTop + bodyH * 0.64); c.closePath(); c.fill(); c.stroke();
    if (look.tie && o === "suit") { const sway = Math.sin(p.t * 0.2) * 3 * S + (moving ? Math.sin(w!) * 5 * S : 0); c.fillStyle = look.tie; c.beginPath(); c.moveTo(cx, bodyTop + 8 * S); c.lineTo(cx + 14 * S, bodyTop + 34 * S); c.lineTo(cx + sway, bodyTop + bodyH * 0.74); c.lineTo(cx - 14 * S, bodyTop + 34 * S); c.closePath(); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(cx - 40 * S, bodyTop - 6 * S); c.lineTo(cx, bodyTop + bodyH * 0.68); c.lineTo(cx + 40 * S, bodyTop - 6 * S); c.stroke();
    c.fillStyle = INK; for (const k of [0.8, 0.92]) { c.beginPath(); c.arc(cx, bodyTop + bodyH * k, 4.5 * S, 0, 7); c.fill(); }
    c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(cx - bodyW * 0.35, bodyTop + bodyH * 0.35, 18 * S, 6 * S);
  } else if (o === "leather") {
    c.fillStyle = "#eceef5"; c.beginPath(); c.moveTo(cx - 30 * S, bodyTop - 4 * S); c.lineTo(cx + 30 * S, bodyTop - 4 * S); c.lineTo(cx, bodyTop + bodyH * 0.58); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#3a3d4a";
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 44 * S, bodyTop - 8 * S); c.lineTo(cx + s * 7 * S, bodyTop + 22 * S); c.lineTo(cx + s * 11 * S, bodyTop + bodyH + 6); c.lineTo(cx + s * bodyW, bodyTop + bodyH); c.closePath(); c.fill(); c.stroke(); }
    c.strokeStyle = "#9aa0b8"; c.lineWidth = 4 * S; c.beginPath(); c.moveTo(cx - 8 * S, bodyTop + bodyH * 0.45); c.lineTo(cx - 12 * S, bodyTop + bodyH * 0.95); c.moveTo(cx + 8 * S, bodyTop + bodyH * 0.45); c.lineTo(cx + 12 * S, bodyTop + bodyH * 0.95); c.stroke();
  } else if (o === "hoodie") {
    c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.ellipse(cx, bodyTop + 6 * S, 46 * S, 18 * S, 0, 0, 7); c.fill();
    // Kangaroo pocket
    c.fillStyle = "rgba(0,0,0,.15)"; c.strokeStyle = INK; c.lineWidth = 4 * S;
    c.beginPath(); c.roundRect(cx - 34 * S, bodyTop + bodyH * 0.52, 68 * S, 32 * S, 8 * S); c.fill(); c.stroke();
    // Hoodie drawstrings
    c.strokeStyle = "#ffffff"; c.lineWidth = 4 * S;
    c.beginPath(); c.moveTo(cx - 14 * S, bodyTop + 16 * S); c.lineTo(cx - 14 * S, bodyTop + 65 * S);
    c.moveTo(cx + 14 * S, bodyTop + 16 * S); c.lineTo(cx + 14 * S, bodyTop + 65 * S); c.stroke();
  } else {
    c.fillStyle = "rgba(255,255,255,.25)"; c.beginPath(); c.ellipse(cx - 34 * S, bodyTop + 44 * S, 14 * S, 42 * S, 0.2, 0, 7); c.fill();
  }
  // form shading
  const g = c.createLinearGradient(cx - bodyW / 2, 0, cx + bodyW / 2, 0);
  g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,20,.32)");
  c.fillStyle = g; c.fillRect(cx - bodyW, bodyTop - 20, bodyW * 2, bodyH + 40);
  c.restore();
  c.lineWidth = 10 * S; torso(); c.stroke();

  // head & cartoon face
  const hy = hyBase + Math.sin(p.t * 0.12) * 1.5 * S + (moving ? Math.sin((w ?? 0) * 2) * 3 * S * amp : 0), hx = hxBase;
  const hc = look.hairColor ?? "#1e1b4b", hair = look.hair ?? "spiky";
  c.lineWidth = 11 * S;

  // Head base
  c.fillStyle = look.skin; c.beginPath(); c.arc(hx, hy, hr, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(hx, hy, hr, 0, 7); c.clip();
  const hg = c.createRadialGradient(hx - hr * 0.35, hy - hr * 0.35, hr * 0.1, hx, hy, hr * 1.1);
  hg.addColorStop(0, "rgba(255,255,255,.25)"); hg.addColorStop(0.6, "rgba(0,0,0,0)"); hg.addColorStop(1, "rgba(80,30,10,.25)");
  c.fillStyle = hg; c.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 11 * S; c.beginPath(); c.arc(hx, hy, hr, 0, 7); c.stroke();

  // Hair Styles
  if (hair === "spiky") {
    c.fillStyle = hc; c.strokeStyle = INK; c.lineWidth = 8 * S;
    c.beginPath();
    c.moveTo(hx - hr * 0.92, hy - hr * 0.15);
    c.lineTo(hx - hr * 1.2, hy - hr * 0.65);
    c.lineTo(hx - hr * 0.7, hy - hr * 0.85);
    c.lineTo(hx - hr * 0.45, hy - hr * 1.35);
    c.lineTo(hx, hy - hr * 0.95);
    c.lineTo(hx + hr * 0.45, hy - hr * 1.35);
    c.lineTo(hx + hr * 0.7, hy - hr * 0.85);
    c.lineTo(hx + hr * 1.2, hy - hr * 0.65);
    c.lineTo(hx + hr * 0.92, hy - hr * 0.15);
    c.closePath();
    c.fill(); c.stroke();
    // Anime hair shine
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 5 * S;
    c.beginPath(); c.moveTo(hx - hr * 0.35, hy - hr * 0.9); c.lineTo(hx + hr * 0.35, hy - hr * 0.9); c.stroke();
  } else if (hair === "swept") {
    c.fillStyle = hc; c.strokeStyle = INK; c.lineWidth = 8 * S;
    c.beginPath(); c.arc(hx, hy, hr - 4 * S, Math.PI * 1.04, Math.PI * 1.96);
    c.quadraticCurveTo(hx + hr * 0.35, hy - hr * 0.7, hx - hr * 0.95, hy - hr * 0.18);
    c.fill(); c.stroke();
  } else if (hair === "short") {
    c.fillStyle = hc; c.strokeStyle = INK; c.lineWidth = 8 * S;
    c.beginPath(); c.arc(hx, hy, hr - 4 * S, Math.PI * 1.04, Math.PI * 1.96);
    c.quadraticCurveTo(hx, hy - hr * 0.35, hx - hr * 0.95, hy - hr * 0.3);
    c.fill(); c.stroke();
  }

  // Rosy Cartoon Cheeks (Blush)
  c.fillStyle = "rgba(255, 105, 135, 0.35)";
  c.beginPath(); c.ellipse(hx - hr * 0.52, hy + hr * 0.28, 14 * S, 9 * S, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(hx + hr * 0.52, hy + hr * 0.28, 14 * S, 9 * S, 0, 0, 7); c.fill();

  // Face, Expressive Eyes & Eyebrows
  const m = p.mood ?? "smile";
  const blink = (p.t % 100) > 96, eyeY = hy + hr * 0.03, ex0 = hx - hr * 0.38, ex1 = hx + hr * 0.38;
  const dartX = (nerv ? Math.sin(p.t * 0.33) * 6 * S * nerv : 0) + (p.lookX ?? 0) * 7 * S;

  const eye = (ex: number) => {
    if (m === "grin" || m === "laugh") {
      c.lineWidth = 7 * S; c.strokeStyle = INK;
      c.beginPath(); c.arc(ex, eyeY + 6 * S, 16 * S, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      return;
    }
    if (blink) {
      c.lineWidth = 7 * S; c.strokeStyle = INK;
      c.beginPath(); c.moveTo(ex - 15 * S, eyeY); c.lineTo(ex + 15 * S, eyeY); c.stroke();
      return;
    }
    // Large Cartoon Eyeball
    const r = m === "shock" ? 25 * S : 17 * S;
    c.fillStyle = "#ffffff"; c.strokeStyle = INK; c.lineWidth = 5 * S;
    c.beginPath(); c.arc(ex, eyeY, r, 0, 7); c.fill(); c.stroke();

    // Large Lively Cartoon Pupil
    const pr = m === "shock" ? 6 * S : 8.5 * S;
    c.fillStyle = "#0f172a";
    c.beginPath(); c.arc(ex + dartX, eyeY + 1 * S, pr, 0, 7); c.fill();

    // Dual Specular Sparkle Shine (Pixar / Anime style)
    c.fillStyle = "#ffffff";
    c.beginPath(); c.arc(ex + dartX - pr * 0.35, eyeY - pr * 0.35, pr * 0.42, 0, 7); c.fill();
    c.beginPath(); c.arc(ex + dartX + pr * 0.35, eyeY + pr * 0.35, pr * 0.2, 0, 7); c.fill();
  };
  eye(ex0); eye(ex1);

  // Dynamic Eyebrows
  c.lineWidth = 7 * S; c.strokeStyle = INK; c.beginPath();
  if (m === "angry") {
    c.moveTo(ex0 - 20 * S, eyeY - 32 * S); c.lineTo(ex0 + 16 * S, eyeY - 17 * S);
    c.moveTo(ex1 + 20 * S, eyeY - 32 * S); c.lineTo(ex1 - 16 * S, eyeY - 17 * S);
  } else if (m === "worry" || m === "gulp") {
    const tw = nerv ? Math.sin(p.t * 0.7) * 3 * S : 0;
    c.moveTo(ex0 - 16 * S, eyeY - 16 * S + tw); c.lineTo(ex0 + 16 * S, eyeY - 34 * S);
    c.moveTo(ex1 + 16 * S, eyeY - 16 * S - tw); c.lineTo(ex1 - 16 * S, eyeY - 34 * S);
  } else if (m === "shock") {
    c.moveTo(ex0 - 16 * S, eyeY - 42 * S); c.lineTo(ex0 + 16 * S, eyeY - 42 * S);
    c.moveTo(ex1 - 16 * S, eyeY - 42 * S); c.lineTo(ex1 + 16 * S, eyeY - 42 * S);
  } else if (m === "deadpan") {
    c.moveTo(ex0 - 16 * S, eyeY - 26 * S); c.lineTo(ex0 + 16 * S, eyeY - 22 * S);
    c.moveTo(ex1 - 16 * S, eyeY - 22 * S); c.lineTo(ex1 + 16 * S, eyeY - 26 * S);
  } else {
    c.arc(ex0, eyeY - 22 * S, 14 * S, Math.PI * 1.15, Math.PI * 1.85);
    c.arc(ex1, eyeY - 22 * S, 14 * S, Math.PI * 1.15, Math.PI * 1.85);
  }
  c.stroke();

  // Expressive Cartoon Mouth
  const my = hy + hr * 0.46;
  c.lineWidth = 5 * S; c.strokeStyle = INK;
  if (m === "grin" || m === "laugh") {
    c.fillStyle = "#7f1d1d";
    c.beginPath(); c.arc(hx, my, 26 * S, 0.1, Math.PI - 0.1); c.closePath(); c.fill(); c.stroke();
    // Teeth & Tongue
    c.save();
    c.beginPath(); c.arc(hx, my, 26 * S, 0.1, Math.PI - 0.1); c.closePath(); c.clip();
    c.fillStyle = "#ffffff"; c.fillRect(hx - 28 * S, my, 56 * S, 10 * S);
    c.fillStyle = "#f472b6"; c.beginPath(); c.arc(hx, my + 26 * S, 18 * S, Math.PI, 0); c.fill(); c.stroke();
    c.restore();
  } else if (m === "shock") {
    c.fillStyle = "#3b0714";
    c.beginPath(); c.ellipse(hx, my + 10 * S, 16 * S, 24 * S, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = "#f472b6"; c.beginPath(); c.arc(hx, my + 26 * S, 10 * S, Math.PI, 0); c.fill();
  } else if (m === "worry" || m === "gulp") {
    const wob = nerv ? Math.sin(p.t * 1.9) * 4 * S : 0;
    c.beginPath(); c.moveTo(hx - 26 * S, my + 14 * S); c.quadraticCurveTo(hx, my - 6 * S + wob, hx + 26 * S, my + 14 * S); c.stroke();
  } else if (m === "angry") {
    c.beginPath(); c.moveTo(hx - 26 * S, my + 14 * S); c.quadraticCurveTo(hx, my - 8 * S, hx + 26 * S, my + 14 * S); c.stroke();
  } else if (m === "deadpan") {
    c.beginPath(); c.moveTo(hx - 20 * S, my + 4 * S); c.lineTo(hx + 20 * S, my + 4 * S); c.stroke();
  } else {
    c.beginPath(); c.arc(hx, my - 8 * S, 26 * S, 0.25, Math.PI - 0.25); c.stroke();
    // Dimple tick
    c.beginPath(); c.moveTo(hx + 24 * S, my + 10 * S); c.lineTo(hx + 28 * S, my + 6 * S); c.stroke();
  }

  // Sweat Drops
  const sw = p.sweat ?? 0;
  if (sw > 0) {
    c.fillStyle = "#60a5fa"; c.strokeStyle = "#1d4ed8"; c.lineWidth = 3 * S;
    for (let k = 0; k < 3; k++) {
      const u = ((p.t * 0.035 + k / 3) % 1), x = hx + hr * (0.75 + 0.1 * k) * (k % 2 ? -1 : 1), y = hy - hr * 0.6 + u * hr * 1.4, r = (1 - u * 0.5) * 12 * S * sw;
      c.beginPath(); c.moveTo(x, y - r * 1.6); c.quadraticCurveTo(x + r, y, x, y + r * 0.6); c.quadraticCurveTo(x - r, y, x, y - r * 1.6); c.fill(); c.stroke();
    }
  }
  c.restore();
}
