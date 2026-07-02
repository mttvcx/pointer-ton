import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { colors, fonts } from "../theme";
import type { Scene, SceneId } from "../script";

// ---------------------------------------------------------------------------
// Shared helpers (deterministic — no Math.random per frame, no flicker)
// ---------------------------------------------------------------------------

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const mkAddr = (rng: () => number) => {
  const s = (n: number) =>
    range(n)
      .map(() => B58[Math.floor(rng() * B58.length)])
      .join("");
  return `${s(4)}…${s(4)}`;
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Central safe band — keeps viz clear of the eyebrow/dots (top) and the
// serif subtitle + watermark (bottom) drawn by Overlay.tsx.
const SAFE_TOP = 300;
const SAFE_BOTTOM = 1430;

const Stage: React.FC<{ children: React.ReactNode; pad?: number }> = ({
  children,
  pad = 90,
}) => (
  <AbsoluteFill
    style={{
      top: SAFE_TOP,
      height: SAFE_BOTTOM - SAFE_TOP,
      paddingLeft: pad,
      paddingRight: pad,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

// A faint engineering grid + vignette shared by every scene.
const Backdrop: React.FC = () => (
  <AbsoluteFill>
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${colors.grid} 1px, transparent 1px), linear-gradient(90deg, ${colors.grid} 1px, transparent 1px)`,
        backgroundSize: "90px 90px",
        maskImage:
          "radial-gradient(120% 80% at 50% 42%, black 35%, transparent 92%)",
        WebkitMaskImage:
          "radial-gradient(120% 80% at 50% 42%, black 35%, transparent 92%)",
        opacity: 0.7,
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(130% 90% at 50% 30%, transparent 55%, rgba(0,0,0,0.55) 100%)",
      }}
    />
  </AbsoluteFill>
);

const useReveal = (delay = 0, dur = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: dur,
  });
  return s;
};

// Small uppercase data label.
const Tag: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = colors.inkDim,
}) => (
  <span
    style={{
      fontFamily: fonts.sans,
      fontSize: 22,
      letterSpacing: 3,
      textTransform: "uppercase",
      color,
      fontWeight: 500,
    }}
  >
    {children}
  </span>
);

interface SceneProps {
  scene: Scene;
}

// ---------------------------------------------------------------------------
// 1. HOOK — "The Outlier": the crowd low, one point far above. $3,000,000.
// ---------------------------------------------------------------------------

const HookScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const rng = mulberry32(7);
  const crowd = range(46).map(() => ({
    x: 0.08 + rng() * 0.84,
    y: 0.62 + rng() * 0.34,
    r: 2.5 + rng() * 3,
  }));
  const W = 900;
  const H = 560;

  const dollars = Math.round(
    interpolate(frame, [10, 70], [0, 3_000_000], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    })
  );
  const outlier = useReveal(40, 26);
  const oy = interpolate(outlier, [0, 1], [0.55, 0.12]);

  return (
    <Stage>
      <Tag>+2,940% · 30 days</Tag>
      <div
        style={{
          fontFamily: fonts.sans,
          fontWeight: 700,
          fontSize: 132,
          color: colors.ink,
          letterSpacing: -2,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.0,
          marginTop: 10,
        }}
      >
        ${dollars.toLocaleString("en-US")}
      </div>
      <div style={{ position: "relative", marginTop: 40 }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          <line
            x1="0"
            y1={H - 1}
            x2={W}
            y2={H - 1}
            stroke={colors.lineStrong}
            strokeWidth={1.5}
          />
          {crowd.map((c, i) => (
            <circle
              key={i}
              cx={c.x * W}
              cy={c.y * H}
              r={c.r}
              fill={colors.inkFaint}
              opacity={interpolate(frame, [i * 0.6, i * 0.6 + 14], [0, 0.55], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}
            />
          ))}
          {/* the outlier */}
          <line
            x1={W * 0.82}
            y1={H - 1}
            x2={W * 0.82}
            y2={oy * H}
            stroke={colors.accentDim}
            strokeWidth={1.5}
            strokeDasharray="4 6"
            opacity={outlier}
          />
          <circle
            cx={W * 0.82}
            cy={oy * H}
            r={10 + outlier * 4}
            fill={colors.accent}
          />
          <circle
            cx={W * 0.82}
            cy={oy * H}
            r={26}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.5}
            opacity={0.4 * outlier}
          />
        </svg>
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 2. MYTHBUST — skill / luck flat, information towering.
// ---------------------------------------------------------------------------

const MythbustScene: React.FC<SceneProps> = () => {
  const bars = [
    { label: "Skill", v: 0.34, color: colors.inkFaint },
    { label: "Luck", v: 0.3, color: colors.inkFaint },
    { label: "Information", v: 1.0, color: colors.accent },
  ];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const maxH = 620;
  return (
    <Stage>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 64,
          height: maxH + 80,
        }}
      >
        {bars.map((b, i) => {
          const s = spring({
            frame: frame - 8 - i * 12,
            fps,
            config: { damping: 200 },
            durationInFrames: 30,
          });
          const h = b.v * maxH * s;
          const isInfo = i === 2;
          return (
            <div
              key={b.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 22,
              }}
            >
              <div
                style={{
                  width: 150,
                  height: h,
                  background: isInfo
                    ? `linear-gradient(180deg, ${colors.accent}, ${colors.accentDim})`
                    : b.color,
                  borderRadius: 4,
                  opacity: isInfo ? 1 : 0.6,
                }}
              />
              <span
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 26,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: isInfo ? colors.accent : colors.inkDim,
                  fontWeight: isInfo ? 600 : 400,
                }}
              >
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 3. LEDGER — streaming public Solana transactions.
// ---------------------------------------------------------------------------

const LedgerScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const rng = mulberry32(21);
  const tokens = ["BONK", "WIF", "POPCAT", "MEW", "PNUT", "GIGA", "MOODENG"];
  const rows = range(22).map((i) => ({
    addr: mkAddr(rng),
    side: rng() > 0.42 ? "BUY" : "SELL",
    tok: tokens[Math.floor(rng() * tokens.length)],
    amt: (rng() * 48 + 1).toFixed(2),
    sol: (rng() * 220 + 4).toFixed(1),
  }));
  const rowH = 66;
  const scroll = (frame * 0.9) % rowH;
  return (
    <Stage pad={70}>
      <div style={{ marginBottom: 26 }}>
        <Tag color={colors.accent}>Solana · Public Ledger</Tag>
      </div>
      <div
        style={{
          height: 820,
          overflow: "hidden",
          maskImage:
            "linear-gradient(180deg, transparent, black 14%, black 86%, transparent)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent, black 14%, black 86%, transparent)",
        }}
      >
        <div style={{ transform: `translateY(${-scroll}px)` }}>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                height: rowH,
                display: "grid",
                gridTemplateColumns: "1.4fr 0.8fr 1fr 1fr",
                alignItems: "center",
                gap: 10,
                borderBottom: `1px solid ${colors.line}`,
                fontFamily: MONO,
                fontSize: 28,
                color: colors.inkDim,
              }}
            >
              <span style={{ color: colors.ink }}>{r.addr}</span>
              <span
                style={{
                  color: r.side === "BUY" ? colors.pos : colors.neg,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {r.side}
              </span>
              <span style={{ color: colors.ink }}>{r.tok}</span>
              <span style={{ textAlign: "right" }}>{r.sol} SOL</span>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 4. TRACKED — early wallets enter before the ramp; the crowd arrives late.
// ---------------------------------------------------------------------------

const TrackedScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const W = 900;
  const H = 600;
  // price ramp path
  const pts = range(60).map((i) => {
    const t = i / 59;
    const y = 1 - Math.pow(t, 2.4) * 0.92 - 0.04;
    return [t * W, y * H] as const;
  });
  const draw = interpolate(frame, [10, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const early = [
    { t: 0.06, label: "EARLY" },
    { t: 0.12, label: "EARLY" },
    { t: 0.18, label: "EARLY" },
  ];
  const late = [0.74, 0.82, 0.88, 0.93];
  const yAt = (t: number) => (1 - Math.pow(t, 2.4) * 0.92 - 0.04) * H;
  return (
    <Stage>
      <div style={{ marginBottom: 20 }}>
        <Tag>Smart money enters first</Tag>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={colors.line} />
        <path
          d={path}
          fill="none"
          stroke={colors.inkDim}
          strokeWidth={2.5}
          strokeDasharray={2000}
          strokeDashoffset={2000 * (1 - draw)}
          opacity={0.7}
        />
        {early.map((e, i) => {
          const op = interpolate(frame, [4 + i * 6, 16 + i * 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <g key={i} opacity={op}>
              <circle cx={e.t * W} cy={yAt(e.t)} r={11} fill={colors.accent} />
              <line
                x1={e.t * W}
                y1={yAt(e.t) - 18}
                x2={e.t * W}
                y2={yAt(e.t) - 54}
                stroke={colors.accentDim}
                strokeWidth={1.5}
              />
            </g>
          );
        })}
        {late.map((t, i) => {
          const op = interpolate(frame, [44 + i * 4, 54 + i * 4], [0, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <circle
              key={i}
              cx={t * W}
              cy={yAt(t)}
              r={7}
              fill={colors.inkFaint}
              opacity={op}
            />
          );
        })}
      </svg>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 5. CONVICTION — 10 wallets converge on one token in the same minute.
// ---------------------------------------------------------------------------

const ConvictionScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 760;
  const H = 760;
  const cx = W / 2;
  const cy = H / 2;
  const R = 300;
  const n = 10;
  const conviction = interpolate(frame, [30, 80], [0, 0.97], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse =
    1 + 0.05 * Math.sin((frame / fps) * Math.PI * 2 * 0.8);
  return (
    <Stage>
      <div style={{ marginBottom: 12, textAlign: "center" }}>
        <Tag color={colors.accent}>
          10 / 10 wallets · 60s window · conviction {conviction.toFixed(2)}
        </Tag>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width={620} viewBox={`0 0 ${W} ${H}`}>
          {range(n).map((i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const wx = cx + Math.cos(a) * R;
            const wy = cy + Math.sin(a) * R;
            const prog = spring({
              frame: frame - 12 - i * 4,
              fps,
              config: { damping: 200 },
              durationInFrames: 34,
            });
            const lx = cx + (wx - cx) * (1 - prog * 0.62);
            const ly = cy + (wy - cy) * (1 - prog * 0.62);
            return (
              <g key={i}>
                <line
                  x1={wx}
                  y1={wy}
                  x2={lx}
                  y2={ly}
                  stroke={colors.accentDim}
                  strokeWidth={1.5}
                  opacity={0.5 * prog}
                />
                <circle cx={wx} cy={wy} r={9} fill={colors.accent} opacity={0.9} />
              </g>
            );
          })}
          <g transform={`translate(${cx} ${cy}) scale(${pulse})`}>
            <circle r={40} fill={colors.accent} opacity={0.16} />
            <circle r={22} fill={colors.accent} />
            <circle r={40} fill="none" stroke={colors.accent} strokeWidth={1.5} opacity={0.5} />
          </g>
        </svg>
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 6. CHART — pump, then smart money distributes at the top to late retail.
// ---------------------------------------------------------------------------

const ChartScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const rng = mulberry32(99);
  const W = 920;
  const H = 600;
  const N = 34;
  // build a pump-then-dump close series
  const closes: number[] = [];
  let p = 0.5;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const drift = t < 0.62 ? 0.028 : -0.05;
    p = Math.max(0.08, Math.min(0.95, p + drift + (rng() - 0.5) * 0.03));
    closes.push(p);
  }
  const cw = W / N;
  const peakIdx = closes.indexOf(Math.max(...closes));
  const yOf = (v: number) => (1 - v) * H;
  return (
    <Stage pad={70}>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
        <Tag>They sell the top</Tag>
        <Tag color={colors.neg}>You buy it</Tag>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {closes.map((c, i) => {
          const o = i === 0 ? c : closes[i - 1];
          const up = c >= o;
          const top = yOf(Math.max(c, o));
          const bot = yOf(Math.min(c, o));
          const wickH = 10 + (rng() * 24);
          const x = i * cw + cw / 2;
          const reveal = interpolate(frame, [i * 1.4, i * 1.4 + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <g key={i} opacity={reveal}>
              <line
                x1={x}
                y1={top - wickH}
                x2={x}
                y2={bot + wickH}
                stroke={up ? colors.pos : colors.neg}
                strokeWidth={1.5}
                opacity={0.7}
              />
              <rect
                x={i * cw + cw * 0.22}
                y={top}
                width={cw * 0.56}
                height={Math.max(3, bot - top)}
                fill={up ? colors.pos : colors.neg}
                opacity={0.85}
              />
            </g>
          );
        })}
        {/* smart-money SELL marker at peak */}
        {(() => {
          const x = peakIdx * cw + cw / 2;
          const op = interpolate(frame, [peakIdx * 1.4 + 6, peakIdx * 1.4 + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <g opacity={op}>
              <line x1={x} y1={yOf(closes[peakIdx]) - 16} x2={x} y2={yOf(closes[peakIdx]) - 60} stroke={colors.accent} strokeWidth={2} />
              <circle cx={x} cy={yOf(closes[peakIdx]) - 72} r={9} fill={colors.accent} />
            </g>
          );
        })()}
      </svg>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 7. TERMINAL — the Pointer product: every signal on one screen.
// ---------------------------------------------------------------------------

const Panel: React.FC<{
  title: string;
  delay: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, delay, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 24 });
  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.line}`,
        borderRadius: 14,
        padding: "20px 22px",
        opacity: s,
        transform: `translateY(${(1 - s) * 26}px)`,
        ...style,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <Tag color={colors.inkDim}>{title}</Tag>
      </div>
      {children}
    </div>
  );
};

const TerminalScene: React.FC<SceneProps> = () => {
  const rng = mulberry32(5);
  const feed = range(5).map(() => ({
    addr: mkAddr(rng),
    tok: ["WIF", "BONK", "POPCAT", "MEW", "GIGA"][Math.floor(rng() * 5)],
    pnl: (rng() * 400 + 20).toFixed(0),
  }));
  const frame = useCurrentFrame();
  return (
    <Stage pad={64}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Panel title="Pointer · Smart-Money Feed" delay={4}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {feed.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 0.7fr 0.8fr",
                  fontFamily: MONO,
                  fontSize: 27,
                  color: colors.inkDim,
                  alignItems: "center",
                }}
              >
                <span style={{ color: colors.ink }}>{f.addr}</span>
                <span style={{ color: colors.accent }}>{f.tok}</span>
                <span style={{ color: colors.pos, textAlign: "right" }}>+{f.pnl}%</span>
              </div>
            ))}
          </div>
        </Panel>
        <div style={{ display: "flex", gap: 18 }}>
          <Panel title="Signals" delay={12} style={{ flex: 1 }}>
            {["Cluster buy · WIF", "10 KOLs · POPCAT", "New whale · MEW"].map((s, i) => {
              const op = interpolate(frame, [24 + i * 6, 36 + i * 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 25,
                    color: colors.ink,
                    padding: "10px 0",
                    borderBottom: `1px solid ${colors.line}`,
                    opacity: op,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: colors.accent }} />
                  {s}
                </div>
              );
            })}
          </Panel>
          <Panel title="Flow" delay={16} style={{ flex: 1 }}>
            <svg width="100%" viewBox="0 0 300 150">
              {range(14).map((i) => {
                const h = (Math.sin(i * 0.9) * 0.5 + 0.5) * 110 + 12;
                const op = interpolate(frame, [30 + i * 2, 40 + i * 2], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <rect
                    key={i}
                    x={i * 21 + 6}
                    y={150 - h}
                    width={14}
                    height={h}
                    fill={i % 3 === 0 ? colors.accent : colors.inkFaint}
                    opacity={op}
                  />
                );
              })}
            </svg>
          </Panel>
        </div>
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 8. END — Pointer mark + wordmark (tagline handled by Overlay subtitle).
// ---------------------------------------------------------------------------

