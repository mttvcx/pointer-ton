'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PackType } from '@/types/pack';
import { packFrontImage } from '@/lib/packs/packRenderArt';

/**
 * Real 3D foil booster pack — vanilla three.js (R3F won't init under Next's
 * turbopack dev, but raw WebGL renders fine). A crimped foil-packet silhouette
 * (serrated seal top & bottom) with a physical foil material (metalness +
 * clearcoat + iridescence + procedural crumple), lit by a PMREM'd RoomEnvironment
 * for real reflections. The printed front is a game-title wordmark + a token
 * "cast" lineup drawn to a canvas texture. Tilts to the pointer + idle sway.
 */

type Tier = { bg: [string, string, string]; glow: string; metal: string; word: string; cast: string[] };

const LOGO_SRC = '/branding/pointer-bird-transparent.png';

const TIERS: Record<PackType, Tier> = {
  bronze: {
    bg: ['#5a3a1a', '#3a2410', '#160c04'],
    glow: '#f0a860',
    metal: '#c8873f',
    word: 'BRONZE',
    cast: ['/packs/troll.jpg', '/logos/protocols/pumpfun.png', '/logos/protocols/bonk.png'],
  },
  silver: {
    bg: ['#3a4a63', '#232f42', '#0d1420'],
    glow: '#9fc0ff',
    metal: '#b7c6da',
    word: 'SILVER',
    cast: ['/logos/protocols/jupiter.png', '/logos/protocols/raydium.png', '/logos/protocols/meteora.png'],
  },
  gold: {
    bg: ['#6a4f12', '#3f2f08', '#1a1304'],
    glow: '#ffd76a',
    metal: '#f0b429',
    word: 'GOLD',
    cast: ['/logos/protocols/moonshot.png', '/logos/protocols/virtuals.png', '/logos/protocols/bags.png'],
  },
  diamond: {
    bg: ['#1c4a55', '#0f2f38', '#06171d'],
    glow: '#8ff0ff',
    metal: '#a5f3fc',
    word: 'DIAMOND',
    cast: ['/logos/protocols/jupiter.png', '/logos/protocols/hyperliquid.png', '/logos/protocols/raydium.png'],
  },
  legendary: {
    bg: ['#3a1f5e', '#25123f', '#100621'],
    glow: '#c98cff',
    metal: '#a75cf5',
    word: 'LEGENDARY',
    cast: ['/pulse-glyphs/crown.png', '/pulse-glyphs/trophy.png', '/logos/protocols/uniswap.png'],
  },
};

