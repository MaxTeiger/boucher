import * as THREE from './vendor/three.module.min.js';

// ============================================================ outils
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const TEST = params.get('test');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 10) return String(Math.round(n * 10) / 10).replace('.', ',');
  if (n < 1000) return String(Math.round(n));
  let i = 0;
  while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  if (n >= 1000) return n.toExponential(1);
  const v = n < 10 ? Math.floor(n * 100) / 100 : n < 100 ? Math.floor(n * 10) / 10 : Math.floor(n);
  return String(v).replace('.', ',') + UNITS[i];
}
window.addEventListener('error', (e) => { const el = $('#err'); el.textContent += (e.message || e) + '\n'; el.classList.remove('hidden'); });

// ============================================================ données
const STATS = {
  atk: { label: 'ATQ', name: 'Attaque', color: '#ffb347', icon: '⚔️' },
  hp: { label: 'PV', name: 'Santé', color: '#ff5a6a', icon: '❤️' },
  regen: { label: 'RÉG', name: 'Régénération', color: '#5fe07a', icon: '✚' },
  speed: { label: 'VIT', name: 'Vitesse', color: '#62c8ff', icon: '👟' },
  cad: { label: 'CAD', name: 'Cadence', color: '#ffe066', icon: '⚡' },
};
const SCALED = { atk: 1, hp: 1, regen: 1 }; // les autres stats ne grossissent pas avec les zones
const CAPS = { speed: 9, cad: 3 };
function fmtStat(k, v) {
  if (k === 'cad') return '+' + Math.round(v * 100) + '%';
  if (k === 'speed') return v.toFixed(1).replace('.', ',');
  return fmt(v);
}
function fmtGain(k, v) {
  if (k === 'cad') return '+' + Math.round(v * 100) + '% CAD';
  if (k === 'speed') return '+' + v.toFixed(2).replace('.', ',') + ' VIT';
  return '+' + fmt(v) + ' ' + STATS[k].label;
}

const WEAPONS = {
  hachoir: { name: 'Hachoir du boucher', rarity: 'COMMUN', model: 'cleaver', mult: 1.0, cd: 1.0, range: 2.3, colors: [0xc9d1d9, 0x6b4226] },
  fendeur: { name: "Fendeur d'acier", rarity: 'COMMUN', model: 'axe', mult: 1.7, cd: 1.3, range: 2.5, colors: [0xdfe6ec, 0x5a3a22], boss: 'chef' },
  couperet: { name: 'Couperet éclair', rarity: 'RARE', model: 'cleaver', mult: 0.6, cd: 0.55, range: 2.1, colors: [0x8fdcff, 0x2f3b4a], glow: 0x1d6fa0, boss: 'sanglier' },
  seve: { name: 'Hache de sève', rarity: 'RARE', model: 'doubleaxe', mult: 2.4, cd: 1.5, range: 3.0, cleave: true, colors: [0x9be067, 0x4a3020], glow: 0x2f7a12, boss: 'ent' },
  crocs: { name: 'Crocs jumeaux', rarity: 'ÉPIQUE', model: 'dagger', mult: 0.55, cd: 0.35, range: 2.0, colors: [0xf4efe0, 0x3a3a44], boss: 'alpha' },
  masse: { name: 'Masse du golem', rarity: 'ÉPIQUE', model: 'mace', mult: 3.6, cd: 2.0, range: 3.2, cleave: true, colors: [0x8d8f99, 0x4a4a52], glow: 0x3fa9ff, boss: 'golem' },
  dragon: { name: 'Lame du dragon', rarity: 'LÉGENDAIRE', model: 'sword', mult: 2.2, cd: 0.8, range: 2.9, cleave: true, colors: [0xff7a2a, 0x2a1a14], glow: 0xff4400, boss: 'dragon' },
};
const RARITY_COLOR = { COMMUN: '#9fd3ff', RARE: '#5ad1ff', ÉPIQUE: '#d08bff', LÉGENDAIRE: '#ffb020' };
const SLOT_FROM = { sanglier: 2, ent: 3, golem: 4, dragon: 5 };
const SLOT_MAX = 5;

const TYPES = {
  // Prairie
  tree: { name: 'Arbre', model: 'tree', hp: 45, passive: true, radius: 0.9, h: 3.3, reward: ['hp', 8], respawn: 25 },
  slime: { name: 'Slime', model: 'slime', hp: 35, dmg: 3, cd: 1.2, speed: 2.2, aggro: 5, radius: 0.6, h: 1.4, reward: ['regen', 0.4], respawn: 25 },
  rabbit: { name: 'Lapin', model: 'rabbit', hp: 22, flee: true, speed: 4.3, radius: 0.45, h: 1.5, reward: ['speed', 0.12], respawn: 30 },
  recruit: { name: 'Recrue', model: 'recruit', hp: 60, dmg: 5, cd: 1.3, speed: 2.6, aggro: 6, radius: 0.6, h: 2.6, reward: ['atk', 1], respawn: 35 },
  // Forêt
  oak: { name: 'Grand chêne', model: 'oak', hp: 50, passive: true, radius: 1.1, h: 4.4, reward: ['hp', 9], respawn: 28 },
  mushroom: { name: 'Champignon', model: 'mushroom', hp: 40, dmg: 3.5, cd: 1.2, speed: 2.0, aggro: 5, radius: 0.65, h: 1.6, reward: ['regen', 0.45], respawn: 28 },
  wolf: { name: 'Loup', model: 'wolf', hp: 45, dmg: 4, cd: 0.9, speed: 4.2, aggro: 7, radius: 0.7, h: 1.9, reward: ['cad', 0.03], respawn: 32 },
  bandit: { name: 'Bandit', model: 'bandit', hp: 65, dmg: 5.5, cd: 1.3, speed: 2.8, aggro: 6, radius: 0.6, h: 2.6, reward: ['atk', 1.1], respawn: 38 },
  // Terres de feu
  lavarock: { name: 'Roche de lave', model: 'lavarock', hp: 55, passive: true, radius: 1.1, h: 2.3, reward: ['hp', 10], respawn: 30 },
  imp: { name: 'Diablotin', model: 'imp', hp: 40, dmg: 4, cd: 1.1, speed: 3.0, aggro: 6, radius: 0.6, h: 2.3, reward: ['regen', 0.5], respawn: 30 },
  salamander: { name: 'Salamandre', model: 'salamander', hp: 45, flee: true, speed: 4.6, radius: 0.6, h: 1.3, reward: ['speed', 0.1], respawn: 34 },
  knight: { name: 'Chevalier noir', model: 'knight', hp: 75, dmg: 6, cd: 1.3, speed: 2.6, aggro: 6, radius: 0.65, h: 2.7, reward: ['atk', 1.2], respawn: 40 },
  // Boss
  chef: { name: 'Chef bandit', model: 'chef', boss: true, hp: 500, dmg: 10, cd: 1.4, speed: 2.8, aggro: 8, radius: 1.2, h: 5.0, reward: ['atk', 3], respawn: 120, special: ['slam'], weapon: 'fendeur' },
  sanglier: { name: 'Sanglier géant', model: 'boar', boss: true, hp: 750, dmg: 12, cd: 1.6, speed: 3.0, aggro: 8, radius: 1.6, h: 4.2, reward: ['hp', 30], respawn: 150, special: ['charge'], weapon: 'couperet' },
  ent: { name: 'Ent ancien', model: 'ent', boss: true, hp: 600, dmg: 11, cd: 1.6, speed: 2.2, aggro: 8, radius: 1.7, h: 6.6, reward: ['hp', 35], respawn: 150, special: ['slam'], weapon: 'seve' },
  alpha: { name: 'Loup alpha', model: 'alpha', boss: true, hp: 520, dmg: 10, cd: 0.9, speed: 4.4, aggro: 9, radius: 1.5, h: 4.4, reward: ['cad', 0.08], respawn: 150, special: ['charge'], weapon: 'crocs' },
  golem: { name: 'Golem de pierre', model: 'golem', boss: true, hp: 700, dmg: 13, cd: 1.8, speed: 2.0, aggro: 8, radius: 1.8, h: 6.6, reward: ['atk', 4], respawn: 180, special: ['slam'], weapon: 'masse' },
  dragon: { name: 'Dragon de braise', model: 'dragon', boss: true, final: true, hp: 1100, dmg: 15, cd: 1.5, speed: 2.4, aggro: 11, radius: 2.4, h: 8.0, reward: ['regen', 3], respawn: 240, special: ['breath', 'slam'], weapon: 'dragon' },
};

const ZONES = [
  { name: 'Prairie', top: 22, bot: -41.2, z0: 5, z1: -38, types: { tree: 8, slime: 6, rabbit: 4, recruit: 6 }, bosses: [['chef', -14, -20], ['sanglier', 14, -31]] },
  { name: 'Forêt sombre', top: -42.8, bot: -107.2, z0: -47, z1: -103, types: { oak: 7, mushroom: 6, wolf: 5, bandit: 6 }, bosses: [['ent', -13, -70], ['alpha', 13, -93]] },
  { name: 'Terres de feu', top: -108.8, bot: -175, z0: -113, z1: -148, types: { lavarock: 7, imp: 6, salamander: 4, knight: 6 }, bosses: [['golem', -12, -128], ['dragon', 0, -162]] },
];
const GATES = [-42, -108];
const WORLD_END = -176;
const BASE = { x: 0, z: 14 };
const PORTAL = { x: 0, z: -171 };
// progression par « palier » (zone ; une île = 3 paliers) : PV ×9, dégâts ×5,5, bonus ×5
const HPM = (g) => Math.pow(9, g);
const DMGM = (g) => Math.pow(5.5, g);
const RWM = (g) => Math.pow(5, g);
const pathX = (z) => Math.sin(z * 0.045) * 2.6;

const PALETTES = [
  { name: 'printemps', sky: 0x9fd4e8, ground: [0x7dc35a, 0x3f7a3a, 0x6a5a52], grass: [0x5fae3f, 0x2f6a2c, 0x5a4a40], leaf: [[0x6cc04a, 0x8fd35a, 0x4fa83c], [0x2f7a3a, 0x3f8f45, 0x25663a], [0x5a3a2e, 0x6a3d2a, 0x3c2a26]], stone: 0xb8a48c, flowers: [0xffb6d5, 0xffffff, 0xffe066] },
  { name: 'automne', sky: 0xf1d3a8, ground: [0xb8b04e, 0xa0703a, 0x5e4a5a], grass: [0xa6a03c, 0x9a5f2c, 0x4f3f4c], leaf: [[0xe39b2f, 0xf2c14e, 0xd2662a], [0xb8451f, 0xd06a24, 0x8e3a1c], [0x4a3446, 0x5a3a52, 0x3a2a3a]], stone: 0xa89a86, flowers: [0xffd27a, 0xff9f5a, 0xffffff] },
  { name: 'hiver', sky: 0xd4e6f2, ground: [0xe8f0f4, 0xa9c8cf, 0x56658a], grass: [0xc8dce4, 0x86aab4, 0x47557a], leaf: [[0xeaf4f8, 0xffffff, 0xd2e6ee], [0x3f7a6a, 0x4f8f7a, 0x2f6a5a], [0x6a7fb0, 0x8aa0d0, 0x55689a]], stone: 0x9aa6b4, flowers: [0xbfe6ff, 0xffffff, 0xd6c8ff] },
];