const EndScene: React.FC<SceneProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 30 });
  return (
    <Stage>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 34,
          opacity: s,
          transform: `scale(${interpolate(s, [0, 1], [0.92, 1])})`,
        }}
      >
        {/* minimal crosshair / pointer mark */}
        <svg width={150} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke={colors.lineStrong} strokeWidth="2" />
          <circle cx="50" cy="50" r="7" fill={colors.accent} />
          <line x1="50" y1="6" x2="50" y2="26" stroke={colors.accent} strokeWidth="2" />
          <line x1="50" y1="74" x2="50" y2="94" stroke={colors.accent} strokeWidth="2" />
          <line x1="6" y1="50" x2="26" y2="50" stroke={colors.accent} strokeWidth="2" />
          <line x1="74" y1="50" x2="94" y2="50" stroke={colors.accent} strokeWidth="2" />
        </svg>
        <div
          style={{
            fontFamily: fonts.serif,
            fontSize: 96,
            fontWeight: 600,
            color: colors.ink,
            letterSpacing: 2,
          }}
        >
          Pointer
        </div>
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------

export const SCENE_COMPONENTS: Record<SceneId, React.FC<SceneProps>> = {
  hook: HookScene,
  mythbust: MythbustScene,
  ledger: LedgerScene,
  tracked: TrackedScene,
  conviction: ConvictionScene,
  chart: ChartScene,
  terminal: TerminalScene,
  end: EndScene,
};

export const SceneBackground = Backdrop;