const ART_W = 760;
const ART_H = 1080;

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Fit text to a max width by shrinking the font. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, start: number, maxW: number): number {
  let size = start;
  do {
    ctx.font = `800 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 4;
  } while (size > 24);
  return size;
}

function drawBase(ctx: CanvasRenderingContext2D, t: Tier) {
  // deep tier gradient
  const g = ctx.createLinearGradient(0, 0, 0, ART_H);
  g.addColorStop(0, t.bg[0]);
  g.addColorStop(0.55, t.bg[1]);
  g.addColorStop(1, t.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ART_W, ART_H);

  // hero spotlight behind the title
  const spot = ctx.createRadialGradient(ART_W / 2, 380, 30, ART_W / 2, 380, 520);
  spot.addColorStop(0, t.glow.startsWith('#') && t.glow.length >= 7 ? `${t.glow}66` : 'rgba(255,255,255,0.32)');
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, ART_W, ART_H);

  // faint radial rays
  ctx.save();
  ctx.translate(ART_W / 2, 380);
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-60, -900);
    ctx.lineTo(60, -900);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, t: Tier) {
  ctx.textAlign = 'center';
  const family = '"Arial Narrow", "Helvetica Neue", ui-sans-serif, sans-serif';
  const cx = ART_W / 2;
  const cy = 430;
  const size = fitFont(ctx, t.word, family, 172, ART_W - 60);
  ctx.font = `800 ${size}px ${family}`;

  // contrast wash so the title reads over the crumpled foil
  const panel = ctx.createRadialGradient(cx, cy - size * 0.28, 10, cx, cy - size * 0.28, ART_W * 0.55);
  panel.addColorStop(0, 'rgba(0,0,0,0.42)');
  panel.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = panel;
  ctx.fillRect(0, cy - size * 1.15, ART_W, size * 1.8);

  // heavy dark outline (game-logo look)
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(14, size * 0.13);
  ctx.strokeStyle = 'rgba(0,0,0,0.68)';
  ctx.strokeText(t.word, cx, cy);
  // metallic fill
  const fill = ctx.createLinearGradient(0, cy - size, 0, cy + size * 0.2);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.5, '#eef2ff');
  fill.addColorStop(0.53, '#c4cfe8');
  fill.addColorStop(1, '#ffffff');
  ctx.fillStyle = fill;
  ctx.fillText(t.word, cx, cy);

  // PACK subtitle plate
  ctx.font = `800 46px ${family}`;
  const sub = 'PACK';
  const subW = ctx.measureText(sub).width + 48;
  const px = cx - subW / 2;
  const py = cy + 40;
  ctx.fillStyle = t.metal;
  ctx.beginPath();
  ctx.roundRect(px, py, subW, 60, 12);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillText(sub, cx, py + 46);
}

/** Token "cast" lined up along the bottom, standing on a soft ground, like characters. */
function drawCast(ctx: CanvasRenderingContext2D, imgs: (HTMLImageElement | null)[]) {
  const groundY = 980;
  const n = imgs.length;
  const gap = ART_W / (n + 0.4);
  imgs.forEach((img, i) => {
    if (!img) return;
    const size = 236 - (i === 1 ? 0 : 34); // centre one bigger
    const x = gap * (i + 0.7);
    const y = groundY - size;
    // ground shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, groundY + 6, size * 0.42, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.restore();
    // token in a soft ring
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(x, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x - size / 2, y, size, size);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    ctx.restore();
  });
}

/** Draw a pre-rendered pack-front panel full-height, centred, on a dark canvas. */
function drawFront(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, ART_W, ART_H);
  const scale = ART_H / img.height;
  const w = img.width * scale;
  ctx.drawImage(img, (ART_W - w) / 2, 0, w, ART_H);
}

function buildArt(type: PackType): { tex: THREE.CanvasTexture; refresh: () => Promise<void> } {
  const t = TIERS[type];
  const front = packFrontImage(type);
  const c = document.createElement('canvas');
  c.width = ART_W;
  c.height = ART_H;
  const ctx = c.getContext('2d')!;
  drawBase(ctx, t);
  drawTitle(ctx, t);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const refresh = async () => {
    // Premium path: the real rendered pack front (title + pointer. + hero baked in).
    if (front) {
      const img = await loadImg(front);
      if (img) {
        drawFront(ctx, img);
        tex.needsUpdate = true;
        return;
      }
    }
    // Fallback: procedural canvas front.
    const [logo, ...cast] = await Promise.all([loadImg(LOGO_SRC), ...t.cast.map(loadImg)]);
    drawBase(ctx, t);
    // Pointer mark top-centre
    if (logo) {
      const lw = 150;
      const lh = lw * (logo.height / logo.width || 1);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(logo, ART_W / 2 - lw / 2, 120, lw, lh);
      ctx.restore();
    }
    drawTitle(ctx, t);
    drawCast(ctx, cast);
    tex.needsUpdate = true;
  };
  return { tex, refresh };
}

/**
 * Crumpled-paper heightmap: a Voronoi facet field. Each cell is a flat panel
 * (its own tone) and cell boundaries are sharp creases — a dark valley with a
 * bright ridge beside it, exactly how crushed paper/foil catches light. Used as
 * bump + displacement so the surface physically facets.
 */
function buildCrumple(): THREE.CanvasTexture {
  const S = 384;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const rnd = (s: number) => Math.abs((Math.sin(s * 12.9898) * 43758.5453) % 1);
  const N = 66;
  const seeds: { x: number; y: number; b: number }[] = [];
  for (let i = 0; i < N; i++) {
    seeds.push({ x: rnd(i * 2 + 1) * S, y: rnd(i * 2 + 7) * S, b: 108 + rnd(i * 3 + 2) * 100 });
  }
  const img = ctx.createImageData(S, S);
  const dat = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d1 = 1e18;
      let d2 = 1e18;
      let b1 = 128;
      for (let k = 0; k < N; k++) {
        const dx = x - seeds[k]!.x;
        const dy = y - seeds[k]!.y;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          b1 = seeds[k]!.b;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1); // small near a cell boundary
      let v = b1;
      if (edge < 3.5) v = 42; // dark valley (the fold line)
      else if (edge < 7.5) v = Math.min(240, b1 + 52); // bright ridge beside it
      const idx = (y * S + x) * 4;
      dat[idx] = dat[idx + 1] = dat[idx + 2] = v;
      dat[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2.6);
  return tex;
}

/** Serrated crimp strip (the torn foil seal). zigTop=true → teeth point up. */
function crimpGeometry(width: number, depth: number, zigTop: boolean): THREE.ExtrudeGeometry {
  const teeth = 12;
  const sh = 0.17; // strip height
  const td = 0.1; // tooth depth
  const hw = width / 2;
  const shape = new THREE.Shape();
  if (zigTop) {
    shape.moveTo(-hw, -sh / 2);
    shape.lineTo(hw, -sh / 2);
    shape.lineTo(hw, sh / 2 - td);
    for (let i = 0; i < teeth; i++) {
      const xm = hw - ((i + 0.5) / teeth) * width;
      const x1 = hw - ((i + 1) / teeth) * width;
      shape.lineTo(xm, sh / 2);
      shape.lineTo(x1, sh / 2 - td);
    }
  } else {
    shape.moveTo(-hw, sh / 2);
    shape.lineTo(hw, sh / 2);
    shape.lineTo(hw, -sh / 2 + td);
    for (let i = 0; i < teeth; i++) {
      const xm = hw - ((i + 0.5) / teeth) * width;
      const x1 = hw - ((i + 1) / teeth) * width;
      shape.lineTo(xm, -sh / 2);
      shape.lineTo(x1, -sh / 2 + td);
    }
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export function Pack3D({ type, className }: { type: PackType; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const t = TIERS[type];

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
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
    camera.position.set(0, 0, 5.2);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(t.glow), 0.7);
    rim.position.set(-4, 2, -2);
    scene.add(rim);

    const crumple = buildCrumple();
    const { tex: artTex, refresh } = buildArt(type);
    void refresh();

    const pack = new THREE.Group();
    scene.add(pack);

    const W = 2.0;
    const H = 3.0;
    const D = 0.2;

    // foil body
    const foil = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(t.metal),
      metalness: 0.96,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      iridescence: 1,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [130, 800],
      bumpMap: crumple,
      bumpScale: 0.16,
      envMapIntensity: 1.5,
    });
    const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 5, 0.05), foil);
    pack.add(body);

    // crimped seals
    const crimpMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(t.metal), metalness: 1, roughness: 0.5, bumpMap: crumple, bumpScale: 0.1, envMapIntensity: 1.0 });
    const topCrimp = new THREE.Mesh(crimpGeometry(W, D * 0.92, true), crimpMat);
    topCrimp.position.y = H / 2 - 0.02;
    const botCrimp = new THREE.Mesh(crimpGeometry(W, D * 0.92, false), crimpMat);
    botCrimp.position.y = -H / 2 + 0.02;
    pack.add(topCrimp, botCrimp);

    // printed front — crumpled foil surface (bump + real displacement warps the print)
    const artMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.08, H - 0.42, 72, 100),
      new THREE.MeshPhysicalMaterial({
        map: artTex,
        bumpMap: crumple,
        bumpScale: 0.11,
        displacementMap: crumple,
        displacementScale: 0.08,
        displacementBias: -0.04,
        metalness: 0.35,
        roughness: 0.42,
        clearcoat: 1,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.05,
        transparent: true,
      }),
    );
    artMesh.position.set(0, 0, D / 2 + 0.005);
    pack.add(artMesh);

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
      const time = clock.getElapsedTime();
      const targetY = pointer.x * 0.55 + Math.sin(time * 0.55) * 0.28;
      const targetX = -pointer.y * 0.4 + Math.sin(time * 0.8) * 0.08;
      pack.rotation.y += (targetY - pack.rotation.y) * 0.08;
      pack.rotation.x += (targetX - pack.rotation.x) * 0.08;
      pack.position.y = Math.sin(time * 0.9) * 0.05;
      renderer.render(scene, camera);
    };
    tick();

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
      crumple.dispose();
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