// ============================================================ sauvegarde
const SAVE_KEY = 'boucher-save-v1';
function defaultSave() {
  return { tier: 0, stats: { atk: 10, hp: 100, regen: 1, speed: 5, cad: 0 }, weapons: { hachoir: { copies: 1, stars: 0, evo: 1 } }, equipped: ['hachoir'], slots: 1, defeated: {}, kills: 0, sound: true, zoom: false, started: false };
}
let save;
try { save = Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch { save = defaultSave(); }
const NOSAVE = !!TEST;
function saveGame() { if (NOSAVE) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
const S = save.stats;

if (TEST) applyTest(TEST);
function applyTest(t) {
  save = defaultSave(); Object.assign(S, save.stats); save.started = true;
  const s = save.stats;
  if (t === 'z2' || t === 'z3' || t === 'end') {
    Object.assign(s, { atk: 120, hp: 2500, regen: 30, speed: 7, cad: 0.4 });
    save.weapons = { hachoir: { copies: 3, stars: 0, evo: 1 }, fendeur: { copies: 4, stars: 0, evo: 1 }, couperet: { copies: 2, stars: 0, evo: 1 } };
    save.equipped = ['fendeur', 'couperet']; save.slots = 2;
    save.defeated = { chef: true, sanglier: true };
  }
  if (t === 'z3' || t === 'end') {
    Object.assign(s, { atk: 900, hp: 20000, regen: 200 });
    Object.assign(save.weapons, { seve: { copies: 6, stars: 1, evo: 1.4 }, crocs: { copies: 2, stars: 0, evo: 1 } });
    save.equipped = ['seve', 'fendeur', 'crocs']; save.slots = 3; Object.assign(save.defeated, { ent: true, alpha: true });
  }
  if (t === 'end') { save.defeated.golem = true; save.defeated.dragon = true; save.weapons.masse = { copies: 1, stars: 0, evo: 1 }; save.weapons.dragon = { copies: 1, stars: 0, evo: 1 }; save.slots = 5; save.equipped = ['dragon', 'masse', 'seve', 'fendeur', 'crocs']; }
  window.__save = save;
}
// (applyTest remplace l'objet save : on resynchronise la référence S)
const ST = () => save.stats;

const wState = (id) => save.weapons[id];
function wMult(id, extraCopies = 0) { const w = wState(id); return WEAPONS[id].mult * w.evo * (1 + 0.1 * (w.copies + extraCopies - 1)); }
const wNeed = (id) => 5 * (wState(id).stars + 1);
const cdOf = (id) => WEAPONS[id].cd / (1 + ST().cad);
function dps() { return save.equipped.reduce((a, id) => a + (ST().atk * wMult(id)) / cdOf(id), 0); }
const gateOpen = (i) => ZONES[i].bosses.every((b) => save.defeated[b[0]]);
const PAL = PALETTES[save.tier % PALETTES.length];

// ============================================================ rendu
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.sky, 48, 95);
const camera = new THREE.PerspectiveCamera(32, 1, 1, 260);
scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x55704a, 2.1));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const GEO = {
  sphere: new THREE.SphereGeometry(1, 18, 14), ico: new THREE.IcosahedronGeometry(1, 1), ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 12),
  cap: new THREE.CapsuleGeometry(0.5, 1, 6, 14), dodec: new THREE.DodecahedronGeometry(1, 0), torus: new THREE.TorusGeometry(1, 0.28, 8, 18),
  half: new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cylT: new THREE.CylinderGeometry(0.7, 1, 1, 10),
  disc: new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, 0, Math.PI),
};
const mat = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
function P(parent, geo, color, pos, scale, rot, o) {
  const m = new THREE.Mesh(GEO[geo] || geo, color && color.isMaterial ? color : mat(color, o));
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale != null) typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(scale[0], scale[1], scale[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  parent.add(m);
  return m;
}
const glowOpt = (c, i = 1) => ({ emissive: c, emissiveIntensity: i });

// ------------------------------------------------------------ armes
function weaponModel(spec) {
  const g = new THREE.Group();
  const [c1, c2] = spec.colors;
  const gl = spec.glow ? glowOpt(spec.glow, 0.7) : {};
  switch (spec.model) {
    case 'cleaver':
      P(g, 'cyl', c2, [0, 0.25, 0], [0.06, 0.5, 0.06]);
      P(g, 'box', c1, [0, 0.72, 0.17], [0.05, 0.48, 0.52], null, gl);
      P(g, 'box', 0x4a4f55, [0, 0.95, 0.17], [0.06, 0.05, 0.52]);
      break;
    case 'axe':
      P(g, 'cyl', c2, [0, 0.5, 0], [0.06, 1.0, 0.06]);
      P(g, 'box', c1, [0, 0.86, 0.18], [0.06, 0.32, 0.3], null, gl);
      P(g, 'disc', c1, [0, 0.86, 0.3], [0.27, 0.07, 0.27], [0, Math.PI / 2, Math.PI / 2], gl);
      break;
    case 'doubleaxe':
      P(g, 'cyl', c2, [0, 0.55, 0], [0.07, 1.1, 0.07]);
      for (const s of [1, -1]) {
        P(g, 'box', c1, [0, 0.92, 0.18 * s], [0.07, 0.3, 0.3], null, gl);
        P(g, 'disc', c1, [0, 0.92, 0.3 * s], [0.3, 0.08, 0.3], [0, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI / 2], gl);
      }
      P(g, 'ico0', 0x6cc04a, [0, 1.15, 0], 0.12, null, glowOpt(0x2f7a12, 0.8));
      break;
    case 'dagger':
      P(g, 'cyl', c2, [0, 0.15, 0], [0.05, 0.3, 0.05]);
      P(g, 'box', 0x8a8a92, [0, 0.31, 0], [0.07, 0.05, 0.24]);
      P(g, 'cone', c1, [0, 0.66, 0.04], [0.1, 0.66, 0.05], [0.12, 0, 0], gl);
      break;
    case 'mace':
      P(g, 'cyl', c2, [0, 0.5, 0], [0.07, 1.0, 0.07]);
      P(g, 'ico', c1, [0, 1.08, 0], 0.27, null, { flatShading: true });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        P(g, 'cone', spec.glow ? 0xbfe6ff : 0xcccccc, [Math.cos(a) * 0.27, 1.08, Math.sin(a) * 0.27], [0.07, 0.2, 0.07], [Math.sin(a) * Math.PI / 2, 0, -Math.cos(a) * Math.PI / 2], spec.glow ? glowOpt(spec.glow, 0.9) : {});
      }
      P(g, 'cone', 0xcccccc, [0, 1.38, 0], [0.07, 0.2, 0.07]);
      break;
    case 'sword':
    default:
      P(g, 'cyl', c2, [0, 0.14, 0], [0.05, 0.28, 0.05]);
      P(g, 'box', 0x7a6a50, [0, 0.3, 0], [0.08, 0.06, 0.34]);
      P(g, 'box', c1, [0, 0.82, 0], [0.04, 0.95, 0.16], null, gl);
      P(g, 'cone', c1, [0, 1.36, 0], [0.08, 0.14, 0.02], null, gl);
      break;
  }
  return g;
}

// ------------------------------------------------------------ personnages
function humanoid(o) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const bl = o.belly || 1;
  P(body, 'cap', o.pants, [-0.24, 0.32, 0], [0.42, 0.32, 0.42]);
  P(body, 'cap', o.pants, [0.24, 0.32, 0], [0.42, 0.32, 0.42]);
  P(body, 'sphere', o.shirt, [0, 1.08, 0], [0.62 * bl, 0.66, 0.52 * bl]);
  if (o.apron) P(body, 'box', o.apron, [0, 0.98, 0.43 * bl], [0.72, 0.8, 0.1]);
  if (o.belt) P(body, 'cyl', o.belt, [0, 0.82, 0], [0.6 * bl, 0.12, 0.5 * bl]);
  const head = new THREE.Group();
  head.position.y = 1.86;
  body.add(head);
  P(head, 'sphere', o.skin, [0, 0, 0], 0.36);
  P(head, 'sphere', 0xffffff, [0.13, 0.05, 0.29], 0.085);
  P(head, 'sphere', 0xffffff, [-0.13, 0.05, 0.29], 0.085);
  P(head, 'sphere', 0x1a1a1a, [0.13, 0.05, 0.36], 0.045);
  P(head, 'sphere', 0x1a1a1a, [-0.13, 0.05, 0.36], 0.045);
  P(head, 'box', 0x2a1a12, [0.13, 0.16, 0.32], [0.14, 0.035, 0.03], [0, 0, o.angry ? -0.35 : -0.1]);
  P(head, 'box', 0x2a1a12, [-0.13, 0.16, 0.32], [0.14, 0.035, 0.03], [0, 0, o.angry ? 0.35 : 0.1]);
  if (o.moustache) P(head, 'cap', o.moustache, [0, -0.1, 0.33], [0.2, 0.3, 0.12], [0, 0, Math.PI / 2]);
  if (o.hat === 'helm') { P(head, 'half', o.hatColor, [0, 0.05, 0], [0.4, 0.4, 0.4]); P(head, 'cyl', o.hatColor, [0, 0.06, 0], [0.43, 0.05, 0.43]); if (o.plume) P(head, 'cone', o.plume, [0, 0.5, -0.05], [0.07, 0.3, 0.16]); }
  if (o.hat === 'hood') { P(head, 'sphere', o.hatColor, [0, 0.06, -0.06], [0.42, 0.42, 0.42]); P(head, 'cone', o.hatColor, [0, 0.35, -0.25], [0.2, 0.4, 0.2], [-0.8, 0, 0]); P(head, 'box', 0x1a1a1a, [0, -0.1, 0.33], [0.36, 0.14, 0.04]); }
  if (o.hat === 'bandana') { P(head, 'half', o.hatColor, [0, 0.08, 0], [0.38, 0.33, 0.38]); P(head, 'sphere', o.hatColor, [0, 0.1, -0.38], [0.1, 0.1, 0.1]); }
  const arm = (side) => {
    const a = new THREE.Group();
    a.position.set(0.62 * side * Math.max(1, bl * 0.92), 1.48, 0);
    body.add(a);
    P(a, 'cap', o.shirt, [0, -0.3, 0], [0.32, 0.38, 0.32]);
    P(a, 'sphere', o.skin, [0, -0.7, 0], 0.15);
    const hand = new THREE.Group();
    hand.position.set(0, -0.72, 0.04);
    a.add(hand);
    return { a, hand };
  };
  const R = arm(1), L = arm(-1);
  R.a.rotation.z = 0.12; L.a.rotation.z = -0.12;
  if (o.weapon) { const w = weaponModel(o.weapon); w.rotation.x = Math.PI / 2 * 0.95; R.hand.add(w); }
  if (o.shield) { P(L.hand, 'cyl', o.shield, [0, 0.1, 0.18], [0.42, 0.08, 0.42], [Math.PI / 2, 0, 0]); P(L.hand, 'sphere', 0xc9b25a, [0, 0.1, 0.24], 0.09); }
  return { g, body, head, armR: R.a, armL: L.a, hand: R.hand };
}

function mTree(trunk, leaves, big = 1) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  P(body, 'cylT', trunk, [0, 0.75, 0], [0.28, 1.5, 0.28]);
  const fm = mat(leaves[0], { flatShading: true }), fm2 = mat(leaves[1], { flatShading: true });
  P(body, 'ico', fm, [0, 2.0, 0], [1.1, 0.95, 1.1]);
  P(body, 'ico', fm2, [0.48, 2.6, 0.12], [0.72, 0.68, 0.72]);
  P(body, 'ico', fm, [-0.42, 2.55, -0.18], [0.68, 0.62, 0.68]);
  P(body, 'ico', fm2, [0.05, 2.95, -0.1], [0.5, 0.48, 0.5]);
  g.scale.setScalar(big);
  return { g, body };
}

