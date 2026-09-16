/*
 * Asset pass 2 for NICOLAS.EXE.
 *
 * The character artwork already in the build is a full-body, pixel-painted
 * Nicolas concept. This script turns it into clean RGBA animation sheets and
 * builds a matching set of high-contrast environment/pickup sprites. It also
 * grades the supplied backgrounds with level-specific foreground lighting.
 * All output is local and deterministic so Netlify does not need an asset CDN.
 */
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/sharp');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'assets', 'art');
const SPR = path.join(ROOT, 'assets', 'sprites');
const T = { r: 0, g: 0, b: 0, alpha: 0 };

function rgbaBuffer(data, width, height) {
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function removeConnectedBlack(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const seen = new Uint8Array(width * height);
  const q = [];
  const isBg = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i + 3] > 0 && data[i] < 38 && data[i + 1] < 38 && data[i + 2] < 44;
  };
  const add = (x, y) => {
    const n = y * width + x;
    if (!seen[n] && isBg(x, y)) { seen[n] = 1; q.push(n); }
  };
  for (let x = 0; x < width; x++) { add(x, 0); add(x, height - 1); }
  for (let y = 0; y < height; y++) { add(0, y); add(width - 1, y); }
  for (let head = 0; head < q.length; head++) {
    const n = q[head];
    const x = n % width; const y = Math.floor(n / width);
    data[n * 4 + 3] = 0;
    if (x > 0) add(x - 1, y);
    if (x + 1 < width) add(x + 1, y);
    if (y > 0) add(x, y - 1);
    if (y + 1 < height) add(x, y + 1);
  }
  return rgbaBuffer(data, width, height);
}

async function alphaBounds(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 18) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function makeCharacterBase() {
  const src = await removeConnectedBlack(path.join(ART, 'nicolas_sprite_concept.png'));
  const b = await alphaBounds(src);
  if (!b) throw new Error('Nicolas concept has no visible alpha bounds');
  // Give the hero a readable, sturdy silhouette without over-stretching the
  // face or hands from the original concept.
  const cropped = await sharp(src).extract(b).resize({ width: 64, height: 116, fit: 'fill', withoutEnlargement: false }).png().toBuffer();
  return sharp({ create: { width: 96, height: 128, channels: 4, background: T } })
    .composite([{ input: cropped, left: 16, top: 4 }]).png().toBuffer();
}

