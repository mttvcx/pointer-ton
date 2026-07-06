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

type TierArt = {
  bg: [string, string, string];
  metal: string;
  word: string;
  tag: string;
  chips: [string, string, string];
  callout?: string;
};

const ART: Record<PackType, TierArt> = {
  bronze: { bg: ['#f2c88f', '#c8873f', '#3a220e'], metal: '#c8873f', word: 'BRONZE', tag: 'EARLY WALLETS', chips: ['First Buy', 'Discovery', 'Low MC'] },
  silver: { bg: ['#e2edfb', '#8ea9cf', '#1e2f47'], metal: '#b3c4da', word: 'SILVER', tag: 'CLUSTER TRACE', chips: ['Smart Money', 'Rotation', 'Alpha'], callout: 'FLOW LOCK' },
  gold: { bg: ['#ffe9a8', '#f0b429', '#5f4408'], metal: '#f0b429', word: 'GOLD', tag: 'HIGH CONVICTION', chips: ['Whale Entry', 'Conviction', 'Momentum'], callout: '+2,840 SOL' },
  legendary: { bg: ['#ecdcff', '#a05cf5', '#2c114f'], metal: '#a75cf5', word: 'LEGENDARY', tag: 'RARE ACCESS', chips: ['Syndicate', 'Alpha Access', 'Elite Desk'], callout: '+12,400 SOL' },
};

const BIRD_PATH = 'M32 352 L280 88 L240 240 L480 160 L200 280 L300 424 Z';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildArtTexture(type: PackType): THREE.CanvasTexture {
  const W = 768;
  const H = 1088;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const art = ART[type];

  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, art.bg[0]);
  g.addColorStop(0.42, art.bg[1]);
  g.addColorStop(1, art.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rg = ctx.createRadialGradient(W / 2, H * 1.05, 40, W / 2, H * 1.05, H * 0.8);
  rg.addColorStop(0, 'rgba(255,255,255,0.30)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 26px ui-sans-serif, system-ui, sans-serif';
  try { ctx.letterSpacing = '14px'; } catch { /* older canvas */ }
  ctx.fillText('POINTER', W / 2 + 7, 96);
  try { ctx.letterSpacing = '0px'; } catch { /* noop */ }

  // Pointer swift mark
  ctx.save();
  ctx.translate(W / 2 - 148, 150);
  ctx.scale(0.56, 0.56);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  ctx.fill(new Path2D(BIRD_PATH));
  ctx.restore();

  // big tier wordmark
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `800 ${art.word.length > 8 ? 92 : 128}px "Arial Narrow", ui-sans-serif, sans-serif`;
  ctx.fillText(art.word, W / 2, 560);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '700 30px ui-sans-serif, system-ui, sans-serif';
  try { ctx.letterSpacing = '6px'; } catch { /* noop */ }
  ctx.fillText(art.tag, W / 2 + 3, 622);
  try { ctx.letterSpacing = '0px'; } catch { /* noop */ }

  // chips
  ctx.font = '700 24px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  const rows: Array<[string, number, number]> = [
    [art.chips[0], 46, 232],
    [art.chips[2], 46, H - 250],
  ];
  const w1 = ctx.measureText(art.chips[1]).width;
  rows.push([art.chips[1], W - 46 - w1 - 36, 276]);
  for (const [text, x, y] of rows) {
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    roundRect(ctx, x - 18, y - 32, tw + 36, 48, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(text, x, y);
  }

  if (art.callout) {
    ctx.textAlign = 'center';
    ctx.font = '800 56px "Arial Narrow", ui-sans-serif, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(art.callout, W / 2, H - 150);
    ctx.shadowBlur = 0;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildCrumpleBump(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 240; i++) {
    const px = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * S;
    const py = Math.abs((Math.sin(i * 78.233) * 43758.5453) % 1) * S;
    const r = 18 + Math.abs(Math.sin(i * 3.1)) * 72;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, i % 2 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
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
    const artTex = buildArtTexture(type);

    const pack = new THREE.Group();
    scene.add(pack);

    // pouch body
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(2.1, 3.05, 0.26, 6, 0.12),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(art.metal),
        metalness: 0.95,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.22,
        iridescence: 1,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [120, 800],
        bumpMap: bump,
        bumpScale: 0.05,
        envMapIntensity: 1.4,
      }),
    );
    pack.add(body);

    // crimped seals
    const crimpMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(art.metal), metalness: 1, roughness: 0.5, bumpMap: bump, bumpScale: 0.08, envMapIntensity: 0.9 });
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