function mSlime(c) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  P(body, 'sphere', mat(c, { transparent: true, opacity: 0.9 }), [0, 0.45, 0], [0.62, 0.47, 0.62]);
  P(body, 'sphere', 0xffffff, [0.2, 0.62, 0.42], 0.13);
  P(body, 'sphere', 0xffffff, [-0.2, 0.62, 0.42], 0.13);
  P(body, 'sphere', 0x111111, [0.2, 0.62, 0.53], 0.065);
  P(body, 'sphere', 0x111111, [-0.2, 0.62, 0.53], 0.065);
  P(body, 'sphere', mat(0xffffff, { transparent: true, opacity: 0.6 }), [-0.26, 0.74, 0.18], 0.1);
  return { g, body };
}
function mRabbit(c) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  P(body, 'sphere', c, [0, 0.38, -0.05], [0.36, 0.33, 0.45]);
  P(body, 'sphere', c, [0, 0.72, 0.3], 0.27);
  for (const s of [1, -1]) {
    P(body, 'cap', c, [0.1 * s, 1.08, 0.24], [0.16, 0.3, 0.1], [-0.2, 0, -0.15 * s]);
    P(body, 'sphere', 0x111111, [0.12 * s, 0.78, 0.52], 0.05);
  }
  P(body, 'sphere', 0xff9ab0, [0, 0.7, 0.57], 0.045);
  P(body, 'sphere', 0xffffff, [0, 0.45, -0.5], 0.14);
  return { g, body };
}
function mMushroom(cap) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  P(body, 'cylT', 0xf1e3c8, [0, 0.36, 0], [0.33, 0.72, 0.33]);
  P(body, 'half', cap, [0, 0.66, 0], [0.75, 0.55, 0.75]);
  for (let i = 0; i < 6; i++) { const a = i * 1.1, rr = i % 2 ? 0.45 : 0.3; P(body, 'sphere', 0xffffff, [Math.cos(a) * rr, 0.66 + 0.5 * Math.sqrt(1 - (rr / 0.75) ** 2), Math.sin(a) * rr], 0.08); }
  P(body, 'sphere', 0x1a1a1a, [0.11, 0.42, 0.3], 0.06);
  P(body, 'sphere', 0x1a1a1a, [-0.11, 0.42, 0.3], 0.06);
  return { g, body };
}
function mWolf(c, c2, eye) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  P(body, 'cap', c, [0, 0.78, 0], [0.75, 0.6, 0.7], [Math.PI / 2, 0, 0]);
  P(body, 'sphere', c, [0, 1.08, 0.66], [0.32, 0.3, 0.33]);
  P(body, 'box', c2, [0, 1.0, 0.98], [0.2, 0.17, 0.32]);
  P(body, 'sphere', 0x111111, [0, 1.06, 1.15], 0.05);
  for (const s of [1, -1]) {
    P(body, 'cone', c, [0.15 * s, 1.38, 0.6], [0.09, 0.22, 0.07]);
    P(body, 'sphere', 0x111111, [0.13 * s, 1.13, 0.9], 0.05, null, eye ? glowOpt(eye, 1.2) : {}).material.color.set(eye || 0x111111);
    P(body, 'cyl', c, [0.22 * s, 0.27, 0.35], [0.08, 0.54, 0.08]);
    P(body, 'cyl', c, [0.22 * s, 0.27, -0.38], [0.08, 0.54, 0.08]);
  }
  P(body, 'cone', c, [0, 0.98, -0.78], [0.13, 0.65, 0.13], [-1.0, 0, 0]);
  return { g, body };
}
function mBoar() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const c = 0x6e4a33;
  P(body, 'sphere', c, [0, 1.0, 0], [0.9, 0.78, 1.2]);
  P(body, 'sphere', c, [0, 0.98, 1.05], 0.55);
  P(body, 'cyl', 0xc98a7a, [0, 0.88, 1.55], [0.24, 0.3, 0.2], [Math.PI / 2, 0, 0]);
  P(body, 'sphere', 0x5a2a20, [0.08, 0.88, 1.71], 0.05);
  P(body, 'sphere', 0x5a2a20, [-0.08, 0.88, 1.71], 0.05);
  for (const s of [1, -1]) {
    P(body, 'cone', 0xf5efe0, [0.24 * s, 0.85, 1.5], [0.07, 0.38, 0.07], [0.55, 0, -0.25 * s]);
    P(body, 'sphere', 0xffd23f, [0.25 * s, 1.18, 1.42], 0.07, null, glowOpt(0xff3300, 0.6));
    P(body, 'cone', c, [0.32 * s, 1.5, 0.9], [0.12, 0.25, 0.08], [0, 0, -0.4 * s]);
    P(body, 'cyl', 0x4a3022, [0.42 * s, 0.32, 0.55], [0.13, 0.64, 0.13]);
    P(body, 'cyl', 0x4a3022, [0.42 * s, 0.32, -0.55], [0.13, 0.64, 0.13]);
  }
  for (let i = 0; i < 6; i++) P(body, 'cone', 0x2a1a12, [0, 1.72 - i * 0.03, 0.75 - i * 0.3], [0.1, 0.38, 0.1], [-0.3, 0, 0]);
  return { g, body };
}
function mLavarock() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const rm = mat(0x3d3434, { flatShading: true });
  P(body, 'dodec', rm, [0, 0.78, 0], [1.1, 0.88, 1.0]);
  P(body, 'dodec', rm, [0.85, 0.35, 0.35], 0.42);
  const lava = mat(0xff7a1a, glowOpt(0xff5a00, 1.4));
  P(body, 'box', lava, [0.25, 0.9, 0.86], [0.09, 0.7, 0.06], [0, 0, 0.4]);
  P(body, 'box', lava, [-0.35, 0.75, 0.8], [0.08, 0.5, 0.06], [0, 0, -0.5]);
  P(body, 'box', lava, [0.6, 1.1, 0.5], [0.07, 0.45, 0.06], [0, 0.9, 0.2]);
  return { g, body };
}
function mImp() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  P(body, 'sphere', 0xd8352a, [0, 1.05, 0], 0.45);
  P(body, 'sphere', 0xf08a5a, [0, 0.95, 0.22], [0.3, 0.3, 0.25]);
  for (const s of [1, -1]) {
    P(body, 'cone', 0x2a1a1a, [0.2 * s, 1.5, 0.05], [0.08, 0.28, 0.08], [0, 0, -0.35 * s]);
    P(body, 'sphere', 0xffe066, [0.15 * s, 1.15, 0.38], 0.08, null, glowOpt(0xffaa00, 1));
    const w = P(body, 'box', 0x7a1a14, [0.55 * s, 1.2, -0.25], [0.6, 0.42, 0.04], [0, 0.5 * s, 0.35 * s]);
    w.name = s > 0 ? 'wingR' : 'wingL';
    P(body, 'cyl', 0xd8352a, [0.15 * s, 0.45, 0], [0.08, 0.4, 0.08]);
  }
  P(body, 'cone', 0xd8352a, [0, 0.8, -0.5], [0.06, 0.6, 0.06], [-1.8, 0, 0]);
  return { g, body };
}
function mSalamander() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const c = 0xf08a24;
  P(body, 'cap', c, [0, 0.33, 0], [0.55, 0.6, 0.45], [Math.PI / 2, 0, 0]);
  P(body, 'sphere', c, [0, 0.42, 0.72], [0.3, 0.22, 0.32]);
  P(body, 'cone', c, [0, 0.3, -0.95], [0.16, 0.8, 0.12], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) P(body, 'sphere', 0x2a1a12, [((i % 2) - 0.5) * 0.25, 0.55, 0.35 - i * 0.22], 0.07);
  for (const s of [1, -1]) {
    P(body, 'sphere', 0x111111, [0.15 * s, 0.52, 0.88], 0.05);
    P(body, 'cyl', c, [0.3 * s, 0.12, 0.35], [0.07, 0.24, 0.07], [0, 0, 0.6 * s]);
    P(body, 'cyl', c, [0.3 * s, 0.12, -0.3], [0.07, 0.24, 0.07], [0, 0, 0.6 * s]);
  }
  return { g, body };
}
function mEnt() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const bark = 0x6b4a2f, leaves = PAL.leaf[1];
  const lm = mat(leaves[0], { flatShading: true }), lm2 = mat(leaves[1], { flatShading: true });
  P(body, 'cylT', bark, [-0.45, 0.55, 0], [0.36, 1.1, 0.36]);
  P(body, 'cylT', bark, [0.45, 0.55, 0], [0.36, 1.1, 0.36]);
  P(body, 'cylT', bark, [0, 1.95, 0], [0.9, 2.0, 0.75]);
  P(body, 'sphere', 0x9be067, [0.28, 2.35, 0.6], 0.12, null, glowOpt(0x7fff3a, 1.2));
  P(body, 'sphere', 0x9be067, [-0.28, 2.35, 0.6], 0.12, null, glowOpt(0x7fff3a, 1.2));
  P(body, 'box', 0x3a2414, [0, 2.55, 0.62], [0.75, 0.12, 0.12]);
  P(body, 'box', 0x2a1a0e, [0, 1.85, 0.65], [0.4, 0.12, 0.1]);
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.85 * s, 2.5, 0);
    a.rotation.z = 0.35 * s;
    body.add(a);
    P(a, 'cap', bark, [0, -0.75, 0], [0.34, 0.85, 0.34]);
    P(a, 'ico', lm2, [0, -1.45, 0.05], 0.42);
    P(a, 'ico', lm, [0.1 * s, 0.15, 0], 0.55);
    arms.push(a);
  }
  P(body, 'ico', lm, [0, 3.3, 0], 1.15);
  P(body, 'ico', lm2, [0.7, 3.05, 0.25], 0.7);
  P(body, 'ico', lm2, [-0.7, 3.1, -0.15], 0.75);
  P(body, 'ico', lm, [0.1, 3.85, -0.2], 0.6);
  g.scale.setScalar(1.55);
  return { g, body, armR: arms[0], armL: arms[1] };
}
function mGolem() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const st = mat(0x8a8d96, { flatShading: true }), st2 = mat(0x6f727c, { flatShading: true });
  const moss = mat(0x5f9a3a, { flatShading: true });
  P(body, 'box', st2, [-0.45, 0.5, 0], [0.55, 1.0, 0.6]);
  P(body, 'box', st2, [0.45, 0.5, 0], [0.55, 1.0, 0.6]);
  P(body, 'box', st, [0, 1.65, 0], [1.6, 1.35, 1.05], [0, 0, 0.03]);
  P(body, 'box', moss, [0.5, 2.35, 0], [0.6, 0.12, 0.9]);
  P(body, 'box', st, [0, 2.6, 0.12], [0.72, 0.6, 0.66]);
  const eye = mat(0x9fe3ff, glowOpt(0x3fa9ff, 1.6));
  P(body, 'box', eye, [0.16, 2.65, 0.46], [0.14, 0.08, 0.04]);
  P(body, 'box', eye, [-0.16, 2.65, 0.46], [0.14, 0.08, 0.04]);
  P(body, 'cone', eye, [0.3, 2.5, -0.55], [0.15, 0.5, 0.15], [-0.5, 0, 0.3]);
  P(body, 'cone', eye, [-0.25, 2.4, -0.55], [0.12, 0.4, 0.12], [-0.6, 0, -0.3]);
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(1.05 * s, 2.05, 0);
    body.add(a);
    P(a, 'box', st2, [0, -0.6, 0], [0.5, 1.25, 0.55]);
    P(a, 'box', st, [0, -1.4, 0.05], [0.68, 0.62, 0.68]);
    arms.push(a);
  }
  g.scale.setScalar(1.75);
  return { g, body, armR: arms[0], armL: arms[1] };
}
function mDragon() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const red = 0x8e2a1c, belly = 0xe9a03b, dark = 0x3a120c;
  const spot = mat(0xffa030, glowOpt(0xff6a00, 1.5));
  P(body, 'sphere', red, [0, 1.6, 0], [1.1, 0.95, 1.7]);
  P(body, 'sphere', belly, [0, 1.35, 0.3], [0.85, 0.7, 1.35]);
  for (let i = 0; i < 7; i++) P(body, 'sphere', spot, [((i % 3) - 1) * 0.45, 2.35 - Math.abs((i % 3) - 1) * 0.15, 1.0 - i * 0.32], 0.13);
  for (let i = 0; i < 5; i++) P(body, 'cone', dark, [0, 2.5 - i * 0.05, 0.9 - i * 0.45], [0.12, 0.4, 0.12], [-0.3, 0, 0]);
  P(body, 'cyl', red, [0, 2.35, 1.55], [0.36, 1.4, 0.36], [0.75, 0, 0]);
  const head = new THREE.Group();
  head.position.set(0, 2.95, 2.25);
  body.add(head);
  P(head, 'box', red, [0, 0, 0], [0.75, 0.58, 0.9]);
  P(head, 'box', red, [0, -0.1, 0.62], [0.52, 0.36, 0.62]);
  P(head, 'box', dark, [0, -0.25, 0.6], [0.48, 0.1, 0.6]);
  for (const s of [1, -1]) {
    P(head, 'cone', 0xe9d8b0, [0.24 * s, 0.4, -0.35], [0.09, 0.5, 0.09], [-0.9, 0, 0.2 * s]);
    P(head, 'sphere', 0xffe066, [0.27 * s, 0.12, 0.38], 0.09, null, glowOpt(0xffaa00, 1.5));
    P(body, 'cyl', red, [0.6 * s, 0.55, 0.8], [0.22, 1.0, 0.22]);
    P(body, 'cyl', red, [0.6 * s, 0.55, -0.8], [0.22, 1.0, 0.22]);
  }
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.3); wingShape.lineTo(3.4, 1.4); wingShape.lineTo(3.0, -0.2); wingShape.lineTo(2.2, -0.6); wingShape.lineTo(1.5, -0.4); wingShape.lineTo(0.9, -1.0); wingShape.lineTo(0, -0.7);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wm = mat(0xd9822b, { side: THREE.DoubleSide, ...glowOpt(0x7a2a00, 0.4) });
  const wings = [];
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(0.7 * s, 2.3, 0.3);
    body.add(w);
    const m = P(w, wingGeo, wm, [0, 0, 0], [s, 1, 1], [-Math.PI / 2, 0, 0]);
    m.castShadow = true;
    wings.push(w);
  }
  let tz = -1.6, ts = 0.55;
  for (let i = 0; i < 4; i++) { P(body, 'sphere', red, [0, 1.35 - i * 0.18, tz], ts); tz -= ts * 1.4; ts *= 0.78; }
  P(body, 'cone', dark, [0, 0.75, tz + 0.1], [0.3, 0.6, 0.1], [-Math.PI / 2, 0, 0]);
  g.scale.setScalar(1.7);
  return { g, body, wings, head };
}

function buildModel(name) {
  const L = PAL.leaf;
  switch (name) {
    case 'tree': return mTree(0x7a5236, L[0]);
    case 'oak': { const m = mTree(0x5a3a24, L[1], 1.35); return m; }
    case 'slime': return mSlime(0x6bdc5a);
    case 'rabbit': return mRabbit(0xf2e6d2);
    case 'recruit': return humanoid({ skin: 0xf0bf90, shirt: 0x3f78c6, pants: 0x6a4b33, belt: 0x3a2a1a, hat: 'helm', hatColor: 0x9aa3ad, weapon: { model: 'sword', colors: [0xd8dde2, 0x5a3a22] } });
    case 'mushroom': return mMushroom(0xd6453a);
    case 'wolf': return mWolf(0x8a8f99, 0xb8bcc4, 0xffd23f);
    case 'bandit': return humanoid({ skin: 0xe8b58a, shirt: 0x7a5a3a, pants: 0x3b2f25, belt: 0x2a1a12, hat: 'hood', hatColor: 0x2f5a3a, angry: true, weapon: { model: 'dagger', colors: [0xcfd5da, 0x3a2a20] } });
    case 'lavarock': return mLavarock();
    case 'imp': return mImp();
    case 'salamander': return mSalamander();
    case 'knight': return humanoid({ skin: 0xd9a07a, shirt: 0x3c4252, pants: 0x24272f, hat: 'helm', hatColor: 0x3a3d48, plume: 0xb3262f, angry: true, weapon: { model: 'sword', colors: [0xd0d6dc, 0x3a2a20] }, shield: 0x7a1f2b });
    case 'chef': { const m = humanoid({ skin: 0xe0a77c, shirt: 0x8a2f2f, pants: 0x2f2a26, belt: 0x1a1210, hat: 'bandana', hatColor: 0x222222, moustache: 0x2a1a12, angry: true, belly: 1.3, weapon: { model: 'axe', colors: [0xdfe6ec, 0x5a3a22] } }); m.g.scale.setScalar(2.0); return m; }
    case 'boar': { const m = mBoar(); m.g.scale.setScalar(2.1); return m; }
    case 'ent': return mEnt();
    case 'alpha': { const m = mWolf(0x3a3f4a, 0x5a606c, 0xff3030); m.g.scale.setScalar(2.4); return m; }
    case 'golem': return mGolem();
    case 'dragon': return mDragon();
  }
}

// ============================================================ monde
const world = new THREE.Group();
scene.add(world);
const zoneOf = (z) => (z > GATES[0] ? 0 : z > GATES[1] ? 1 : 2);

function noise2(x, z) { return Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2) * 0.5 + Math.sin(z * 0.23 + x * 0.11) * 0.5; }
function buildGround() {
  const geo = new THREE.PlaneGeometry(110, 240, 55, 120);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -78);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), c2 = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const zi = zoneOf(z);
    c.set(PAL.ground[zi]);
    // fondu doux aux portes
    for (let k = 0; k < 2; k++) { const d = z - GATES[k]; if (Math.abs(d) < 4) { c2.set(PAL.ground[d > 0 ? k + 1 : k]); c.lerp(c2, (1 - Math.abs(d) / 4) * 0.5); } }
    const n = noise2(x, z) * 0.07;
    c.offsetHSL(0, 0, n);
    if (Math.abs(x) > 27) c.multiplyScalar(0.82);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true;
  world.add(m);
}

function instanced(geo, material, list, { shadow = false, recv = false } = {}) {
  const im = new THREE.InstancedMesh(geo, material, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  list.forEach((it, i) => {
    p.set(it.x, it.y || 0, it.z);
    e.set(it.rx || 0, it.ry || 0, it.rz || 0);
    q.setFromEuler(e);
    if (typeof it.s === 'number') s.setScalar(it.s); else s.set(it.s[0], it.s[1], it.s[2]);
    m4.compose(p, q, s);
    im.setMatrixAt(i, m4);
    if (it.c != null) im.setColorAt(i, c.set(it.c));
  });
  im.castShadow = shadow; im.receiveShadow = recv;
  world.add(im);
  return im;
}

function buildPath() {
  const list = [], rng = mulberry32(7), c = new THREE.Color();
  for (let z = 21; z > WORLD_END + 2; z -= 1.15) {
    const cx = pathX(z);
    for (const o of [-1.25, 0, 1.25]) {
      c.set(PAL.stone).offsetHSL(0, 0, (rng() - 0.5) * 0.12);
      if (zoneOf(z) === 2) c.multiplyScalar(0.6);
      list.push({ x: cx + o + (rng() - 0.5) * 0.3, y: 0.03, z: z + (rng() - 0.5) * 0.3, ry: (rng() - 0.5) * 0.5, s: [1.05 + rng() * 0.15, 0.1, 1.0 + rng() * 0.15], c: c.getHex() });
    }
  }
  instanced(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff), list, { recv: true });
}

