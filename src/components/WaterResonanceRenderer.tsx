/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ContourData, WaterResonanceConfig } from '../types';
import { FishDetection } from '../services/detectorService';

/**
 * 渔见 AI — Water Resonance 湖面回响高保真动效 V1 光学补偿参数配置
 * 
 * 补偿要点：
 * 1. 彻底移除 mixBlendMode: 'screen'，改用标准稳健的 SVG Alpha 复合，避免日光白昼实拍图对冲冲淡；
 * 2. 修复“过度模糊导致像素能量稀释 13.5 倍”的问题，采用双层结构（清晰柔和光核 + 外层低羽化光晕）；
 * 3. 增强水波内部体积光（Soft Volume），使波纹拥有水体漫射而非单根空心细线；
 * 4. 适配手机屏幕视口（360px / 1152px 缩放比），线宽补偿为 2.5px~3.5px，保证移动端呈现清晰高质感发丝光边；
 * 5. 2100ms–2600ms 保持静态且可辨识的暖金残光（Alpha ~0.22）。
 */
export const DEFAULT_WATER_RESONANCE_CONFIG: WaterResonanceConfig = {
  version: '1.0.0',
  durationMs: 2600,
  ambientColor: '#729E9B',
  ambientAlpha: 0.22,
  rippleColor: '#D9BE7D',
  rippleAlpha: 0.45,
  goldColor: '#F0DCA5',
  goldAlpha: 0.45,
  residueColor: '#C8AE76',
  residueAlpha: 0.22,
  fishFieldLengthRatio: 0.88,
  fishFieldWidthRatio: 0.72,
  softFeatherRatio: 0.10,
  wavefrontWidthRatio: 0.020,
  waveDistortionRatio: 0.007,
  pulseCount: 3,
  pulseStartTimes: [300, 700, 1100],
  pulseDurations: [550, 550, 550],
  pulseStartScales: [0.42, 0.52, 0.60],
  pulseEndScales: [0.80, 0.88, 0.95],
  pulsePeakAlphas: [0.55, 0.48, 0.42],
  pulseColors: ['#D9BE7D', '#E2CFA0', '#A7C8BF'],
  freezeAtMs: 2100,
  geometryMode: 'BBOX_ONLY',
};

interface WaterResonanceRendererProps {
  currentTime: number; // 0 to 2600ms
  imageWidth: number;
  imageHeight: number;
  fishDetection: FishDetection | null;
  contourData: ContourData | null;
  isMaskTrustworthy: boolean;
  isBboxTrustworthy: boolean;
  isPureVisualMode?: boolean;
  config?: WaterResonanceConfig;
}

