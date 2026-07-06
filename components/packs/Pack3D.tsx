'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PackType } from '@/types/pack';

/**
 * Real 3D foil pack — vanilla three.js (R3F doesn't initialize under Next's
 * turbopack dev, but raw WebGL renders fine). A rounded pouch mesh with a
 * physical foil material (metalness + clearcoat + iridescence + a procedural
 * crumple bump), lit by a PMREM'd RoomEnvironment for reflections. The printed
 * artwork is drawn to a canvas texture on the front face. Tilts to the pointer
 * with a gentle idle float. Lazy-loaded; /packs only.
 */

const ART: Record<PackType, { bg: [string, string, string]; metal: string; word: string }> = {
  bronze: { bg: ['#f2c88f', '#c8873f', '#3a220e'], metal: '#c8873f', word: 'BRONZE' },
  silver: { bg: ['#e2edfb', '#8ea9cf', '#1e2f47'], metal: '#b3c4da', word: 'SILVER' },
  gold: { bg: ['#ffe9a8', '#f0b429', '#5f4408'], metal: '#f0b429', word: 'GOLD' },
  legendary: { bg: ['#ecdcff', '#a05cf5', '#2c114f'], metal: '#a75cf5', word: 'LEGENDARY' },
};

const ART_W = 768;
const ART_H = 1088;
const LOGO_SRC = '/branding/pointer-bird-transparent.png';
/** Iconic / meme stickers scattered on the wrapper (real assets in public/). */
const STICKER_SRC = ['/packs/troll.jpg', '/pulse-glyphs/crown.png', '/pulse-glyphs/chart.png', '/icons/pumpfun.webp', '/pulse-glyphs/cashback.png'];
/** Scatter layout — [srcIndex, x, y, size, rotationDeg]. Avoids the centre logo + wordmark. */
const STICKER_LAYOUT: Array<[number, number, number, number, number]> = [
  [0, 150, 200, 150, -14],
  [1, 630, 210, 130, 12],
  [2, 120, 560, 120, -8],
  [3, 650, 560, 120, 10],
  [0, 200, 300, 96, 18],
  [4, 560, 330, 96, -16],
];

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawArtBase(ctx: CanvasRenderingContext2D, type: PackType) {
  const art = ART[type];
  const g = ctx.createLinearGradient(0, 0, ART_W * 0.4, ART_H);
  g.addColorStop(0, art.bg[0]);
  g.addColorStop(0.42, art.bg[1]);
  g.addColorStop(1, art.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ART_W, ART_H);

  const rg = ctx.createRadialGradient(ART_W / 2, ART_H * 1.05, 40, ART_W / 2, ART_H * 1.05, ART_H * 0.8);
  rg.addColorStop(0, 'rgba(255,255,255,0.28)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, ART_W, ART_H);
}

function drawTierWord(ctx: CanvasRenderingContext2D, type: PackType) {
  const art = ART[type];
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.font = `800 ${art.word.length > 8 ? 96 : 132}px "Arial Narrow", ui-sans-serif, sans-serif`;
  ctx.fillText(art.word, ART_W / 2, ART_H - 150);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Sticker as a soft rounded badge with a hairline ring. */
function drawSticker(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, rotDeg: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.stroke();
  ctx.restore();
}

/** Draw the composed front: stickers → logo → tier word. Async because it pulls real images. */
async function composeArt(ctx: CanvasRenderingContext2D, type: PackType): Promise<void> {
  drawArtBase(ctx, type);
  const [logo, ...stickers] = await Promise.all([loadImg(LOGO_SRC), ...STICKER_SRC.map(loadImg)]);

  for (const [srcIdx, x, y, size, rot] of STICKER_LAYOUT) {
    const s = stickers[srcIdx];
    if (s) drawSticker(ctx, s, x, y, size, rot);
  }

  if (logo) {
    const lw = 320;
    const lh = lw * (logo.height / logo.width || 1);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(logo, ART_W / 2 - lw / 2, 300, lw, lh);
    ctx.restore();
  }

  drawTierWord(ctx, type);
}

function buildArtTexture(type: PackType): { tex: THREE.CanvasTexture; refresh: () => Promise<void> } {
  const c = document.createElement('canvas');
  c.width = ART_W;
  c.height = ART_H;
  const ctx = c.getContext('2d')!;
  drawArtBase(ctx, type);
  drawTierWord(ctx, type);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const refresh = async () => {
    await composeArt(ctx, type);
    tex.needsUpdate = true;
  };
  return { tex, refresh };
}

function buildCrumpleBump(): THREE.CanvasTexture {
  const S = 640;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const rnd = (seed: number) => Math.abs((Math.sin(seed * 12.9898) * 43758.5453) % 1);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);

  // dense wrinkle blobs — high contrast so the foil reads as crushed
  for (let i = 0; i < 420; i++) {
    const px = rnd(i + 1) * S;
    const py = rnd(i * 1.7 + 3) * S;
    const r = 10 + rnd(i * 3.1) * 58;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, i % 2 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // long foil creases — sharp light/dark lines like a scrunched wrapper
  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const x0 = rnd(i * 5 + 11) * S;
    const y0 = rnd(i * 7 + 13) * S;
    const ang = rnd(i * 2 + 17) * Math.PI * 2;
    const len = 60 + rnd(i * 4) * 240;
    const light = i % 2 === 0;
    ctx.strokeStyle = light ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 1 + rnd(i * 9) * 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    // a slightly kinked crease
    const mx = x0 + Math.cos(ang) * len * 0.5 + (rnd(i * 6) - 0.5) * 40;
    const my = y0 + Math.sin(ang) * len * 0.5 + (rnd(i * 8) - 0.5) * 40;
    ctx.quadraticCurveTo(mx, my, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 2.2);
  return tex;
}

export function Pack3D({ type, className }: { type: PackType; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const art = ART[type];
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.9));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 5.4);

    // reflections from a procedural room (no external HDRI)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd0ff, 0.6);
    rim.position.set(-4, 1, -2);
    scene.add(rim);

    const bump = buildCrumpleBump();
    const { tex: artTex, refresh: refreshArt } = buildArtTexture(type);
    void refreshArt(); // pull in the real logo + meme stickers, then repaint

    const pack = new THREE.Group();
    scene.add(pack);

    // pouch body
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(2.1, 3.05, 0.26, 6, 0.12),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(art.metal),
        metalness: 0.95,
        roughness: 0.26,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        iridescence: 1,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [120, 800],
        bumpMap: bump,
        bumpScale: 0.14,
        envMapIntensity: 1.55,
      }),
    );
    pack.add(body);

    // crimped seals
    const crimpMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(art.metal), metalness: 1, roughness: 0.55, bumpMap: bump, bumpScale: 0.16, envMapIntensity: 0.9 });
    for (const y of [1.44, -1.44]) {
      const crimp = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.17, 0.3), crimpMat);
      crimp.position.set(0, y, 0);
      pack.add(crimp);
    }

    // printed artwork on the front
    const artMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.98, 2.78),
      new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.44, metalness: 0.22, transparent: true }),
    );
    artMesh.position.set(0, 0, 0.132);
    pack.add(artMesh);

    // additive holo sheen over the art
    const sheen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.98, 2.78),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.08, metalness: 0.6, iridescence: 1, iridescenceIOR: 1.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sheen.position.set(0, 0, 0.138);
    pack.add(sheen);

    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;
    const tick = () => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const targetY = pointer.x * 0.5 + Math.sin(t * 0.5) * 0.08;
      const targetX = -pointer.y * 0.42 + Math.sin(t * 0.7) * 0.05;
      pack.rotation.y += (targetY - pack.rotation.y) * 0.09;
      pack.rotation.x += (targetX - pack.rotation.x) * 0.09;
      pack.position.y = Math.sin(t * 0.9) * 0.05;
      renderer.render(scene, camera);
    };
    tick();

    // pause when offscreen (perf: many packs on the shelf)
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? true;
        if (visible && !running) {
          running = true;
          tick();
        } else if (!visible) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.05 },
    );
    io.observe(host);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      bump.dispose();
      artTex.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [type]);

  return <div ref={hostRef} className={className} style={{ width: '100%', height: '100%', touchAction: 'none' }} />;
}

export default Pack3D;