function mergeGeos(geos) {
  const parts = geos.map((g) => g.toNonIndexed());
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

function buildGrass() {
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.ConeGeometry(0.07, 0.55 + (i % 2) * 0.2, 3);
    b.translate(0, 0.3, 0);
    b.rotateZ((i - 1.5) * 0.35);
    b.rotateY(i * 1.7);
    b.translate((i - 1.5) * 0.08, 0, ((i * 7) % 3 - 1) * 0.07);
    blades.push(b);
  }
  const geo = mergeGeos(blades);
  const rng = mulberry32(11), list = [], fl = [], c = new THREE.Color();
  for (let i = 0; i < 4200; i++) {
    const x = (rng() - 0.5) * 66, z = 23 - rng() * 200;
    if (Math.abs(x - pathX(z)) < 2.4) continue;
    const zi = zoneOf(z);
    c.set(PAL.grass[zi]).offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.12);
    list.push({ x, z, ry: rng() * 6, s: 0.8 + rng() * 0.7, c: c.getHex() });
    if (zi < 2 && rng() < (zi === 0 ? 0.16 : 0.05)) fl.push({ x: x + 0.3, y: 0.45, z: z + 0.2, s: 0.09 + rng() * 0.04, c: PAL.flowers[(rng() * 3) | 0] });
    if (zi === 2 && rng() < 0.05) fl.push({ x: x + 0.3, y: 0.08, z: z + 0.2, s: 0.07, c: 0xff7a1a });
  }
  instanced(geo, mat(0xffffff), list);
  instanced(GEO.ico0, mat(0xffffff, glowOpt(0x222222, 0.3)), fl);
}

function buildBorders() {
  const rng = mulberry32(23), trunks = [], leaves = [], rocks = [];
  const addTree = (x, z, s) => {
    const zi = zoneOf(z), L = PAL.leaf[zi];
    trunks.push({ x, y: 0.75 * s, z, s: [0.3 * s, 1.5 * s, 0.3 * s], c: zi === 2 ? 0x3a2a24 : 0x6a4a30 });
    if (zi === 2 && rng() < 0.6) return; // arbres morts dans les terres de feu
    leaves.push({ x, y: 2.1 * s, z, s: 1.25 * s, ry: rng() * 6, c: L[(rng() * 3) | 0] });
    leaves.push({ x: x + 0.5 * s, y: 2.7 * s, z: z + 0.2, s: 0.8 * s, ry: rng() * 6, c: L[(rng() * 3) | 0] });
    leaves.push({ x: x - 0.45 * s, y: 2.6 * s, z: z - 0.3, s: 0.75 * s, ry: rng() * 6, c: L[(rng() * 3) | 0] });
  };
  for (let z = 26; z > WORLD_END - 8; z -= 2.6) {
    for (const side of [1, -1]) {
      for (let row = 0; row < 3; row++) addTree(side * (30 + row * 4.2 + rng() * 2.5), z + rng() * 2, 1.1 + rng() * 0.6);
      rocks.push({ x: side * (27.6 + rng() * 0.8), y: 0.4, z: z + rng(), s: [1 + rng() * 0.8, 0.8 + rng() * 0.9, 1 + rng() * 0.8], ry: rng() * 6, c: zoneOf(z) === 2 ? 0x4a4040 : 0x8a8c90 });
    }
  }
  for (let x = -40; x <= 40; x += 2.4) {
    addTree(x + rng(), 25 + rng() * 3, 1.2 + rng() * 0.5);
    rocks.push({ x: x + rng(), y: 0.6, z: WORLD_END - 1 - rng(), s: [1.4 + rng(), 1.2 + rng() * 2.4, 1.4 + rng()], ry: rng() * 6, c: 0x4a4040 });
    rocks.push({ x: x + rng(), y: 1.4, z: WORLD_END - 4 - rng() * 2, s: [2 + rng(), 2.5 + rng() * 3, 2 + rng()], ry: rng() * 6, c: 0x3a3232 });
  }
  for (let i = 0; i < 26; i++) { const z = -46 - rng() * 58, x = (rng() < 0.5 ? -1 : 1) * (19 + rng() * 6.5); if (Math.hypot(x + 13, z + 70) > 8 && Math.hypot(x - 13, z + 93) > 8) addTree(x, z, 1.4 + rng() * 0.6); }
  instanced(GEO.cylT, mat(0xffffff), trunks, { shadow: true });
  instanced(GEO.ico, mat(0xffffff, { flatShading: true }), leaves, { shadow: true });
  instanced(GEO.dodec, mat(0xffffff, { flatShading: true }), rocks, { shadow: true, recv: true });
}

const gates = [];
function buildGates() {
  GATES.forEach((gz, i) => {
    const grp = new THREE.Group();
    grp.position.z = gz;
    world.add(grp);
    const wood = mat(0x9a6a40), wood2 = mat(0x7a4f2e), stone = mat(0x9a9ca4, { flatShading: true });
    const posts = [], planks = [];
    for (let x = -27; x <= 27; x += 1.0) {
      if (Math.abs(x) < 3.2) continue;
      planks.push({ x, y: 0.9, z: (Math.abs(x * 7) % 3) * 0.05, s: [0.85, 1.8 + (Math.abs(x * 13) % 5) * 0.08, 0.3], c: x % 2 ? 0xa8764a : 0x936238 });
    }
    for (let x = -27; x <= 27; x += 5) if (Math.abs(x) > 3.2) posts.push({ x, y: 1.1, z: 0.25, s: [0.5, 2.2, 0.5], c: 0x8a8c94 });
    const ip = instanced(GEO.box, mat(0xffffff), planks, { shadow: true });
    ip.position.z = gz; ip.parent.remove(ip); grp.add(ip); ip.position.z = 0;
    const ips = instanced(GEO.box, mat(0xffffff), posts, { shadow: true });
    ips.parent.remove(ips); grp.add(ips);
    for (const s of [1, -1]) {
      P(grp, 'box', stone, [3.0 * s, 1.5, 0], [1.3, 3.0, 1.3]);
      P(grp, 'box', stone, [3.0 * s, 3.15, 0], [1.6, 0.35, 1.6]);
      P(grp, 'box', wood2, [4.2 * s, 0.6, 0.2], [1.2, 0.35, 0.35]);
    }
    const door = new THREE.Group();
    grp.add(door);
    P(door, 'box', wood, [-1.18, 1.25, 0], [2.3, 2.5, 0.35]);
    P(door, 'box', wood, [1.18, 1.25, 0], [2.3, 2.5, 0.35]);
    P(door, 'box', wood2, [0, 0.6, 0.2], [4.6, 0.25, 0.1]);
    P(door, 'box', wood2, [0, 1.9, 0.2], [4.6, 0.25, 0.1]);
    const chain = mat(0xb06bff, glowOpt(0x8a2be2, 1.3));
    for (const d of [1, -1]) for (let k = -3; k <= 3; k++) {
      const t = P(door, 'torus', chain, [k * 0.55, 1.35 + k * 0.32 * d, 0.32], [0.17, 0.17, 0.17], [0, k % 2 ? Math.PI / 2 : 0, Math.atan2(0.32 * d, 0.55)]);
      t.castShadow = false;
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xd59bff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.position.set(0, 1.35, 0.4);
    door.add(ring);
    gates.push({ z: gz, grp, door, ring, i, open: false, el: null });
  });
}

function buildBase() {
  const g = new THREE.Group();
  g.position.set(-8, 0, 17);
  world.add(g);
  P(g, 'box', 0x8a5a36, [0, 1.0, 0], [2.0, 0.9, 3.4]);
  P(g, 'disc', 0xf2eadb, [0, 1.45, 0], [1.1, 3.0, 1.0], [Math.PI / 2, 0, -Math.PI / 2]).rotation.set(Math.PI / 2, Math.PI / 2, 0);
  for (const s of [1, -1]) for (const t of [1, -1]) P(g, 'cyl', 0x5a3a22, [1.05 * s, 0.55, 1.1 * t], [0.55, 0.15, 0.55], [0, 0, Math.PI / 2]);
  const barrel = (x, z) => { const b = new THREE.Group(); b.position.set(x, 0, z); world.add(b); P(b, 'cyl', 0x8a5a36, [0, 0.55, 0], [0.5, 1.1, 0.5]); P(b, 'cyl', 0x4a4f55, [0, 0.3, 0], [0.52, 0.08, 0.52]); P(b, 'cyl', 0x4a4f55, [0, 0.8, 0], [0.52, 0.08, 0.52]); };
  barrel(-4.8, 19); barrel(-5.6, 18.2); barrel(7.5, 18.5);
  const crate = (x, z, s = 1) => P(world, 'box', 0xb07a45, [x, 0.5 * s, z], [s, s, s], [0, x, 0]);
  crate(6.2, 19.2); crate(7.0, 20.1, 0.8); crate(-10.5, 13.5, 0.9);
  // feu de camp
  const fire = new THREE.Group();
  fire.position.set(4, 0, 13);
  world.add(fire);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P(fire, 'dodec', 0x777777, [Math.cos(a) * 0.7, 0.15, Math.sin(a) * 0.7], 0.25, null, { flatShading: true }); }
  P(fire, 'cyl', 0x5a3a22, [0, 0.15, 0], [0.1, 1.0, 0.1], [0, 0, Math.PI / 2]);
  P(fire, 'cyl', 0x5a3a22, [0, 0.15, 0], [0.1, 1.0, 0.1], [Math.PI / 2, 0, 0]);
  campFire = [P(fire, 'cone', 0xffa030, [0, 0.55, 0], [0.32, 0.8, 0.32], null, glowOpt(0xff6a00, 1.6)), P(fire, 'cone', 0xffe066, [0, 0.45, 0], [0.18, 0.55, 0.18], null, glowOpt(0xffcc00, 1.6))];
  campFire.forEach((m) => (m.castShadow = false));
}
let campFire = [];

const lavaPools = [];
function buildDecor() {
  const rng = mulberry32(99);
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
  for (let i = 0; i < 12; i++) {
    const z = -112 - rng() * 60, x = (rng() < 0.5 ? -1 : 1) * (6 + rng() * 17);
    if (Math.hypot(x, z + 162) < 10) continue;
    const r = 1.2 + rng() * 1.8;
    const rim = new THREE.Mesh(new THREE.CircleGeometry(r + 0.4, 20), mat(0x2a2020));
    rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.02, z); world.add(rim);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), lavaMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); world.add(m);
    lavaPools.push(m);
  }
  // quelques rochers et souches décoratives dans les zones
  const rocks = [];
  for (let i = 0; i < 40; i++) {
    const z = 4 - rng() * 175, x = (rng() - 0.5) * 50;
    if (Math.abs(x - pathX(z)) < 3) continue;
    rocks.push({ x, y: 0.15, z, s: [0.3 + rng() * 0.5, 0.25 + rng() * 0.3, 0.3 + rng() * 0.5], ry: rng() * 6, c: zoneOf(z) === 2 ? 0x4a4040 : 0x9a9ca4 });
  }
  instanced(GEO.dodec, mat(0xffffff, { flatShading: true }), rocks, { shadow: true });
}