export const WaterResonanceRenderer: React.FC<WaterResonanceRendererProps> = ({
  currentTime,
  imageWidth,
  imageHeight,
  fishDetection,
  contourData,
  isMaskTrustworthy,
  isBboxTrustworthy,
  isPureVisualMode = false,
  config = DEFAULT_WATER_RESONANCE_CONFIG,
}) => {
  // Clamp time to timeline range [0, 2600]
  const t = Math.max(0, Math.min(config.durationMs, currentTime));

  // Determine geometry mode
  const effectiveGeometryMode: 'TRUSTED_MASK' | 'BBOX_ONLY' | 'NO_GEOMETRY' = useMemo(() => {
    if (isMaskTrustworthy && contourData) return 'TRUSTED_MASK';
    if (isBboxTrustworthy && fishDetection) return 'BBOX_ONLY';
    return 'NO_GEOMETRY';
  }, [isMaskTrustworthy, contourData, isBboxTrustworthy, fishDetection]);

  // If no fish detected at all, create an ambient center fallback
  const box = fishDetection?.box || [
    imageWidth * 0.25,
    imageHeight * 0.25,
    imageWidth * 0.75,
    imageHeight * 0.75,
  ];

  const [bx1, by1, bx2, by2] = box;
  const bw = Math.max(50, bx2 - bx1);
  const bh = Math.max(50, by2 - by1);
  const shortEdge = Math.min(bw, bh);
  const cx = Math.round((bx1 + bx2) / 2);
  const cy = Math.round((by1 + by2) / 2);
  const isVertical = bh > bw * 1.15;

  // Maximum field dimensions (Length <= 88%, Width <= 72%)
  const fieldLength = (isVertical ? bh : bw) * config.fishFieldLengthRatio;
  const fieldWidth = (isVertical ? bw : bh) * config.fishFieldWidthRatio;
  const halfLen = fieldLength * 0.5;
  const halfWid = fieldWidth * 0.5;

  // Helper: easeOutCubic
  const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

  // === L1: Water Ambient Field ===
  // 150ms faintly appears, peaks at 500ms (alpha 0.22), holds gently until 2100ms
  const ambientAlpha = useMemo(() => {
    if (t < 150) return 0;
    if (t < 500) {
      return ((t - 150) / 350) * config.ambientAlpha;
    }
    if (t < 1850) {
      return config.ambientAlpha;
    }
    if (t < config.freezeAtMs) {
      const p = (t - 1850) / (config.freezeAtMs - 1850);
      return config.ambientAlpha * (1 - p * 0.35);
    }
    return config.ambientAlpha * 0.65;
  }, [t, config.ambientAlpha, config.freezeAtMs]);

  // === L2: Soft Fish Presence (五重高斯软体积光场) ===
  const softPresenceAlpha = useMemo(() => {
    if (effectiveGeometryMode === 'NO_GEOMETRY') return 0;
    if (t < 250) return 0;
    if (t < 650) {
      return ((t - 250) / 400) * 0.28;
    }
    if (t < 1650) {
      return 0.28;
    }
    if (t < config.freezeAtMs) {
      const p = (t - 1650) / (config.freezeAtMs - 1650);
      return 0.28 * (1 - p) + config.residueAlpha * p;
    }
    return config.residueAlpha;
  }, [t, effectiveGeometryMode, config.freezeAtMs, config.residueAlpha]);

  // 5 Gaussian blob nodes along BBOX major axis
  const gaussianBlobs = useMemo(() => {
    const positions = [-0.35, -0.18, 0, 0.18, 0.35];
    const widthFactors = [0.42, 0.75, 1.0, 0.72, 0.38];
    const lengthFactors = [0.28, 0.35, 0.42, 0.34, 0.26];

    return positions.map((pos, idx) => {
      const offset = pos * halfLen;
      const rx = isVertical ? halfWid * widthFactors[idx] : halfLen * lengthFactors[idx];
      const ry = isVertical ? halfLen * lengthFactors[idx] : halfWid * widthFactors[idx];
      const posX = isVertical ? cx : cx + offset;
      const posY = isVertical ? cy + offset : cy;

      return {
        id: idx,
        cx: posX,
        cy: posY,
        rx: Math.max(12, rx),
        ry: Math.max(12, ry),
      };
    });
  }, [isVertical, cx, cy, halfLen, halfWid]);

  // === L3: Water Resonance Pulses (3 Waves with exact parameters) ===
  const pulseStates = useMemo(() => {
    if (effectiveGeometryMode === 'NO_GEOMETRY') return [];

    return [0, 1, 2].map((idx) => {
      const start = config.pulseStartTimes[idx];
      const duration = config.pulseDurations[idx];
      const end = start + duration;
      const startScale = config.pulseStartScales[idx];
      const endScale = config.pulseEndScales[idx];
      const peakAlpha = config.pulsePeakAlphas[idx];
      const color = config.pulseColors[idx];

      if (t < start || t > end) {
        return { active: false, scale: startScale, alpha: 0, color, idx };
      }

      const u = Math.max(0, Math.min(1, (t - start) / duration));
      const scale = startScale + (endScale - startScale) * easeOutCubic(u);

      // Opacity: ramps to peak at 20% (u = 0.2), then continuous 80% decay to 0
      let alpha = 0;
      if (u <= 0.2) {
        alpha = (u / 0.2) * peakAlpha;
      } else {
        alpha = peakAlpha * (1 - (u - 0.2) / 0.8);
      }

      return { active: true, scale, alpha, color, idx };
    });
  }, [t, effectiveGeometryMode, config]);

  // Wavefront geometry generation with low-frequency deterministic perturbation
  const getPerturbedWavefrontPath = useMemo(() => {
    return (scale: number, pulseIndex: number) => {
      const rx = (isVertical ? halfWid : halfLen) * scale;
      const ry = (isVertical ? halfLen : halfWid) * scale;
      const points: string[] = [];
      const steps = 40;
      const maxDistort = shortEdge * config.waveDistortionRatio;

      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        // Deterministic low-frequency perturbation: harmonic combination (3θ and 5θ)
        const distort =
          Math.sin(3 * theta + pulseIndex * 1.7) * (maxDistort * 0.7) +
          Math.cos(5 * theta - pulseIndex * 1.1) * (maxDistort * 0.3);

        const curRx = Math.max(6, rx + (isVertical ? distort * 0.5 : distort));
        const curRy = Math.max(6, ry + (isVertical ? distort : distort * 0.5));

        const px = cx + curRx * Math.cos(theta);
        const py = cy + curRy * Math.sin(theta);

        if (i === 0) {
          points.push(`M ${px.toFixed(1)},${py.toFixed(1)}`);
        } else {
          points.push(`L ${px.toFixed(1)},${py.toFixed(1)}`);
        }
      }
      points.push('Z');
      return points.join(' ');
    };
  }, [isVertical, cx, cy, halfLen, halfWid, shortEdge, config.waveDistortionRatio]);

  // === L4: Final Gold Residue ===
  // 1650ms starts condensation, 2100ms-2600ms static state (alpha 0.22)
  const residueAlpha = useMemo(() => {
    if (effectiveGeometryMode === 'NO_GEOMETRY') return 0;
    if (t < 1650) return 0;
    if (t < config.freezeAtMs) {
      return ((t - 1650) / (config.freezeAtMs - 1650)) * config.residueAlpha;
    }
    return config.residueAlpha; // 2100-2600ms strictly constant
  }, [t, effectiveGeometryMode, config.freezeAtMs, config.residueAlpha]);

  // === Mode A: Real Mask Guide Helper Line (1500–2100ms) ===
  const realMaskContourAlpha = useMemo(() => {
    if (effectiveGeometryMode !== 'TRUSTED_MASK' || !contourData) return 0;
    if (t < 1400) return 0;
    if (t < config.freezeAtMs) {
      const p = (t - 1400) / (config.freezeAtMs - 1400);
      return p * 0.45; // peaks at 0.45
    }
    // Final static stage: retains very gentle, visible warm gold hairline
    return 0.32;
  }, [t, effectiveGeometryMode, contourData, config.freezeAtMs]);

  // Optical compensation: controlled feathering (6px-12px) to prevent energy dilution
  const ambientBlur = Math.max(8, Math.round(shortEdge * 0.08));
  const presenceBlur = Math.max(6, Math.round(shortEdge * 0.06));
  const waveBlur = Math.max(3, Math.round(shortEdge * 0.035));
  const residueBlur = Math.max(8, Math.round(shortEdge * 0.07));
  const wavefrontCoreWidth = Math.max(2.2, Math.round(shortEdge * 0.012));

  return (
    <g className="water-resonance-v1 select-none pointer-events-none">
      <defs>
        {/* L1 Ambient Water Glow Blur */}
        <filter id="wr-ambient-blur" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation={ambientBlur} result="blur" />
        </filter>

        {/* L2 Soft Presence Blur */}
        <filter id="wr-presence-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={presenceBlur} result="blur" />
        </filter>

        {/* L3 Pulse Wavefront Glow Blur */}
        <filter id="wr-wave-blur" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation={waveBlur} result="blur" />
        </filter>

        {/* L4 Residue Blur */}
        <filter id="wr-residue-blur" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation={residueBlur} result="blur" />
        </filter>

        {/* Soft volumetric radial shimmer for wave pulses */}
        <radialGradient id="wr-wave-volumetric-1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#D9BE7D" stopOpacity="0.28" />
          <stop offset="65%" stopColor="#729E9B" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#729E9B" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="wr-wave-volumetric-2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E2CFA0" stopOpacity="0.25" />
          <stop offset="70%" stopColor="#91B9B2" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#729E9B" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="wr-wave-volumetric-3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A7C8BF" stopOpacity="0.26" />
          <stop offset="65%" stopColor="#D9BE7D" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#729E9B" stopOpacity="0" />
        </radialGradient>

        {/* Soft residue gradient */}
        <radialGradient id="wr-residue-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C8AE76" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#C8AE76" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#729E9B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ========================================================
          L1: Water Ambient Field (局部柔和水光环境 #729E9B)
          ======================================================== */}
      {ambientAlpha > 0 && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={Math.max(25, (isVertical ? halfWid : halfLen) * 1.15)}
          ry={Math.max(25, (isVertical ? halfLen : halfWid) * 1.15)}
          fill={config.ambientColor}
          opacity={ambientAlpha}
          filter="url(#wr-ambient-blur)"
        />
      )}

      {/* ========================================================
          L2: Soft Fish Presence (五重高斯软体积光场)
          ======================================================== */}
      {softPresenceAlpha > 0 && (
        <g filter="url(#wr-presence-blur)" opacity={softPresenceAlpha}>
          {gaussianBlobs.map((blob) => (
            <ellipse
              key={blob.id}
              cx={blob.cx}
              cy={blob.cy}
              rx={blob.rx}
              ry={blob.ry}
              fill={config.rippleColor}
            />
          ))}
        </g>
      )}

      {/* When in TRUSTED_MASK mode, provide subtle interior soft fill */}
      {effectiveGeometryMode === 'TRUSTED_MASK' && contourData && softPresenceAlpha > 0 && (
        <path
          d={contourData.svgPath}
          fill="url(#wr-wave-volumetric-1)"
          opacity={softPresenceAlpha * 0.7}
          filter="url(#wr-presence-blur)"
        />
      )}

      {/* ========================================================
          L3: Water Resonance Pulses (三次柔和暖金水波回响)
          ======================================================== */}
      {pulseStates.map((pulse) => {
        if (!pulse.active || pulse.alpha <= 0.001) return null;
        const wavePath = getPerturbedWavefrontPath(pulse.scale, pulse.idx);
        const volumetricFill =
          pulse.idx === 0
            ? 'url(#wr-wave-volumetric-1)'
            : pulse.idx === 1
            ? 'url(#wr-wave-volumetric-2)'
            : 'url(#wr-wave-volumetric-3)';

        return (
          <g key={pulse.idx} opacity={pulse.alpha}>
            {/* 1. Volumetric soft interior body */}
            <path
              d={wavePath}
              fill={volumetricFill}
              opacity={0.65}
            />

            {/* 2. Feathered outer refraction glow */}
            <path
              d={wavePath}
              fill="none"
              stroke={pulse.color}
              strokeWidth={wavefrontCoreWidth * 2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#wr-wave-blur)"
              opacity={0.7}
            />

            {/* 3. Crisp warm gold hairline core (清晰可辨，不被高斯模糊稀释) */}
            <path
              d={wavePath}
              fill="none"
              stroke={pulse.color}
              strokeWidth={wavefrontCoreWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
              style={{
                filter: `drop-shadow(0 0 3px ${pulse.color})`,
              }}
            />

            {/* 4. Delicate inner highlight sheen */}
            <path
              d={wavePath}
              fill="none"
              stroke="#FFFDF2"
              strokeWidth={Math.max(1.0, wavefrontCoreWidth * 0.45)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.65}
            />
          </g>
        );
      })}

      {/* ========================================================
          L4: Final Gold Residue (凝结后的安静暖金残光 #C8AE76)
          ======================================================== */}
      {residueAlpha > 0 && (
        <g opacity={residueAlpha}>
          <ellipse
            cx={cx}
            cy={cy}
            rx={Math.max(20, (isVertical ? halfWid : halfLen) * 0.85)}
            ry={Math.max(20, (isVertical ? halfLen : halfWid) * 0.85)}
            fill="url(#wr-residue-gradient)"
            filter="url(#wr-residue-blur)"
          />
        </g>
      )}

      {/* ========================================================
          Mode A Auxiliary Helper: Real Mask Slender Core Hairline (1400–2600ms)
          ======================================================== */}
      {realMaskContourAlpha > 0 && contourData && (
        <g opacity={realMaskContourAlpha}>
          {/* Outer soft aura */}
          <path
            d={contourData.svgPath}
            fill="none"
            stroke={config.goldColor}
            strokeWidth="5"
            opacity="0.35"
            filter="url(#wr-wave-blur)"
          />
          {/* Slender, crisp core line (2.2px in image coords = ~0.7px on phone screen) */}
          <path
            d={contourData.svgPath}
            fill="none"
            stroke={config.goldColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
            style={{
              filter: 'drop-shadow(0 0 3px rgba(240, 220, 165, 0.8))',
            }}
          />
        </g>
      )}

      {/* Debug mode informative tag (completely hidden in pure visual mode) */}
      {!isPureVisualMode && (
        <g transform={`translate(${cx}, ${Math.max(34, by1 - 12)})`}>
          <rect
            x="-160"
            y="-22"
            width="320"
            height="24"
            rx="5"
            fill="rgba(10, 18, 22, 0.92)"
            stroke="#729E9B"
            strokeWidth="1.2"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(114, 158, 155, 0.35))',
            }}
          />
          <text
            x="0"
            y="-6"
            fill="#D9BE7D"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            🌊 Water Resonance 湖面回响 V1 ({effectiveGeometryMode})
          </text>
        </g>
      )}
    </g>
  );
};
