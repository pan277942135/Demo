/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface VirtualFishRippleProps {
  box: [number, number, number, number]; // [bx1, by1, bx2, by2]
  currentTime: number; // 0 to 2600ms
  imageWidth: number;
  imageHeight: number;
  isPureVisualMode?: boolean;
}

/**
 * 降级视觉方案 V2: BBOX 虚拟鱼体感应波
 * 颜色遵循规范:
 * - Water: #91B9B2
 * - Sun Gold: #D9BE7D
 * - Soft Gold: #F0DCA5
 *
 * 时间轴规范 (严格 2600ms):
 * - 0–300ms: 静默感知，原图稳定，局部极弱水光出现
 * - 300–850ms: 首次感应，出现第一层柔和水波 (Wave 1: 45% → 80%)
 * - 850–1500ms: 连续扩散，第二波 (55% → 90%)、第三波 (65% → 100%) 依次出现向外扩张并变淡
 * - 1500–2150ms: 光影凝结，逐步收敛为抽象鱼体光场
 * - 2150–2600ms: 稳定保持，移除多余波纹，停止明显运动，保留克制最终微光
 */
export const VirtualFishRipple: React.FC<VirtualFishRippleProps> = ({
  box,
  currentTime,
  isPureVisualMode = false,
}) => {
  const [bx1, by1, bx2, by2] = box;
  const bw = Math.max(30, bx2 - bx1);
  const bh = Math.max(30, by2 - by1);
  const cx = Math.round((bx1 + bx2) / 2);
  const cy = Math.round((by1 + by2) / 2);
  const isVertical = bh > bw * 1.15;

  // Max scale bounds strictly inside the bounding box
  const maxW = bw * 0.42;
  const maxH = bh * 0.43;

  // Generate an abstract organic fish silhouette path centered at (0, 0)
  // Subtle organic curvature, neither a vector clipart nor rigid circles
  const getAbstractFishPath = (w: number, h: number, variation = 1.0): string => {
    if (isVertical) {
      const headY = -h * 0.86;
      const tailY = h * 0.88;
      const midY = 0;
      const flankW = w * 0.84 * variation;
      const finW = w * 0.48;

      return `
        M 0,${headY.toFixed(1)}
        C ${(-flankW * 0.68).toFixed(1)},${(headY * 0.48).toFixed(1)}
          ${(-flankW).toFixed(1)},${(midY - h * 0.08).toFixed(1)}
          ${(-flankW * 0.82).toFixed(1)},${(midY + h * 0.28).toFixed(1)}
        C ${(-flankW * 0.58).toFixed(1)},${(h * 0.56).toFixed(1)}
          ${(-w * 0.22).toFixed(1)},${(h * 0.74).toFixed(1)}
          ${(-finW).toFixed(1)},${tailY.toFixed(1)}
        Q 0,${(tailY - h * 0.14).toFixed(1)}
          ${finW.toFixed(1)},${tailY.toFixed(1)}
        C ${(w * 0.22).toFixed(1)},${(h * 0.74).toFixed(1)}
          ${(flankW * 0.58).toFixed(1)},${(h * 0.56).toFixed(1)}
          ${(flankW * 0.82).toFixed(1)},${(midY + h * 0.28).toFixed(1)}
        C ${(flankW).toFixed(1)},${(midY - h * 0.08).toFixed(1)}
          ${(flankW * 0.68).toFixed(1)},${(headY * 0.48).toFixed(1)}
          0,${headY.toFixed(1)}
        Z
      `.replace(/\s+/g, ' ');
    } else {
      const headX = -w * 0.86;
      const tailX = w * 0.88;
      const midX = 0;
      const flankH = h * 0.84 * variation;
      const finH = h * 0.48;

      return `
        M ${headX.toFixed(1)},0
        C ${(headX * 0.48).toFixed(1)},${(-flankH * 0.68).toFixed(1)}
          ${(midX - w * 0.08).toFixed(1)},${(-flankH).toFixed(1)}
          ${(midX + w * 0.28).toFixed(1)},${(-flankH * 0.82).toFixed(1)}
        C ${(w * 0.56).toFixed(1)},${(-flankH * 0.58).toFixed(1)}
          ${(w * 0.74).toFixed(1)},${(-h * 0.22).toFixed(1)}
          ${tailX.toFixed(1)},${(-finH).toFixed(1)}
        Q ${(tailX - w * 0.14).toFixed(1)},0
          ${tailX.toFixed(1)},${finH.toFixed(1)}
        C ${(w * 0.74).toFixed(1)},${(h * 0.22).toFixed(1)}
          ${(w * 0.56).toFixed(1)},${(flankH * 0.58).toFixed(1)}
          ${(midX + w * 0.28).toFixed(1)},${(flankH * 0.82).toFixed(1)}
        C ${(midX - w * 0.08).toFixed(1)},${(flankH).toFixed(1)}
          ${(headX * 0.48).toFixed(1)},${(flankH * 0.68).toFixed(1)}
          ${headX.toFixed(1)},0
        Z
      `.replace(/\s+/g, ' ');
    }
  };

  // Base paths with subtle variation to avoid mechanical concentricity
  const pathWave1 = getAbstractFishPath(maxW, maxH, 1.0);
  const pathWave2 = getAbstractFishPath(maxW, maxH, 0.94);
  const pathWave3 = getAbstractFishPath(maxW, maxH, 1.04);

  // === 0–300ms: 静默感知 (极弱水光出现) ===
  const isPerceptionPhase = currentTime < 350;
  const perceptionShimmer = isPerceptionPhase
    ? Math.sin((currentTime / 300) * Math.PI) * 0.18
    : 0;

  // === 300–850ms: 第一波 (45% → 80%) ===
  const getWave1Props = () => {
    const start = 300;
    const dur = 550; // ends at 850ms
    if (currentTime < start || currentTime > start + dur) {
      return { active: false, scale: 0.45, opacity: 0 };
    }
    const p = (currentTime - start) / dur; // 0 to 1
    const ease = 1 - Math.pow(1 - p, 2.2);
    const scale = 0.45 + ease * (0.80 - 0.45);
    const opacity = (1 - p) * 0.52; // smooth fade out
    return { active: true, scale, opacity };
  };

  // === 850–1500ms: 第二波 (55% → 90%) ===
  const getWave2Props = () => {
    const start = 850;
    const dur = 550; // ends at 1400ms
    if (currentTime < start || currentTime > start + dur) {
      return { active: false, scale: 0.55, opacity: 0 };
    }
    const p = (currentTime - start) / dur;
    const ease = 1 - Math.pow(1 - p, 2.0);
    const scale = 0.55 + ease * (0.90 - 0.55);
    const opacity = (1 - p) * 0.42; // slightly softer
    return { active: true, scale, opacity };
  };

  // === 1150–1650ms: 第三波 (65% → 100%) ===
  const getWave3Props = () => {
    const start = 1150;
    const dur = 550; // ends at 1700ms
    if (currentTime < start || currentTime > start + dur) {
      return { active: false, scale: 0.65, opacity: 0 };
    }
    const p = (currentTime - start) / dur;
    const ease = 1 - Math.pow(1 - p, 1.8);
    const scale = 0.65 + ease * (1.00 - 0.65);
    const opacity = (1 - p) * 0.32; // most delicate
    return { active: true, scale, opacity };
  };

  // === 1500–2150ms: 光影凝结 ===
  // 逐步收敛为抽象鱼体光场
  const isCondensation = currentTime >= 1500 && currentTime < 2150;
  const condenseProgress = isCondensation ? (currentTime - 1500) / 650 : 0;
  const condenseOpacity = isCondensation ? condenseProgress * 0.18 : 0;
  const condenseScale = isCondensation ? 0.94 - condenseProgress * 0.06 : 0.88;

  // === 2150–2600ms: 稳定保持 ===
  // 移除多余波纹和高亮，停止明显运动，保留克制的最终效果
  const isHolding = currentTime >= 2150;
  const holdingOpacity = isHolding ? 0.16 : 0;

  const wave1 = getWave1Props();
  const wave2 = getWave2Props();
  const wave3 = getWave3Props();

  return (
    <g className="virtual-fish-ripple">
      <defs>
        {/* Soft Water Blur Filter */}
        <filter id="v2-water-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Ambient Subtle Radial Gradient (Water #91B9B2 to Soft Gold #F0DCA5) */}
        <radialGradient id="v2-abstract-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F0DCA5" stopOpacity="0.32" />
          <stop offset="40%" stopColor="#D9BE7D" stopOpacity="0.18" />
          <stop offset="80%" stopColor="#91B9B2" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#91B9B2" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="v2-water-gold-stroke" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#91B9B2" stopOpacity="0.8" />
          <stop offset="45%" stopColor="#F0DCA5" stopOpacity="0.95" />
          <stop offset="85%" stopColor="#D9BE7D" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#91B9B2" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* 0–300ms: 静默感知 (局部极弱水光锚点) */}
      {perceptionShimmer > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={Math.min(bw, bh) * 0.12}
          fill="url(#v2-abstract-fill)"
          opacity={perceptionShimmer}
          filter="url(#v2-water-blur)"
        />
      )}

      {/* 第一波: 300–850ms (45% → 80%) */}
      {wave1.active && (
        <g
          transform={`translate(${cx}, ${cy}) scale(${wave1.scale})`}
          style={{ opacity: wave1.opacity }}
        >
          <path
            d={pathWave1}
            fill="url(#v2-abstract-fill)"
            stroke="url(#v2-water-gold-stroke)"
            strokeWidth="1.6"
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#v2-water-blur)"
          />
        </g>
      )}

      {/* 第二波: 850–1500ms (55% → 90%) */}
      {wave2.active && (
        <g
          transform={`translate(${cx}, ${cy}) scale(${wave2.scale})`}
          style={{ opacity: wave2.opacity }}
        >
          <path
            d={pathWave2}
            fill="none"
            stroke="#91B9B2"
            strokeWidth="1.4"
            strokeDasharray="5 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#v2-water-blur)"
          />
          <path
            d={pathWave2}
            transform="scale(0.85)"
            fill="url(#v2-abstract-fill)"
            stroke="#F0DCA5"
            strokeWidth="0.9"
            opacity={0.6}
          />
        </g>
      )}

      {/* 第三波: 1150–1700ms (65% → 100%) */}
      {wave3.active && (
        <g
          transform={`translate(${cx}, ${cy}) scale(${wave3.scale})`}
          style={{ opacity: wave3.opacity }}
        >
          <path
            d={pathWave3}
            fill="none"
            stroke="#D9BE7D"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#v2-water-blur)"
          />
        </g>
      )}

      {/* 1500–2150ms: 光影凝结 */}
      {isCondensation && (
        <g
          transform={`translate(${cx}, ${cy}) scale(${condenseScale})`}
          style={{ opacity: condenseOpacity }}
          className="transition-opacity duration-300"
        >
          <path
            d={pathWave1}
            fill="url(#v2-abstract-fill)"
            stroke="#91B9B2"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#v2-water-blur)"
          />
        </g>
      )}

      {/* 2150–2600ms: 稳定保持 (克制、无明显运动、柔和残影) */}
      {isHolding && (
        <g
          transform={`translate(${cx}, ${cy}) scale(0.88)`}
          style={{ opacity: holdingOpacity }}
        >
          <path
            d={pathWave1}
            fill="url(#v2-abstract-fill)"
            stroke="#D9BE7D"
            strokeWidth="1.1"
            strokeDasharray="4 6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#v2-water-blur)"
          />
        </g>
      )}

      {/* Fallback Explanatory Badge Tag (Hidden in Pure Visual Mode) */}
      {!isPureVisualMode && (
        <g transform={`translate(${cx}, ${Math.max(26, by1 - 10)})`}>
          <rect
            x="-140"
            y="-20"
            width="280"
            height="22"
            rx="5"
            fill="rgba(15, 23, 42, 0.90)"
            stroke="#91B9B2"
            strokeWidth="1.1"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(145, 185, 178, 0.25))',
            }}
          />
          <text
            x="0"
            y="-5"
            fill="#F0DCA5"
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            🌊 降级方案: BBOX 虚拟鱼体感应波 (非真实轮廓)
          </text>
        </g>
      )}
    </g>
  );
};