let portal = null;
function buildPortal() {
  const g = new THREE.Group();
  g.position.set(PORTAL.x, 0, PORTAL.z);
  world.add(g);
  const pm = mat(0xc77dff, glowOpt(0x8a2be2, 1.5));
  const ring = P(g, 'torus', pm, [0, 2.0, 0], [1.6, 1.6, 1.0]);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.55, 32), new THREE.MeshBasicMaterial({ color: 0x6a1fd0, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
  inner.position.y = 2.0;
  g.add(inner);
  const swirl = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.3, 32, 1, 0, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: 0xe6c8ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  swirl.position.set(0, 2.0, 0.02);
  g.add(swirl);
  P(g, 'box', mat(0x6a6a74, { flatShading: true }), [0, 0.2, 0], [4, 0.4, 1.4]);
  portal = { g, swirl, ring };
  g.visible = false;
}

buildGround(); buildPath(); buildGrass(); buildBorders(); buildGates(); buildBase(); buildDecor(); buildPortal();

// ============================================================ overlays DOM
const ovRoot = $('#overlays');
const _v = new THREE.Vector3();
let W = innerWidth, H = innerHeight;
function toScreen(x, y, z) {
  _v.set(x, y, z).project(camera);
  return { x: (_v.x + 1) * 0.5 * W, y: (1 - _v.y) * 0.5 * H, ok: _v.z < 1 && _v.x > -1.2 && _v.x < 1.2 && _v.y > -1.2 && _v.y < 1.3 };
}
function place(el, x, y) { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`; }

const ftxts = [];
function floatText(x, y, z, text, color = '#fff', cls = '') {
  let f = ftxts.find((t) => t.life <= 0);
  if (!f) { if (ftxts.length > 60) return; f = { el: document.createElement('div') }; ovRoot.appendChild(f.el); ftxts.push(f); }
  f.el.className = 'ftxt ' + cls;
  f.el.textContent = text;
  f.el.style.color = color;
  f.el.style.display = '';
  Object.assign(f, { x: x + rnd(-0.4, 0.4), y, z, life: 1, max: cls === 'big' ? 1.6 : 1, vy: 2.2 });
}
function updateTexts(dt) {
  for (const f of ftxts) {
    if (f.life <= 0) continue;
    f.life -= dt / f.max;
    f.y += f.vy * dt;
    f.vy *= 0.94;
    if (f.life <= 0) { f.el.style.display = 'none'; continue; }
    const p = toScreen(f.x, f.y, f.z);
    place(f.el, p.x, p.y);
    f.el.style.opacity = Math.min(1, f.life * 3);
  }
}

// ============================================================ particules
const parts = [];
const partGeo = new THREE.BoxGeometry(1, 1, 1);
function burst(x, y, z, color, n = 8, speed = 4, size = 0.18) {
  for (let i = 0; i < n; i++) {
    let p = parts.find((q) => q.life <= 0);
    if (!p) { if (parts.length > 160) return; const m = new THREE.Mesh(partGeo, new THREE.MeshLambertMaterial()); scene.add(m); p = { m }; parts.push(p); }
    p.m.material.color.set(color);
    p.m.visible = true;
    p.m.position.set(x, y, z);
    p.m.scale.setScalar(size * rnd(0.6, 1.3));
    p.v = new THREE.Vector3(rnd(-1, 1) * speed, rnd(0.5, 1.5) * speed, rnd(-1, 1) * speed);
    p.life = rnd(0.4, 0.8);
  }
}
function updateParts(dt) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.v.y -= 18 * dt;
    p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < 0.05) { p.m.position.y = 0.05; p.v.multiplyScalar(0.5); p.v.y = Math.abs(p.v.y) * 0.3; }
    p.m.rotation.x += dt * 8; p.m.rotation.z += dt * 6;
    if (p.life <= 0) p.m.visible = false;
  }
}

// ============================================================ son
let AC = null, lastHit = 0;
function initAudio() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
function tone(type, f0, f1, dur, vol = 0.15, delay = 0) {
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, delay = 0) {
  const t = AC.currentTime + delay, len = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
  s.connect(f).connect(g).connect(AC.destination); s.start(t);
}
function sfx(k) {
  if (!AC || !save.sound) return;
  const now = performance.now();
  if (k === 'hit') { if (now - lastHit < 70) return; lastHit = now; noise(0.07, 0.35, 1800); tone('square', 220, 110, 0.06, 0.04); }
  else if (k === 'kill') { tone('triangle', 330, 720, 0.13, 0.12); noise(0.1, 0.2, 900); }
  else if (k === 'gain') { tone('sine', 880, 880, 0.08, 0.06, 0.05); tone('sine', 1320, 1320, 0.1, 0.05, 0.11); }
  else if (k === 'hurt') tone('square', 160, 80, 0.12, 0.07);
  else if (k === 'slam') { noise(0.35, 0.6, 180); tone('sine', 90, 40, 0.35, 0.3); }
  else if (k === 'boss') [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.1, i * 0.11));
  else if (k === 'ko') tone('sawtooth', 300, 60, 0.6, 0.08);
}

// ============================================================ joueur
const player = {
  r: 0.6, hp: 0, alive: true, deadT: 0, face: 0, swing: 0, timers: [], orbit: [], moveAmt: 0,
};
function buildPlayerModel() {
  const m = humanoid({ skin: 0xf1b98a, shirt: 0xe07a30, pants: 0x4a3328, apron: 0xf3ead6, belt: 0x6a3a1a, hat: 'bandana', hatColor: 0xc0392b, moustache: 0x5a3018, belly: 1.3 });
  m.g.scale.setScalar(1.12);
  P(m.body, 'box', 0xb3262f, [0.18, 0.75, 0.52], [0.12, 0.1, 0.02]); // tache sur le tablier
  scene.add(m.g);
  return m;
}
player.m = buildPlayerModel();
player.obj = player.m.g;
player.pos = player.obj.position;
player.pos.set(BASE.x, 0, BASE.z);
player.hp = ST().hp;
let heldWeapon = null;
function refreshPlayerWeapons() {
  if (heldWeapon) player.m.hand.remove(heldWeapon);
  heldWeapon = weaponModel(WEAPONS[save.equipped[0]]);
  heldWeapon.rotation.x = Math.PI / 2 * 0.95;
  player.m.hand.add(heldWeapon);
  for (const o of player.orbit) scene.remove(o.g);
  player.orbit = save.equipped.slice(1).map((id, i) => { const g = weaponModel(WEAPONS[id]); g.scale.setScalar(1.15); scene.add(g); return { g, id, i, anim: 0, tx: 0, tz: 0 }; });
  player.timers = save.equipped.map((_, i) => player.timers[i] || 0);
}
refreshPlayerWeapons();

const hurtEl = $('#hurt');
let hurtT = 0, shake = 0;
function damagePlayer(amount) {
  if (!player.alive || paused) return;
  player.hp -= amount;
  hurtT = 0.25;
  floatText(player.pos.x, 2.8, player.pos.z, '-' + fmt(amount), '#ff6b6b', 'small');
  sfx('hurt');
  if (player.hp <= 0) {
    player.hp = 0; player.alive = false; player.deadT = 2.6; botLog.deaths++;
    $('#ko').classList.remove('hidden');
    sfx('ko');
    player.obj.rotation.x = -Math.PI / 2;
    player.obj.position.y = 0.4;
  }
}

// ============================================================ ennemis
const enemies = [];
class Enemy {
  constructor(id, zone, x, z) {
    this.id = id; this.T = TYPES[id]; this.zone = zone; this.g = save.tier * 3 + zone;
    this.home = new THREE.Vector3(x, 0, z);
    this.m = buildModel(this.T.model);
    this.obj = this.m.g;
    this.baseScale = this.obj.scale.x;
    this.pos = this.obj.position;
    this.pos.copy(this.home);
    this.obj.rotation.y = Math.random() * Math.PI * 2;
    scene.add(this.obj);
    this.mats = new Set();
    this.obj.traverse((o) => { if (o.material) { this.mats.add(o.material); o.material.userData.e = o.material.emissive.clone(); o.material.userData.ei = o.material.emissiveIntensity; } });
    this.r = this.T.radius;
    this.maxHp = this.T.hp * HPM(this.g);
    this.hp = this.maxHp;
    this.dmg = (this.T.dmg || 0) * DMGM(this.g);
    this.alive = true; this.respawnT = 0; this.dieT = 0; this.atkT = 1; this.atkAnim = 0; this.spawnAnim = 0;
    this.specT = 4; this.spec = null; this.flash = 0; this.flashOn = false; this.aggro = false;
    this.wander = null; this.wanderT = rnd(1, 4); this.t = Math.random() * 10; this.kb = new THREE.Vector3(); this.moving = 0;
    this.hoverY = this.T.model === 'dragon' ? 1.2 : this.T.model === 'imp' ? 0.4 : 0;
    this.makeOverlay();
  }
  makeOverlay() {
    const el = document.createElement('div');
    el.className = 'ov' + (this.T.boss ? ' boss' : '');
    const [k, v] = this.T.reward;
    const amount = SCALED[k] ? v * RWM(this.g) : v;
    el.innerHTML = (this.T.boss ? `<div class="name">${this.T.name}</div>` : '') + `<div class="tag" style="background:${STATS[k].color}">${STATS[k].icon} ${fmtGain(k, amount)}</div><div class="bar"><i></i><b></b></div><div class="ring" style="display:none"><span></span></div>`;
    ovRoot.appendChild(el);
    this.el = el; this.elBar = el.querySelector('.bar i'); this.elNum = el.querySelector('.bar b'); this.elRing = el.querySelector('.ring'); this.elRingT = this.elRing.querySelector('span');
    this.elTag = el.querySelector('.tag'); this.elBarBox = el.querySelector('.bar'); this.elName = el.querySelector('.name');
    this.lastHpTxt = '';
  }
  setFlash(v) {
    const on = v > 0;
    if (!on && !this.flashOn) return;
    this.flashOn = on;
    for (const m of this.mats) {
      if (on) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = v * (this.T.boss ? 1.6 : 3.5); }
      else { m.emissive.copy(m.userData.e); m.emissiveIntensity = m.userData.ei; }
    }
  }
  hit(dmg) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.09;
    this.aggro = true;
    floatText(this.pos.x, this.T.h * 0.75, this.pos.z, fmt(dmg), '#fff', this.T.boss ? '' : 'small');
    burst(this.pos.x, 1, this.pos.z, this.chipColor(), 3, 3, 0.12);
    if (!this.T.boss && !this.T.passive) { _v.set(this.pos.x - player.pos.x, 0, this.pos.z - player.pos.z).normalize().multiplyScalar(3); this.kb.add(_v); }
    sfx('hit');
    if (this.hp <= 0) this.die();
  }
  chipColor() { return { tree: 0x6cc04a, oak: 0x3f8f45, slime: 0x6bdc5a, lavarock: 0xff7a1a, mushroom: 0xd6453a, rabbit: 0xffffff, imp: 0xd8352a, salamander: 0xf08a24, ent: 0x6cc04a, golem: 0x9a9ca4, dragon: 0xff6a00, boar: 0x6e4a33 }[this.T.model] || 0xb3262f; }
  die() {
    this.alive = false; this.hp = 0; this.dieT = 0.35; this.respawnT = this.T.respawn; this.spec && this.endSpecial(); this.aggro = false;
    burst(this.pos.x, 1.2, this.pos.z, this.chipColor(), this.T.boss ? 30 : 12, this.T.boss ? 7 : 5, this.T.boss ? 0.35 : 0.2);
    const [k, v] = this.T.reward;
    const amount = SCALED[k] ? v * RWM(this.g) : v;
    const before = ST()[k];
    ST()[k] = CAPS[k] ? Math.min(CAPS[k], before + amount) : before + amount;
    if (k === 'hp') player.hp += ST().hp - before;
    floatText(this.pos.x, this.T.h + 0.4, this.pos.z, ST()[k] === before ? STATS[k].label + ' MAX' : fmtGain(k, amount), STATS[k].color, 'big');
    pulseStat(k);
    save.kills++;
    sfx('kill'); setTimeout(() => sfx('gain'), 90);
    if (this.T.boss) bossDefeated(this);
    hudDirty = true;
  }
  respawn() {
    this.alive = true; this.hp = this.maxHp; this.pos.copy(this.home); this.obj.visible = true; this.spawnAnim = 0.45; this.atkT = 1; this.specT = 4; this.aggro = false;
    this.obj.rotation.set(0, Math.random() * 6.28, 0);
  }
  update(dt) {
    this.t += dt;
    if (this.flash > 0) { this.flash -= dt; this.setFlash(Math.max(0, this.flash)); }
    if (!this.alive) {
      if (this.dieT > 0) {
        this.dieT -= dt;
        const k = Math.max(0, this.dieT / 0.35);
        this.obj.scale.setScalar(this.baseScale * (0.2 + 0.8 * k));
        this.obj.rotation.z = (1 - k) * 0.6;
        if (this.dieT <= 0) { this.obj.visible = false; this.obj.scale.setScalar(this.baseScale); this.obj.rotation.z = 0; this.setFlash(0); }
      }
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }
    let s = this.baseScale;
    if (this.spawnAnim > 0) { this.spawnAnim -= dt; const k = 1 - this.spawnAnim / 0.45; s *= k < 0.7 ? k / 0.7 * 1.1 : 1.1 - (k - 0.7) / 0.3 * 0.1; }
    this.obj.scale.setScalar(Math.max(0.01, s));

    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    let mvx = 0, mvz = 0, speed = this.T.speed || 0;
    if (this.spec) { this.updateSpecial(dt, dx, dz, dist); }
    else if (this.T.passive) { /* immobile */ }
    else if (this.T.flee) {
      if (player.alive && dist < 5.5) { mvx = -dx / dist; mvz = -dz / dist; }
      else this.doWander(dt, (a, b) => { mvx = a; mvz = b; }), (speed *= 0.35);
      const hd = this.home.distanceTo(this.pos);
      if (hd > 8) { mvx = (this.home.x - this.pos.x) / hd; mvz = (this.home.z - this.pos.z) / hd; }
    } else {
      const hd = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z), leash = this.T.boss ? 24 : 12;
      const chase = player.alive && (dist < this.T.aggro || this.aggro) && hd < leash && dist < leash + 6;
      if (chase) {
        this.aggro = true;
        const reach = this.r + player.r + 0.35;
        if (dist > reach) { mvx = dx / dist; mvz = dz / dist; }
        this.face(dx, dz, dt);
        this.atkT -= dt;
        if (this.atkT <= 0 && dist <= reach + 0.3) { this.atkT = this.T.cd; this.atkAnim = 0.4; damagePlayer(this.dmg); }
        if (this.T.special) { this.specT -= dt; if (this.specT <= 0 && dist < 10) this.startSpecial(dx, dz, dist); }
      } else {
        this.aggro = false;
        if (hd > 0.6) { mvx = (this.home.x - this.pos.x) / hd; mvz = (this.home.z - this.pos.z) / hd; speed *= 1.4; }
        else { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.4 * dt); this.doWander(dt, (a, b) => { mvx = a; mvz = b; }); speed *= 0.35; }
      }
    }
    if (mvx || mvz) { this.pos.x += mvx * speed * dt; this.pos.z += mvz * speed * dt; if (!this.spec) this.face(mvx, mvz, dt); this.moving = Math.min(1, this.moving + dt * 6); }
    else this.moving = Math.max(0, this.moving - dt * 6);
    // recul
    if (this.kb.lengthSq() > 0.001) { this.pos.addScaledVector(this.kb, dt); this.kb.multiplyScalar(Math.pow(0.002, dt)); }
    const Z = ZONES[this.zone];
    this.pos.x = clamp(this.pos.x, -26, 26);
    this.pos.z = clamp(this.pos.z, Z.bot + 1, Z.top - 0.5);
    this.animate(dt);
  }
  face(dx, dz, dt) {
    const target = Math.atan2(dx, dz);
    let d = target - this.obj.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.obj.rotation.y += d * Math.min(1, dt * 10);
  }
  doWander(dt, set) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) { this.wanderT = rnd(2, 5); this.wander = Math.random() < 0.5 ? null : { x: this.home.x + rnd(-2.5, 2.5), z: this.home.z + rnd(-2.5, 2.5) }; }
    if (this.wander) {
      const wx = this.wander.x - this.pos.x, wz = this.wander.z - this.pos.z, d = Math.hypot(wx, wz);
      if (d > 0.3) set(wx / d, wz / d); else this.wander = null;
    }
  }
  animate(dt) {
    const m = this.m, t = this.t;
    let y = this.hoverY + (this.hoverY ? Math.sin(t * 2) * 0.25 : 0);
    if (this.T.model === 'slime' || this.T.model === 'rabbit') {
      const hop = this.moving > 0.1 ? Math.abs(Math.sin(t * 9)) : 0;
      y += hop * 0.35;
      m.body.scale.set(1 + (1 - hop) * 0.06 * this.moving, 1 - (1 - hop) * 0.1 * this.moving + Math.sin(t * 3) * 0.03, 1);
    } else if (this.T.passive) {
      m.body.rotation.z = Math.sin(t * 1.3) * 0.025;
      m.body.scale.y = 1 + Math.sin(t * 2) * 0.015;
    } else {
      y += this.moving * Math.abs(Math.sin(t * 8)) * 0.12;
      m.body.scale.y = 1 + Math.sin(t * 2.5) * 0.02;
    }
    this.pos.y = y;
    // attaque
    if (this.atkAnim > 0) {
      this.atkAnim -= dt;
      const k = 1 - this.atkAnim / 0.4, lunge = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35;
      m.body.position.z = lunge;
      if (m.armR) m.armR.rotation.x = k < 0.4 ? -2.6 * (k / 0.4) : -2.6 + (k - 0.4) / 0.6 * 2.6;
    } else { m.body.position.z = 0; if (m.armR) m.armR.rotation.x = Math.sin(t * 2) * 0.08; }
    if (m.armL) m.armL.rotation.x = -Math.sin(t * 2) * 0.08;
    if (m.wings) { const f = Math.sin(t * 3.2) * 0.45; m.wings[0].rotation.z = f; m.wings[1].rotation.z = -f; }
    if (this.T.model === 'imp') { const wl = m.body.getObjectByName('wingR'), wr = m.body.getObjectByName('wingL'); wl.rotation.z = 0.35 + Math.sin(t * 14) * 0.4; wr.rotation.z = -0.35 - Math.sin(t * 14) * 0.4; }
  }
  // ------- attaques spéciales des boss
  startSpecial(dx, dz, dist) {
    const kinds = this.T.special, kind = kinds[(Math.random() * kinds.length) | 0];
    const d = Math.hypot(dx, dz) || 1;
    const sp = { kind, t: 0, dir: { x: dx / d, z: dz / d } };
    const R = this.r;
    const tmat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.25, depthWrite: false });
    const fmat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35, depthWrite: false });
    const grp = new THREE.Group();
    grp.position.set(this.pos.x, 0.06, this.pos.z);
    let outer, fill;
    if (kind === 'slam') {
      sp.dur = 1.1; sp.R = R + 3.4;
      outer = new THREE.Mesh(new THREE.CircleGeometry(sp.R, 40), tmat);
      fill = new THREE.Mesh(new THREE.CircleGeometry(sp.R, 40), fmat);
    } else if (kind === 'charge') {
      sp.dur = 0.85; sp.L = 12; sp.Wd = R * 2 + 0.6;
      const g1 = new THREE.PlaneGeometry(sp.Wd, sp.L); g1.translate(0, sp.L / 2, 0);
      outer = new THREE.Mesh(g1, tmat); fill = new THREE.Mesh(g1, fmat);
    } else {
      sp.dur = 1.2; sp.R = R + 8; sp.ang = 0.55;
      const g1 = new THREE.CircleGeometry(sp.R, 24, Math.PI / 2 - sp.ang, sp.ang * 2);
      outer = new THREE.Mesh(g1, tmat); fill = new THREE.Mesh(g1, fmat);
    }
    for (const m of [outer, fill]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 2; grp.add(m); }
    grp.rotation.y = Math.atan2(-sp.dir.x, -sp.dir.z);
    sp.grp = grp; sp.fill = fill;
    fill.scale.setScalar(0.01);
    scene.add(grp);
    this.spec = sp;
    this.face(dx, dz, 1);
  }
  updateSpecial(dt, dx, dz, dist) {
    const sp = this.spec;
    sp.t += dt;
    const k = Math.min(1, sp.t / sp.dur);
    if (sp.phase !== 'dash') {
      if (sp.kind === 'charge') sp.fill.scale.set(1, k, 1); else sp.fill.scale.setScalar(Math.max(0.01, k));
      this.m.body.position.y = Math.sin(k * Math.PI) * (sp.kind === 'slam' ? 0.5 : 0.15);
      if (k >= 1) {
        if (sp.kind === 'slam') {
          if (player.alive && dist < sp.R + player.r * 0.5) damagePlayer(this.dmg * 2.2);
          burst(this.pos.x, 0.3, this.pos.z, 0x9a8a70, 22, 7, 0.25); shake = 0.45; sfx('slam');
          this.endSpecial();
        } else if (sp.kind === 'breath') {
          const ang = Math.atan2(dx, dz) - Math.atan2(sp.dir.x, sp.dir.z);
          const da = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
          if (player.alive && dist < sp.R && da < sp.ang + 0.1) damagePlayer(this.dmg * 2.5);
          for (let i = 0; i < 6; i++) { const f = 2 + i * 1.4; burst(this.pos.x + sp.dir.x * f, 0.8, this.pos.z + sp.dir.z * f, i % 2 ? 0xffa030 : 0xff4a10, 5, 3, 0.3); }
          shake = 0.3; sfx('slam');
          this.endSpecial();
        } else { sp.phase = 'dash'; sp.t = 0; sp.hitDone = false; sp.grp.visible = false; }
      }
    } else {
      const sd = sp.L / 0.45;
      this.pos.x += sp.dir.x * sd * dt; this.pos.z += sp.dir.z * sd * dt;
      if (Math.random() < 0.5) burst(this.pos.x, 0.2, this.pos.z, 0x9a8a70, 1, 2, 0.2);
      if (!sp.hitDone && player.alive && Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < this.r + player.r + 0.3) { sp.hitDone = true; damagePlayer(this.dmg * 2); shake = 0.3; }
      if (sp.t >= 0.45) this.endSpecial();
    }
  }
  endSpecial() {
    if (!this.spec) return;
    scene.remove(this.spec.grp);
    this.spec.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.spec = null; this.specT = rnd(4.5, 7); this.m.body.position.y = 0;
  }
}

function spawnAll() {
  const rng = mulberry32(1234 + save.tier);
  ZONES.forEach((Z, zi) => {
    const pts = [];
    const bossPts = Z.bosses.map((b) => ({ x: b[1], z: b[2] }));
    for (const [id, n] of Object.entries(Z.types)) {
      for (let i = 0; i < n; i++) {
        let x, z, tries = 0;
        do {
          x = (rng() - 0.5) * 46; z = Z.z0 - rng() * (Z.z0 - Z.z1); tries++;
        } while (tries < 60 && (Math.abs(x - pathX(z)) < (TYPES[id].passive ? 3.2 : 1.5) || pts.some((p) => Math.hypot(p.x - x, p.z - z) < 3.6) || bossPts.some((p) => Math.hypot(p.x - x, p.z - z) < 7.5) || Math.hypot(x - BASE.x, z - BASE.z) < 9));
        pts.push({ x, z });
        enemies.push(new Enemy(id, zi, x, z));
      }
    }
    for (const [id, x, z] of Z.bosses) enemies.push(new Enemy(id, zi, x, z));
  });
}
spawnAll();

// ============================================================ boss, portes, île suivante
function bossDefeated(e) {
  const id = e.id, first = !save.defeated[id];
  if (first) botLog.events.push(`${Math.round(simTime)}s ${id} atk=${fmt(ST().atk)} hp=${fmt(ST().hp)} reg=${fmt(ST().regen)} dps=${fmt(dps())} morts=${botLog.deaths}`);
  save.defeated[id] = true;
  const wid = e.T.weapon, W = WEAPONS[wid], copies = 1 + save.tier;
  let sub;
  if (!save.weapons[wid]) { save.weapons[wid] = { copies, stars: 0, evo: 1 }; sub = `Nouvelle arme : ${W.name} !`; }
  else { save.weapons[wid].copies += copies; sub = `+${copies} copie${copies > 1 ? 's' : ''} : ${W.name}`; }
  if (SLOT_FROM[id] && save.slots < SLOT_FROM[id]) { save.slots = SLOT_FROM[id]; sub += '<br>Nouvel emplacement d’arme !'; }
  autoEquip();
  if (BOT) save.equipped = Object.keys(save.weapons).sort((a, b) => wMult(b) / WEAPONS[b].cd * (WEAPONS[b].cleave ? 1.5 : 1) - wMult(a) / WEAPONS[a].cd * (WEAPONS[a].cleave ? 1.5 : 1)).slice(0, save.slots);
  let title = e.T.name + ' vaincu !';
  const opened = gates.find((g) => !g.open && gateOpen(g.i));
  if (opened) sub += `<br>🔓 ${ZONES[opened.i + 1].name} débloquée !`;
  if (e.T.final && first) sub += `<br>🌀 Un portail vers l’île ${save.tier + 2} s’est ouvert !`;
  banner(title, sub, 3.6);
  sfx('boss');
  updateGates();
  refreshPlayerWeapons();
  saveGame();
  renderSlots();
}
function autoEquip() {
  const owned = Object.keys(save.weapons).filter((id) => !save.equipped.includes(id)).sort((a, b) => wMult(b) / WEAPONS[b].cd - wMult(a) / WEAPONS[a].cd);
  while (save.equipped.length < save.slots && owned.length) save.equipped.push(owned.shift());
}
function updateGates() {
  for (const g of gates) {
    const open = gateOpen(g.i);
    if (open && !g.open) g.opening = 1;
    g.open = open;
    if (open && !g.opening) g.door.visible = false;
  }
  portal.g.visible = !!save.defeated.dragon;
}
updateGates();
for (const g of gates) { g.opening = 0; g.door.visible = !g.open; }

function nextIsland() {
  save.tier++;
  save.defeated = {};
  saveGame();
  document.body.style.transition = 'opacity .6s';
  document.body.style.opacity = '0';
  setTimeout(() => location.reload(), 650);
}

// ============================================================ entrées
const input = { jx: 0, jy: 0, keys: new Set(), pid: null, ox: 0, oy: 0 };
const joy = $('#joy'), knob = $('#joyKnob');
function joyRest() { joy.style.left = ''; joy.style.top = ''; joy.style.bottom = ''; joy.classList.remove('on'); knob.style.transform = ''; input.jx = input.jy = 0; input.pid = null; }
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (input.pid !== null) return;
  input.pid = e.pointerId; input.ox = e.clientX; input.oy = e.clientY;
  joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; joy.style.bottom = 'auto';
  joy.style.margin = '-65px 0 0 -65px';
  joy.classList.add('on');
});
addEventListener('pointermove', (e) => {
  if (e.pointerId !== input.pid) return;
  let dx = e.clientX - input.ox, dy = e.clientY - input.oy;
  const d = Math.hypot(dx, dy), max = 55;
  if (d > max) { dx *= max / d; dy *= max / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  const k = d < 8 ? 0 : 1;
  input.jx = (dx / max) * k; input.jy = (dy / max) * k;
});
const endPtr = (e) => { if (e.pointerId === input.pid) { joyRest(); joy.style.margin = ''; } };
addEventListener('pointerup', endPtr);
addEventListener('pointercancel', endPtr);
addEventListener('keydown', (e) => { input.keys.add(e.key.toLowerCase()); initAudio(); if (e.key === 'i' || e.key === 'Tab') { e.preventDefault(); toggleInventory(); } });
addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
const BOT = params.has('bot');
const botLog = { deaths: 0, events: [] };
let botTarget = null, botResting = false;
function botMove() {
  if (!player.alive) return { x: 0, y: 0 };
  const s = ST(), p = player.pos;
  if (player.hp < s.hp * 0.35) botResting = true;
  if (player.hp >= s.hp * 0.98) botResting = false;
  if (botResting) { const dx = BASE.x - p.x, dz = BASE.z - p.z, d = Math.hypot(dx, dz); return d < 1 ? { x: 0, y: 0 } : { x: dx / d, y: dz / d }; }
  const zmax = gateOpen(0) ? (gateOpen(1) ? 2 : 1) : 0;
  let best = null, bs = 1e9;
  for (const e of enemies) {
    if (!e.alive || e.zone > zmax) continue;
    let sc = Math.hypot(e.pos.x - p.x, e.pos.z - p.z) - e.zone * 40;
    if (e.T.boss) {
      // y aller seulement si on peut gagner : temps pour le tuer < temps qu'il met à nous tuer
      const tKill = e.hp / dps(), tDie = player.hp / Math.max(0.01, e.dmg / e.T.cd * 1.6 - s.regen);
      if (tKill > tDie * 0.8) continue;
      sc -= 25;
    }
    if (sc < bs) { bs = sc; best = e; }
  }
  if (!best) return { x: 0, y: 0 };
  const dx = best.pos.x - p.x, dz = best.pos.z - p.z, d = Math.hypot(dx, dz);
  if (d < best.r + 1.2) return { x: 0, y: 0 };
  // contourner une porte fermée : passer par l'ouverture
  for (const g of gates) if ((p.z - g.z) * (best.pos.z - g.z) < 0 && Math.abs(p.z - g.z) < 6 && Math.abs(p.x) > 1.5) { const gx = -p.x, gz = g.z - p.z; const l = Math.hypot(gx, gz); return { x: gx / l, y: (gz + Math.sign(gz) * 2) / l }; }
  return { x: dx / d, y: dz / d };
}
function moveInput() {
  if (BOT) return botMove();
  let x = input.jx, y = input.jy;
  const K = input.keys;
  if (K.has('arrowleft') || K.has('q') || K.has('a')) x -= 1;
  if (K.has('arrowright') || K.has('d')) x += 1;
  if (K.has('arrowup') || K.has('z') || K.has('w')) y -= 1;
  if (K.has('arrowdown') || K.has('s')) y += 1;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return { x, y };
}

// ============================================================ HUD
let hudDirty = true, paused = true;
const statsEl = $('#stats');
const STAT_ORDER = ['atk', 'hp', 'regen', 'speed', 'cad'];
statsEl.innerHTML = STAT_ORDER.map((k) => `<div class="chip" id="chip-${k}"><em>${STATS[k].icon}</em><span></span></div>`).join('');
function pulseStat(k) { const c = $('#chip-' + k); c.classList.add('pulse'); setTimeout(() => c.classList.remove('pulse'), 180); }
function renderHud() {
  for (const k of STAT_ORDER) $('#chip-' + k + ' span').textContent = fmtStat(k, ST()[k]);
  $('#island').textContent = 'ÎLE ' + (save.tier + 1);
  const zi = zoneOf(player.pos.z);
  $('#zoneName').textContent = ZONES[zi].name;
  // objectif
  let obj = '';
  const firstClosed = gates.find((g) => !g.open);
  if (firstClosed) obj = 'Battre : ' + ZONES[firstClosed.i].bosses.map((b) => `<span class="${save.defeated[b[0]] ? 'ok' : 'ko'}">${TYPES[b[0]].name} ${save.defeated[b[0]] ? '✓' : '✗'}</span>`).join(' · ');
  else if (!save.defeated.golem || !save.defeated.dragon) obj = 'Battre : ' + ZONES[2].bosses.map((b) => `<span class="${save.defeated[b[0]] ? 'ok' : 'ko'}">${TYPES[b[0]].name} ${save.defeated[b[0]] ? '✓' : '✗'}</span>`).join(' · ');
  else obj = `🌀 Portail ouvert vers l’île ${save.tier + 2}`;
  $('#objective').innerHTML = obj;
  hudDirty = false;
}

// emplacements
const slotsEl = $('#slots');
let pendingEquip = null;
const icons = {};
function renderSlots() {
  let html = '';
  for (let i = 0; i < SLOT_MAX; i++) {
    const id = save.equipped[i];
    if (i >= save.slots) html += `<div class="slot locked" data-i="${i}"><span class="lk">🔒</span></div>`;
    else if (id) { const w = wState(id); html += `<div class="slot filled ${pendingEquip ? 'pick' : ''}" data-i="${i}"><img src="${icons[id]}">${w.stars ? `<span class="star">${'★'.repeat(w.stars)}</span>` : ''}<span class="badge outline">${w.copies}</span><div class="cd" id="cd${i}"></div></div>`; }
    else html += `<div class="slot ${pendingEquip ? 'pick' : ''}" data-i="${i}"></div>`;
  }
  slotsEl.innerHTML = html;
  $('#slotsHint').textContent = pendingEquip ? 'Touche l’emplacement à remplacer' : (document.body.classList.contains('inv') ? 'Touche une arme pour la voir' : '');
}
slotsEl.addEventListener('click', (e) => {
  const s = e.target.closest('.slot');
  if (!s) return;
  const i = +s.dataset.i;
  if (i >= save.slots) {
    const boss = Object.keys(SLOT_FROM).find((b) => SLOT_FROM[b] === i + 1);
    toast(`🔒 Bats ${TYPES[boss].name} pour débloquer cet emplacement`);
    return;
  }
  if (pendingEquip) {
    const old = save.equipped.indexOf(pendingEquip);
    if (old >= 0) save.equipped.splice(old, 1);
    if (i < save.equipped.length) save.equipped[i] = pendingEquip; else save.equipped.push(pendingEquip);
    pendingEquip = null;
    afterEquipChange();
    return;
  }
  const id = save.equipped[i];
  if (id) openWeapon(id);
});
function afterEquipChange() { refreshPlayerWeapons(); renderSlots(); renderInventory(); saveGame(); hudDirty = true; }

// bannière / toast
let bannerT = 0, toastT = 0;
function banner(t, sub, dur = 3) { $('#bannerTitle').textContent = t; $('#bannerSub').innerHTML = sub || ''; const b = $('#banner'); b.classList.add('hidden'); void b.offsetWidth; b.classList.remove('hidden'); bannerT = dur; }
function toast(t, dur = 2.2) { const el = $('#toast'); el.innerHTML = t; el.classList.remove('hidden'); toastT = dur; }

// inventaire
function toggleInventory(force) {
  const inv = $('#inventory');
  const show = force ?? inv.classList.contains('hidden');
  inv.classList.toggle('hidden', !show);
  document.body.classList.toggle('inv', show);
  if (show) renderInventory(); else pendingEquip = null;
  renderSlots();
  updatePause();
}
function updatePause() { paused = !$('#title').classList.contains('hidden') || !$('#inventory').classList.contains('hidden') || !$('#weaponModal').classList.contains('hidden') || !$('#confirm').classList.contains('hidden'); if (paused) joyRest(); }
$('#bagBtn').onclick = () => toggleInventory(true);
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => { const id = b.dataset.close; if (id === 'inventory') toggleInventory(false); else { $('#' + id).classList.add('hidden'); updatePause(); } }));
function renderInventory() {
  const s = ST();
  $('#statGrid').innerHTML = [
    ['big', '⚔️', fmt(dps()), 'DPS'], ['big', '❤️', fmt(s.hp), 'PV'], ['big', '✚', fmt(s.regen), 'RÉGEN/s'],
    ['', '🗡️', fmt(s.atk), 'ATTAQUE'], ['', '👟', fmtStat('speed', s.speed), 'VITESSE'], ['', '⚡', fmtStat('cad', s.cad), 'CADENCE'],
  ].map(([c, i, v, l]) => `<div class="stat ${c}"><em>${i}</em><div>${v}<small>${l}</small></div></div>`).join('');
  $('#weaponGrid').innerHTML = Object.keys(WEAPONS).map((id) => {
    const w = save.weapons[id];
    if (!w) return `<div class="wcard unknown"><img src="${icons[id]}"><span class="q">${TYPES[WEAPONS[id].boss].name}</span></div>`;
    return `<div class="wcard" data-id="${id}"><img src="${icons[id]}">${save.equipped.includes(id) ? '<span class="eq">ÉQUIPÉ</span>' : ''}${w.stars ? `<span class="star">${'★'.repeat(w.stars)}</span>` : ''}<span class="badge outline">${w.copies}</span></div>`;
  }).join('');
  $('#soundBtn').textContent = save.sound ? '🔊 Son : oui' : '🔇 Son : non';
}
$('#weaponGrid').addEventListener('click', (e) => { const c = e.target.closest('.wcard[data-id]'); if (c) openWeapon(c.dataset.id); });
$('#soundBtn').onclick = () => { save.sound = !save.sound; saveGame(); renderInventory(); };
$('#resetBtn').onclick = () => confirmBox('Tout recommencer ?', 'Stats, armes et îles seront remises à zéro.', () => { localStorage.removeItem(SAVE_KEY); location.reload(); });

let modalWeapon = null;
function openWeapon(id) {
  modalWeapon = id;
  const W = WEAPONS[id], w = wState(id), need = wNeed(id);
  $('#wmIcon').src = icons[id];
  $('#wmCopies').textContent = w.copies;
  $('#wmName').innerHTML = W.name + (w.stars ? ` <span style="color:#ffd23f">${'★'.repeat(w.stars)}</span>` : '');
  $('#wmRarity').textContent = W.rarity; $('#wmRarity').style.color = RARITY_COLOR[W.rarity];
  $('#wmType').textContent = W.cleave ? '🌀 ZONE' : '🪓 TRANCHANT';
  const now = ST().atk * wMult(id), next = ST().atk * wMult(id, 1);
  $('#wmDmg').innerHTML = W.boss ? `${fmt(now)} <span class="up">› ${fmt(next)}</span>` : fmt(now);
  $('#wmCd').textContent = cdOf(id).toFixed(2).replace('.', ',') + 's';
  $('#wmRange').textContent = W.range.toFixed(1).replace('.', ',');
  const src = W.boss ? `Bats à nouveau <em>${TYPES[W.boss].name}</em> pour obtenir des copies (+10% de dégâts chacune).` : 'L’arme de départ du boucher, fidèle au poste.';
  $('#wmText').innerHTML = W.boss ? `${src}<br>Avec <em>${need} copies</em>, l’arme peut <em>évoluer</em> : ★ et +25% de dégâts, en gardant le bonus des copies.` : src + '<br>Ses dégâts grandissent avec ton attaque ⚔️.';
  const ev = $('#wmEvolve');
  ev.classList.toggle('hidden', !W.boss);
  ev.innerHTML = `ÉVOLUER <span style="color:${w.copies >= need ? '#8ef07a' : '#ff8a8a'}">${w.copies}/${need}</span>`;
  ev.disabled = w.copies < need;
  const eq = $('#wmEquip'), equipped = save.equipped.includes(id);
  eq.textContent = equipped ? (save.equipped.length > 1 ? 'RETIRER' : 'ÉQUIPÉ') : 'ÉQUIPER';
  eq.disabled = equipped && save.equipped.length <= 1;
  $('#weaponModal').classList.remove('hidden');
  updatePause();
}
$('#wmEvolve').onclick = () => {
  const id = modalWeapon, w = wState(id);
  if (w.copies < wNeed(id)) return;
  w.evo *= (1 + 0.1 * (w.copies - 1)) * 1.25; w.copies = 1; w.stars++;
  sfx('boss');
  saveGame(); openWeapon(id); renderInventory(); renderSlots(); hudDirty = true;
};
$('#wmEquip').onclick = () => {
  const id = modalWeapon;
  const i = save.equipped.indexOf(id);
  $('#weaponModal').classList.add('hidden');
  if (i >= 0) { if (save.equipped.length > 1) save.equipped.splice(i, 1); }
  else if (save.equipped.length < save.slots) save.equipped.push(id);
  else { pendingEquip = id; if ($('#inventory').classList.contains('hidden')) toggleInventory(true); renderSlots(); updatePause(); return; }
  afterEquipChange(); updatePause();
};
let confirmCb = null;
function confirmBox(title, text, cb, yes = 'Oui') {
  $('#cfTitle').textContent = title; $('#cfText').innerHTML = text; $('#cfYes').textContent = yes; confirmCb = cb;
  $('#confirm').classList.remove('hidden'); updatePause();
}
$('#cfNo').onclick = () => { $('#confirm').classList.add('hidden'); confirmCb = null; updatePause(); };
$('#cfYes').onclick = () => { $('#confirm').classList.add('hidden'); const cb = confirmCb; confirmCb = null; updatePause(); cb && cb(); };

// ------------------------------------------------------------ icônes d'armes (rendu 3D → image)
function makeIcons() {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(128, 128); r.setPixelRatio(1);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.4));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 4); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  for (const id of Object.keys(WEAPONS)) {
    const g = weaponModel(WEAPONS[id]);
    g.rotation.set(0, Math.PI / 2, -Math.PI / 4.2);
    const wrap = new THREE.Group(); wrap.add(g); sc.add(wrap);
    const box = new THREE.Box3().setFromObject(wrap), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const d = Math.max(sz.x, sz.y) / (2 * Math.tan((15 * Math.PI) / 180)) * 1.12;
    cam.position.set(c.x, c.y, c.z + d + sz.z); cam.lookAt(c);
    r.render(sc, cam);
    icons[id] = r.domElement.toDataURL();
    sc.remove(wrap);
  }
  r.dispose(); r.forceContextLoss();
}
makeIcons();

// ------------------------------------------------------------ minimap
const mm = $('#minimap'), mctx = mm.getContext('2d');
const MMS = 118, mdpr = Math.min(2, devicePixelRatio);
mm.width = MMS * mdpr; mm.height = MMS * mdpr;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function drawMinimap() {
  const c = mctx, sc = 1.8, cx = MMS / 2, cy = MMS / 2;
  c.setTransform(mdpr, 0, 0, mdpr, 0, 0);
  c.clearRect(0, 0, MMS, MMS);
  c.save();
  c.beginPath(); c.arc(cx, cy, MMS / 2, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#3b5a30'; c.fillRect(0, 0, MMS, MMS);
  const X = (x) => cx + (x - player.pos.x) * sc, Y = (z) => cy + (z - player.pos.z) * sc;
  ZONES.forEach((Z, i) => { c.fillStyle = hex(PAL.ground[i]); c.fillRect(X(-27), Y(Z.top), 54 * sc, (Z.bot - Z.top) * sc); });
  c.strokeStyle = 'rgba(120,100,80,.8)'; c.lineWidth = 4; c.beginPath();
  for (let z = 22; z > WORLD_END; z -= 2) c.lineTo(X(pathX(z)), Y(z));
  c.stroke();
  for (const g of gates) { c.strokeStyle = g.open ? '#9a6a40' : '#b06bff'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(-27), Y(g.z)); c.lineTo(X(27), Y(g.z)); c.stroke(); }
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.T.boss) continue;
    c.fillStyle = e.T.passive || e.T.flee ? 'rgba(255,255,255,.75)' : '#ff6b6b';
    c.fillRect(X(e.pos.x) - 1.5, Y(e.pos.z) - 1.5, 3, 3);
  }
  c.font = '13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const e of enemies) if (e.T.boss) {
    const x = clamp(X(e.pos.x), 8, MMS - 8), y = clamp(Y(e.pos.z), 8, MMS - 8);
    c.globalAlpha = e.alive ? 1 : 0.35; c.fillStyle = '#e3263a'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.fillText('💀', x, y + 1); c.globalAlpha = 1;
  }
  if (portal.g.visible) { c.fillText('🌀', X(PORTAL.x), Y(PORTAL.z)); }
  c.fillText('⛺', X(-8), Y(17));
  c.restore();
  // joueur
  c.save(); c.translate(cx, cy); c.rotate(-player.face + Math.PI);
  c.fillStyle = '#ffd23f'; c.strokeStyle = '#1e1410'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -7); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
$('#zoomBtn').onclick = () => { save.zoom = !save.zoom; saveGame(); };

// ------------------------------------------------------------ étiquettes des portes
for (const g of gates) {
  const el = document.createElement('div');
  el.className = 'gateLbl';
  ovRoot.appendChild(el);
  g.el = el;
}
function renderGateLabels() {
  for (const g of gates) {
    if (g.open) { g.el.style.display = 'none'; continue; }
    const p = toScreen(0, 3.6, g.z);
    if (!p.ok || Math.abs(player.pos.z - g.z) > 30) { g.el.style.display = 'none'; continue; }
    g.el.style.display = '';
    g.el.innerHTML = `<span class="lock">🔒</span>DÉBLOCAGE : ${ZONES[g.i + 1].name}<small>${ZONES[g.i].bosses.map((b) => `${save.defeated[b[0]] ? '✅' : '💀'} ${TYPES[b[0]].name}`).join('<br>')}</small>`;
    place(g.el, p.x, p.y);
  }
}

// ============================================================ boucle
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camZoom = 1, portalCooldown = 0, hudT = 0, mapT = 0, saveT = 0, time = 0;
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = 32;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function updatePlayer(dt) {
  const s = ST();
  if (!player.alive) {
    player.deadT -= dt;
    if (player.deadT <= 0) {
      player.alive = true; player.hp = s.hp;
      player.pos.set(BASE.x, 0, BASE.z); player.obj.rotation.set(0, Math.PI, 0);
      $('#ko').classList.add('hidden');
      for (const e of enemies) { e.aggro = false; e.endSpecial(); }
    }
    return;
  }
  player.hp = Math.min(s.hp, player.hp + s.regen * dt);
  const mv = moveInput();
  const px = player.pos.x, pz = player.pos.z;
  const sp = s.speed;
  let nx = px + mv.x * sp * dt, nz = pz + mv.y * sp * dt;
  player.moveAmt = lerp(player.moveAmt, Math.hypot(mv.x, mv.y), Math.min(1, dt * 10));
  // collisions ennemis
  for (const e of enemies) {
    if (!e.alive || e.dieT > 0) continue;
    const dx = nx - e.pos.x, dz = nz - e.pos.z, d = Math.hypot(dx, dz), min = e.r + player.r;
    if (d < min && d > 0.0001) { nx = e.pos.x + (dx / d) * min; nz = e.pos.z + (dz / d) * min; }
  }
  nx = clamp(nx, -26, 26);
  nz = Math.min(nz, 21);
  for (const g of gates) {
    const wall = !g.open || Math.abs(nx) > 2.2;
    if (wall) { if (pz > g.z) nz = Math.max(nz, g.z + 0.8); else nz = Math.min(nz, g.z - 0.8); }
    else if (Math.abs(nz - g.z) < 0.8) nx = clamp(nx, -2.2, 2.2);
  }
  nz = Math.max(nz, WORLD_END + 2);
  player.pos.x = nx; player.pos.z = nz;

  // attaques
  let nearest = null, nd = 1e9;
  for (const e of enemies) { if (!e.alive) continue; const d = Math.hypot(e.pos.x - nx, e.pos.z - nz) - e.r; if (d < nd) { nd = d; nearest = e; } }
  save.equipped.forEach((id, i) => {
    const W = WEAPONS[id];
    player.timers[i] = (player.timers[i] || 0) - dt;
    if (player.timers[i] > 0) return;
    let best = null, bd = 1e9; const list = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - nx, e.pos.z - nz) - e.r;
      if (d <= W.range) { list.push(e); if (d < bd) { bd = d; best = e; } }
    }
    if (!best) { player.timers[i] = 0; return; }
    player.timers[i] = cdOf(id);
    const dmg = s.atk * wMult(id);
    if (i === 0) player.swing = 0.32;
    else { const o = player.orbit[i - 1]; if (o) { o.anim = 0.3; o.tx = best.pos.x; o.tz = best.pos.z; } }
    (W.cleave ? list : [best]).forEach((e) => e.hit(dmg));
  });
  // orientation
  let fx = mv.x, fz = mv.y;
  if (nearest && nd < 2.6) { fx = nearest.pos.x - nx; fz = nearest.pos.z - nz; }
  if (fx || fz) { const target = Math.atan2(fx, fz); let d = target - player.face; d = Math.atan2(Math.sin(d), Math.cos(d)); player.face += d * Math.min(1, dt * 14); }
  player.obj.rotation.set(0, player.face, 0);
  // animation
  const m = player.m;
  const bob = player.moveAmt * Math.abs(Math.sin(time * 9)) * 0.13;
  player.pos.y = bob;
  m.body.rotation.x = player.moveAmt * 0.1;
  if (player.swing > 0) {
    player.swing -= dt;
    const k = 1 - player.swing / 0.32;
    m.armR.rotation.x = k < 0.35 ? -0.3 - 2.4 * (k / 0.35) : k < 0.6 ? -2.7 + 2.2 * ((k - 0.35) / 0.25) : -0.5 + 0.2 * ((k - 0.6) / 0.4);
    m.body.rotation.y = k < 0.35 ? -0.25 * (k / 0.35) : -0.25 + 0.4 * Math.min(1, (k - 0.35) / 0.25);
  } else {
    m.armR.rotation.x = lerp(m.armR.rotation.x, -0.3 + Math.sin(time * 9) * 0.35 * player.moveAmt, Math.min(1, dt * 10));
    m.body.rotation.y = lerp(m.body.rotation.y, 0, dt * 10);
  }
  m.armL.rotation.x = -Math.sin(time * 9) * 0.45 * player.moveAmt;
  // armes en orbite
  const n = player.orbit.length;
  player.orbit.forEach((o, i) => {
    const a = time * 1.6 + (i / Math.max(1, n)) * Math.PI * 2;
    const hx = nx + Math.cos(a) * 1.5, hz = nz + Math.sin(a) * 1.5, hy = 1.6 + Math.sin(time * 3 + i) * 0.15;
    if (o.anim > 0) {
      o.anim -= dt;
      const k = 1 - o.anim / 0.3, t = Math.sin(k * Math.PI);
      o.g.position.set(lerp(hx, o.tx, t), lerp(hy, 1.1, t), lerp(hz, o.tz, t));
      o.g.rotation.set(Math.PI / 2, 0, k * Math.PI * 2);
    } else {
      o.g.position.set(hx, hy, hz);
      o.g.rotation.set(0.4, -a, 0.3);
    }
  });
  // portail
  portalCooldown -= dt;
  if (portal.g.visible && portalCooldown <= 0 && Math.hypot(nx - PORTAL.x, nz - PORTAL.z) < 1.8) {
    portalCooldown = 4;
    confirmBox(`Partir vers l’île ${save.tier + 2} ?`, `Tu gardes tes stats et tes armes.<br>Les ennemis seront <em>bien plus forts</em>, mais leurs bonus aussi plus gros, et chaque boss donnera <em>${save.tier + 2} copies</em> de son arme.<br>Les portes se referment : il faudra rebattre les boss.`, nextIsland, 'Partir !');
  }
}

function separateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (!a.alive || a.T.passive) continue;
    for (let j = 0; j < enemies.length; j++) {
      if (i === j) continue;
      const b = enemies[j];
      if (!b.alive) continue;
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, min = a.r + b.r;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 0.001) { const push = (min - d) * (b.T.passive || b.T.boss ? 1 : 0.5); a.pos.x += (dx / d) * push; a.pos.z += (dz / d) * push; }
    }
  }
}

function updateOverlays() {
  const pp = player.pos;
  for (const e of enemies) {
    const dist = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
    const vis = dist < (e.T.boss ? 30 : 20);
    if (!vis) { if (e.elShown !== false) { e.el.style.display = 'none'; e.elShown = false; } continue; }
    if (e.alive || e.dieT > 0) {
      const p = toScreen(e.pos.x, e.pos.y + e.T.h * (e.obj.scale.x / e.baseScale), e.pos.z);
      if (!p.ok) { e.el.style.display = 'none'; e.elShown = false; continue; }
      if (e.elShown !== 'alive') { e.el.style.display = ''; e.elRing.style.display = 'none'; e.elBarBox.style.display = ''; e.elTag.style.display = ''; if (e.elName) e.elName.style.display = ''; e.elShown = 'alive'; }
      const txt = fmt(Math.max(0, e.hp));
      if (txt !== e.lastHpTxt) { e.elNum.textContent = txt; e.elBar.style.width = (100 * Math.max(0, e.hp) / e.maxHp).toFixed(1) + '%'; e.lastHpTxt = txt; }
      place(e.el, p.x, p.y);
    } else {
      const p = toScreen(e.home.x, 0.5, e.home.z);
      if (!p.ok) { e.el.style.display = 'none'; e.elShown = false; continue; }
      if (e.elShown !== 'dead') { e.el.style.display = ''; e.elRing.style.display = ''; e.elBarBox.style.display = 'none'; e.elTag.style.display = 'none'; if (e.elName) e.elName.style.display = 'none'; e.elShown = 'dead'; e.lastHpTxt = ''; }
      const r = Math.max(0, e.respawnT);
      e.elRing.style.setProperty('--p', (100 * (1 - r / e.T.respawn)).toFixed(1) + '%');
      e.elRingT.textContent = r >= 60 ? Math.floor(r / 60) + 'm' + String(Math.floor(r % 60)).padStart(2, '0') : Math.ceil(r) + 's';
      place(e.el, p.x, p.y + 27);
    }
  }
  // barre du joueur
  const p = toScreen(pp.x, pp.y + 2.75, pp.z);
  playerBar.style.display = player.alive ? '' : 'none';
  const txt = fmt(player.hp);
  if (txt !== playerBar._t) { playerBar._t = txt; playerBarNum.textContent = txt; }
  playerBarFill.style.width = (100 * player.hp / ST().hp).toFixed(1) + '%';
  place(playerBar, p.x, p.y);
}
const playerBar = document.createElement('div');
playerBar.className = 'ov';
playerBar.innerHTML = '<div class="bar green"><i></i><b></b></div>';
ovRoot.appendChild(playerBar);
const playerBarFill = playerBar.querySelector('i'), playerBarNum = playerBar.querySelector('b');

const CAM_DIR = new THREE.Vector3(0, Math.sin(1.0), Math.cos(1.0));
function camDistance() {
  const t = Math.tan((camera.fov * Math.PI) / 360), aspect = W / H;
  // on cale la largeur visible (portrait) ou la hauteur (paysage)
  return aspect < 1 ? 19 / (2 * t * aspect) : 22 / (2 * t);
}
function updateCamera(dt) {
  let bossNear = false;
  for (const e of enemies) if (e.T.boss && e.alive && e.aggro && Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 16) bossNear = true;
  const target = (save.zoom ? 0.75 : 1) * (bossNear ? 1.2 : 1);
  camZoom = lerp(camZoom, target, Math.min(1, dt * 2));
  const d = camDistance() * camZoom;
  camLook.set(player.pos.x, 0, player.pos.z - 2);
  camPos.copy(camLook).addScaledVector(CAM_DIR, d);
  if (shake > 0) { shake -= dt; camPos.x += rnd(-1, 1) * shake * 0.6; camPos.y += rnd(-1, 1) * shake * 0.6; }
  camera.position.lerp(camPos, Math.min(1, dt * 8));
  if (camera.position.distanceTo(camPos) > 20) camera.position.copy(camPos);
  _v.copy(camera.position).addScaledVector(CAM_DIR, -d);
  camera.lookAt(_v);
  scene.fog.near = d + 8; scene.fog.far = d + 70;
  sun.position.set(player.pos.x - 10, 30, player.pos.z + 8);
  sun.target.position.set(player.pos.x, 0, player.pos.z - 6);
}

function simStep(dt) {
  simTime += dt;
  updatePlayer(dt);
  for (const e of enemies) e.update(dt);
  separateEnemies();
  updateParts(dt);
  updateTexts(dt);
  saveT += dt;
  if (saveT > 5) { saveT = 0; saveGame(); }
}
let last = performance.now(), simTime = 0;
const FAST = +(params.get('fast') || 1);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  time += dt;
  if (!paused) for (let k = 0; k < FAST; k++) simStep(dt);
  // portes qui s'ouvrent
  for (const g of gates) if (g.opening > 0) { g.opening -= dt * 0.6; g.door.position.y = -(1 - Math.max(0, g.opening)) * 3; g.door.visible = g.opening > 0; }
  for (const g of gates) if (!g.open) { g.ring.rotation.z += dt; g.ring.material.opacity = 0.6 + Math.sin(time * 3) * 0.25; }
  if (portal.g.visible) { portal.swirl.rotation.z -= dt * 3; portal.ring.rotation.z += dt * 0.5; }
  for (const f of campFire) f.scale.y = (f === campFire[0] ? 0.8 : 0.55) * (1 + Math.sin(time * 12 + f.id) * 0.12);
  lavaPools.forEach((l, i) => l.material.color.setHSL(0.06 + Math.sin(time * 2 + i) * 0.015, 1, 0.55));
  updateCamera(dt);
  renderer.render(scene, camera);
  updateOverlays();
  renderGateLabels();
  if (hurtT > 0) { hurtT -= dt; hurtEl.style.opacity = 1; } else hurtEl.style.opacity = player.alive && player.hp < ST().hp * 0.3 ? 0.4 : 0;
  hudT -= dt;
  if (hudDirty || hudT <= 0) { renderHud(); hudT = 0.5; }
  mapT -= dt;
  if (mapT <= 0) { drawMinimap(); mapT = 0.1; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('#banner').classList.add('hidden'); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.add('hidden'); }
  // recharge des emplacements
  save.equipped.forEach((id, i) => { const el = document.getElementById('cd' + i); if (el) el.style.height = (100 * clamp((player.timers[i] || 0) / cdOf(id), 0, 1)).toFixed(0) + '%'; });
}

// ============================================================ démarrage
renderSlots();
$('#playBtn').textContent = save.started ? 'CONTINUER' : 'JOUER';
$('#playBtn').onclick = () => {
  initAudio();
  save.started = true; saveGame();
  $('#title').classList.add('hidden');
  updatePause();
  if (save.tier > 0 && !save.defeated.chef) banner(`Île ${save.tier + 1}`, 'Les ennemis sont plus forts… et rapportent plus !', 3);
};
if (TEST) {
  $('#title').classList.add('hidden');
  const tp = { boss: [-14, -15], z2: [0, -55], z3: [0, -150], end: [0, -165] }[TEST];
  if (tp) player.pos.set(tp[0], 0, tp[1]);
  if (TEST === 'inv') toggleInventory(true);
  if (TEST === 'weapon') openWeapon('hachoir');
  updatePause();
}
player.obj.rotation.y = Math.PI;
player.face = Math.PI;
if (params.has('sim')) {
  // simulation sans rendu pour l'équilibrage : ?test=fresh&bot&sim=3600&dbg
  const limit = +params.get('sim');
  const run = () => { for (let i = 0; i < 3000 && simTime < limit; i++) { time += 1 / 30; simStep(1 / 30); } if (simTime < limit && !save.defeated.dragon) setTimeout(run, 0); else document.body.dataset.done = '1'; };
  run();
} else requestAnimationFrame(frame);
if (params.has('dbg')) setInterval(() => { document.body.dataset.dbg = JSON.stringify({ t: Math.round(simTime), deaths: botLog.deaths, kills: save.kills, atk: fmt(ST().atk), hp: fmt(ST().hp), reg: fmt(ST().regen), spd: ST().speed.toFixed(2), cad: ST().cad.toFixed(2), slots: save.slots, eq: save.equipped, ev: botLog.events }); }, 500);