function glowSvg(type, frame, w = 96, h = 128) {
  const id = `g${type}${frame}`;
  const attack = type === 'attack';
  const jump = type === 'jump' || type === 'fall';
  const hurt = type === 'hurt';
  const death = type === 'death';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="${id}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${attack ? `<path d="M57 57 C67 ${55 - frame * 2} 72 55 84 53" stroke="#66f4ff" stroke-width="3" opacity=".9" filter="url(#${id})"/><circle cx="84" cy="53" r="${5 + frame % 3}" fill="#50eaff" opacity=".9" filter="url(#${id})"/><circle cx="84" cy="53" r="2" fill="#fff"/>` : ''}
    ${jump ? `<ellipse cx="48" cy="120" rx="${17 + frame * 2}" ry="4" fill="none" stroke="#5ceeff" stroke-width="2" opacity=".${4 + frame}" filter="url(#${id})"/>` : ''}
    ${hurt ? `<path d="M16 28 L81 95 M74 23 L20 101" stroke="#ff547f" stroke-width="3" opacity=".${7 + frame}" filter="url(#${id})"/>` : ''}
    ${death ? `<g fill="#c08cff" opacity=".${7 - Math.min(frame, 5)}"><circle cx="24" cy="${34 + frame * 3}" r="2"/><circle cx="72" cy="${49 + frame * 4}" r="2"/><circle cx="47" cy="${18 + frame * 5}" r="1.5"/></g>` : ''}
  </svg>`;
}

async function animateStride(input, type, frame) {
  if (type !== 'walk' && type !== 'run') return input;
  const walk = [-7, -3, 4, 8, 5, -2, -8, -4, 4, 7];
  const run = [-11, -7, -2, 7, 12, 8, 1, -8, -12, -9];
  const stride = (type === 'run' ? run : walk)[frame % 10];
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  const start = Math.floor(info.height * 0.53);
  const mid = info.width / 2;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const t = y < start ? 0 : (y - start) / Math.max(1, info.height - start - 1);
    const wave = Math.sin(Math.min(1, t) * Math.PI * 0.5);
    const side = x < mid ? -1 : 1;
    const sx = Math.round(x - side * stride * wave);
    if (sx < 0 || sx >= info.width) continue;
    const src = (y * info.width + sx) * 4;
    const dst = (y * info.width + x) * 4;
    out[dst] = data[src]; out[dst + 1] = data[src + 1]; out[dst + 2] = data[src + 2]; out[dst + 3] = data[src + 3];
  }
  return rgbaBuffer(out, info.width, info.height);
}

async function characterFrame(base, type, frame) {
  const angles = {
    idle: [0, 0.7, 0, -0.7, 0, 0.5],
    walk: [-2, -1, 1, 2, 1, -1, -2, -1, 1, 2],
    run: [-6, -4, -1, 3, 6, 5, 2, -2, -5, -6],
    jump: [-5, -3, -1, 1, 3, 5],
    fall: [5, 3, 1, -1],
    attack: [-5, -3, -1, 0, 1, 2, 1, -1],
    hurt: [-5, -3, 3, 5],
    death: [0, -5, -12, -22, -35, -48, -58, -70]
  };
  let frameBuf = await sharp(base).rotate(angles[type][frame % angles[type].length], { background: T }).png().toBuffer();
  // Rotation introduces asymmetric transparent margins. Re-crop before placing
  // the frame so Nicolas and both shoes stay centered in every atlas cell.
  const rotatedBounds = await alphaBounds(frameBuf);
  if (rotatedBounds) frameBuf = await sharp(frameBuf).extract(rotatedBounds).resize({ width: 64, height: 116, fit: 'inside' }).png().toBuffer();
  frameBuf = await animateStride(frameBuf, type, frame);
  const overlay = Buffer.from(glowSvg(type, frame));
  let out = await sharp({ create: { width: 96, height: 128, channels: 4, background: T } })
    .composite([{ input: frameBuf, left: 16, top: 4 }, { input: overlay, left: 0, top: 0 }]).png().toBuffer();
  if (type === 'death') {
    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const opacity = Math.max(0.15, 1 - frame * 0.11);
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
    out = await rgbaBuffer(data, info.width, info.height);
  }
  return out;
}

async function saveCharacterSheets() {
  const base = await makeCharacterBase();
  const animations = { idle: 6, walk: 10, run: 10, jump: 6, fall: 4, attack: 8, hurt: 4, death: 8 };
  for (const [name, count] of Object.entries(animations)) {
    const frames = [];
    for (let i = 0; i < count; i++) frames.push(await characterFrame(base, name, i));
    const sheet = await sharp({ create: { width: 96 * count, height: 128, channels: 4, background: T } })
      .composite(frames.map((input, i) => ({ input, left: i * 96, top: 0 }))).png().toBuffer();
    await fs.promises.writeFile(path.join(SPR, 'player', `${name}.png`), sheet);
  }
  await sharp(base).resize(64, 64, { fit: 'contain', background: T }).png().toFile(path.join(SPR, 'player', 'icon.png'));
}

function svgBase(w, h, defs, body) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`;
}
const defs = `<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#243759"/><stop offset=".48" stop-color="#111a32"/><stop offset="1" stop-color="#070d1d"/></linearGradient><linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d5ffff"/><stop offset=".35" stop-color="#55e9ff"/><stop offset="1" stop-color="#1973c7"/></linearGradient><linearGradient id="violet" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eadcff"/><stop offset=".4" stop-color="#9b6cff"/><stop offset="1" stop-color="#4b267f"/></linearGradient><filter id="soft" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

const environmentSvgs = {
  platform: svgBase(256, 48, defs, `<rect x="3" y="6" width="250" height="39" rx="9" fill="url(#metal)" stroke="#173258" stroke-width="3"/><path d="M10 8 H246" stroke="#a9fbff" stroke-width="3"/><path d="M9 13 H247" stroke="#32cce9" stroke-width="2" opacity=".75"/><path d="M18 22 H238 M18 34 H238" stroke="#294b75"/><g fill="#55e9ff"><circle cx="18" cy="27" r="2"/><circle cx="238" cy="27" r="2"/></g><g fill="#091225" stroke="#4674a1"><rect x="32" y="18" width="28" height="15" rx="3"/><rect x="82" y="18" width="28" height="15" rx="3"/><rect x="132" y="18" width="28" height="15" rx="3"/><rect x="182" y="18" width="28" height="15" rx="3"/></g>`),
  floor: svgBase(128, 64, defs, `<path d="M0 10 H128 V64 H0 Z" fill="#070d1d" stroke="#173258" stroke-width="2"/><path d="M0 9 H128" stroke="#b6ffff" stroke-width="4"/><path d="M0 15 H128" stroke="#31cae7" stroke-width="2"/><path d="M16 17 V64 M32 17 V64 M48 17 V64 M64 17 V64 M80 17 V64 M96 17 V64 M112 17 V64" stroke="#1a3155"/><path d="M0 32 H128 M0 51 H128" stroke="#122440"/><g fill="#39c9e8"><circle cx="12" cy="27" r="1.5"/><circle cx="75" cy="46" r="1.5"/><circle cx="116" cy="23" r="1.5"/></g>`),
  terminal: svgBase(64, 64, defs, `<rect x="8" y="8" width="48" height="43" rx="6" fill="url(#metal)" stroke="#3978a2" stroke-width="2"/><rect x="14" y="15" width="36" height="20" rx="3" fill="#06111d" stroke="#27d8df"/><path d="M19 21 h9 l-5 4 h9 M19 30 h17" fill="none" stroke="#65f6b9" stroke-width="2"/><path d="M18 53 h28 l4 7 H14 Z" fill="#111b32" stroke="#2f587f"/><circle cx="47" cy="12" r="2" fill="#ff648c" filter="url(#soft)"/>`),
  chip: svgBase(64, 64, defs, `<rect x="15" y="15" width="34" height="34" rx="5" fill="url(#metal)" stroke="#55e9ff" stroke-width="2"/><path d="M22 22 H42 V42 H22 Z" fill="#101e39" stroke="#9b6cff" stroke-width="2"/><path d="M8 22 H15 M8 32 H15 M8 42 H15 M49 22 H56 M49 32 H56 M49 42 H56 M22 8 V15 M32 8 V15 M42 8 V15 M22 49 V56 M32 49 V56 M42 49 V56" stroke="#3ec8e7" stroke-width="3"/>`),
  code: svgBase(64, 64, defs, `<rect x="7" y="10" width="50" height="44" rx="6" fill="#071223" stroke="#36d5ab" stroke-width="2"/><path d="M15 20 h13 M15 28 h23 M15 36 h18 M15 44 h29" stroke="#5ceeff" stroke-width="3" opacity=".7"/><path d="M37 20 h12 M41 28 h8" stroke="#a16cff" stroke-width="3" opacity=".8"/><circle cx="15" cy="14" r="1.5" fill="#ff6e9c"/><circle cx="21" cy="14" r="1.5" fill="#ffcc66"/>`),
  panel: svgBase(64, 64, defs, `<rect x="5" y="8" width="54" height="48" rx="7" fill="#0a1428" stroke="#246a98" stroke-width="2"/><path d="M12 18 H52 M12 26 H52 M12 34 H52 M12 42 H52" stroke="#1c3d63"/><path d="M14 18 v24 M28 18 v24 M42 18 v24" stroke="#55e9ff" opacity=".55"/><circle cx="18" cy="49" r="3" fill="#ff5d8a" filter="url(#soft)"/><circle cx="28" cy="49" r="3" fill="#63f6b5" filter="url(#soft)"/><circle cx="38" cy="49" r="3" fill="#a878ff" filter="url(#soft)"/>`),
  circuit: svgBase(64, 64, defs, `<path d="M5 49 H19 V36 H34 V22 H51 V8" fill="none" stroke="#48d9ec" stroke-width="3"/><path d="M14 8 V21 H28 V49 H51" fill="none" stroke="#9b6cff" stroke-width="2"/><g fill="#d6ffff" filter="url(#soft)"><circle cx="5" cy="49" r="4"/><circle cx="34" cy="22" r="4"/><circle cx="51" cy="8" r="4"/></g>`),
};

const itemSvgs = {
  coffee: svgBase(48, 48, defs, `<path d="M14 15 h22 v20 a5 5 0 0 1 -5 5 H19 a5 5 0 0 1 -5 -5 Z" fill="#f0f5ff" stroke="#6db8d9" stroke-width="2"/><path d="M36 20 h5 a5 5 0 0 1 0 10 h-5" fill="none" stroke="#6db8d9" stroke-width="3"/><path d="M18 20 h14 v13 H18 Z" fill="#7b3c22"/><path d="M21 11 C18 8 23 7 21 3 M28 11 C25 8 30 7 28 3" fill="none" stroke="#69efff" stroke-width="2" filter="url(#soft)"/>`),
  energy: svgBase(48, 48, defs, `<path d="M15 10 H33 L36 39 H12 Z" fill="url(#cyan)" stroke="#b9ffff" stroke-width="2"/><path d="M13 16 H35 M14 34 H34" stroke="#102956" stroke-width="2"/><path d="M24 18 l-5 8 h5 l-3 8 8-10 h-5 z" fill="#fff"/><path d="M18 7 H30" stroke="#ffcc66" stroke-width="3"/>`),
  pizza: svgBase(48, 48, defs, `<path d="M7 10 C22 7 37 14 42 30 L10 40 Z" fill="#f0ac52" stroke="#6b3e2b" stroke-width="2"/><path d="M10 13 C23 11 34 16 38 27 L12 34 Z" fill="#e64b56"/><circle cx="22" cy="20" r="3" fill="#ffd76a"/><circle cx="30" cy="24" r="3" fill="#ffd76a"/><path d="M10 40 l8 -1" stroke="#55e9ff" stroke-width="3"/>`),
  chocolate: svgBase(48, 48, defs, `<rect x="9" y="12" width="30" height="27" rx="4" fill="#74432d" stroke="#e5b487" stroke-width="2"/><path d="M19 12 v27 M29 12 v27 M9 21 h30 M9 30 h30" stroke="#be8158" stroke-width="1.5"/><path d="M12 9 H36" stroke="#6cefff" stroke-width="3"/>`),
  shard: svgBase(48, 48, defs, `<path d="M24 4 L40 18 L31 42 L15 42 L8 19 Z" fill="url(#violet)" stroke="#e2d3ff" stroke-width="2" filter="url(#soft)"/><path d="M24 9 L29 35 L18 35 Z" fill="#b8f7ff" opacity=".8"/>`),
  checkpoint: svgBase(48, 64, defs, `<path d="M24 5 C13 5 8 13 8 23 v28 h32 V23 C40 13 35 5 24 5 Z" fill="#0b1930" stroke="#57ecff" stroke-width="2"/><ellipse cx="24" cy="23" rx="11" ry="17" fill="#55e9ff" opacity=".22" filter="url(#soft)"/><path d="M24 7 V53 M13 23 H35" stroke="#baffff" stroke-width="2"/><circle cx="24" cy="23" r="4" fill="#fff" filter="url(#soft)"/>`),
  portal: svgBase(96, 144, defs, `<path d="M20 137 V59 C20 25 36 8 48 8 C60 8 76 25 76 59 V137" fill="#071326" stroke="#62efff" stroke-width="5"/><path d="M28 136 V61 C28 37 38 21 48 21 C58 21 68 37 68 61 V136" fill="none" stroke="#9b6cff" stroke-width="3" filter="url(#soft)"/><ellipse cx="48" cy="71" rx="20" ry="45" fill="#55e9ff" opacity=".22" filter="url(#soft)"/><path d="M30 137 H66" stroke="#d4ffff" stroke-width="4"/>`),
};

async function svgFile(dir, name, w, h, svg) {
  await fs.promises.mkdir(dir, { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, name));
}

async function saveEnvironmentSprites() {
  const tiles = path.join(SPR, 'tiles');
  for (const [name, svg] of Object.entries(environmentSvgs)) {
    const [w, h] = name === 'platform' ? [256, 48] : name === 'floor' ? [128, 64] : [64, 64];
    await svgFile(tiles, `${name}.png`, w, h, svg);
  }
  const items = path.join(SPR, 'items');
  for (const [name, svg] of Object.entries(itemSvgs)) {
    const [w, h] = name === 'checkpoint' ? [48, 64] : name === 'portal' ? [96, 144] : [48, 48];
    await svgFile(items, `${name}.png`, w, h, svg);
  }
}

const levelFx = {
  level1_bg: { a: '#27d9ff', b: '#744dff', c: '#0b1632', lines: '#55e9ff' },
  level2_bg: { a: '#ff9062', b: '#d24cff', c: '#261126', lines: '#ffb169' },
  level3_bg: { a: '#39f0ba', b: '#3e8cff', c: '#081d21', lines: '#61ffc8' },
  level4_bg: { a: '#ddb967', b: '#ac69ff', c: '#17101f', lines: '#e7cc7d' },
  boss_arena: { a: '#ff5f8f', b: '#6c7dff', c: '#140819', lines: '#ff6ea8' },
  menu_bg: { a: '#42deff', b: '#a878ff', c: '#070d24', lines: '#5ceeff' },
  intro_bg: { a: '#59ecff', b: '#a879ff', c: '#040b1a', lines: '#5ceeff' },
};

function backgroundOverlay(w, h, fx, name) {
  const vertical = `<linearGradient id="veil" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${fx.c}" stop-opacity=".50"/><stop offset=".52" stop-color="${fx.c}" stop-opacity=".06"/><stop offset="1" stop-color="#02040c" stop-opacity=".55"/></linearGradient>`;
  const streaks = Array.from({ length: 11 }, (_, i) => {
    const x = 55 + i * 121; const y = 130 + (i % 3) * 90;
    return `<path d="M${x} ${y} l${90 + (i % 4) * 28} -${22 + (i % 3) * 8}" stroke="${fx.lines}" stroke-width="${i % 3 === 0 ? 2 : 1}" opacity=".${i % 4 + 2}"/>`;
  }).join('');
  const horizon = name === 'level4_bg' || name === 'boss_arena'
    ? `<path d="M0 510 L160 470 L280 515 L410 430 L550 508 L700 455 L860 512 L1030 420 L1160 505 L1280 455 V720 H0Z" fill="#03060d" opacity=".72"/><path d="M0 510 L160 470 L280 515 L410 430 L550 508 L700 455 L860 512 L1030 420 L1160 505 L1280 455" fill="none" stroke="${fx.a}" stroke-width="2" opacity=".35"/>`
    : `<path d="M0 566 C180 535 320 573 510 548 S860 532 1050 566 S1190 542 1280 555 V720 H0Z" fill="#020812" opacity=".46"/>`;
  const nodes = Array.from({ length: 20 }, (_, i) => {
    const x = 22 + ((i * 197) % 1230); const y = 94 + ((i * 83) % 490);
    return `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 2.5 : 1.2}" fill="${i % 2 ? fx.b : fx.a}" opacity=".${i % 5 + 3}"/>`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs>${vertical}<filter id="bgGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="${w}" height="${h}" fill="url(#veil)"/>${streaks}${nodes}${horizon}<path d="M0 670 H1280" stroke="${fx.lines}" stroke-width="2" opacity=".32" filter="url(#bgGlow)"/></svg>`;
}

async function gradeBackgrounds() {
  for (const [stem, fx] of Object.entries(levelFx)) {
    const sourcePath = path.join(ART, `${stem}.png`);
    if (!fs.existsSync(sourcePath)) continue;
    const { data, info } = await sharp(sourcePath).ensureAlpha().modulate({ saturation: 1.16, brightness: .92 }).raw().toBuffer({ resolveWithObject: true });
    const base = await rgbaBuffer(data, info.width, info.height);
    const overlay = Buffer.from(backgroundOverlay(info.width, info.height, fx, stem));
    const output = await sharp(base).composite([{ input: overlay }]).png().toBuffer();
    await fs.promises.writeFile(sourcePath, output);
  }
}

async function main() {
  await saveCharacterSheets();
  if (process.argv.includes('--player-only')) {
    console.log('Player sheets rebuilt: expanded walk/run/jump/attack frame counts.');
    return;
  }
  await saveEnvironmentSprites();
  await gradeBackgrounds();
  console.log('Asset pass 2 complete: Nicolas, backgrounds, platforms, objects and pickups.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
