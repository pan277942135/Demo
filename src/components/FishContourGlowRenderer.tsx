/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ContourData } from '../types';

interface FishContourGlowRendererProps {
  contourData: ContourData | null;
  currentTime: number; // 0 to 2600ms+
  isPlaying: boolean;
  imageWidth: number;
  imageHeight: number;
  displayedWidth?: number; // actual displayed CSS width of the image
  isPureVisualMode?: boolean;
}

/**
 * Fish Contour Glow V1.1 — 核心描边生长与外围双层柔光渲染器
 * 
 * 规范要求实现：
 * 1. 核心描边生长 (0–1000ms):
 *    - 颜色: #F0DCA5
 *    - 线宽: 1.2 CSS px
 *    - 不透明度: 85%
 *    - 端点与连接: round
 *    - 进度: p = clamp(t / 1000, 0, 1), e(p) = 3p² - 2p³ (smoothstep)
 *    - 0ms: 无描边; 500ms: ~50%; 1000ms: 100%; 1000–1150ms: 静止保持
 * 
 * 2. 阶段严格互斥:
 *    - 0–1000ms: 仅绘制核心描边，柔光彻底关闭
 *    - 1000–1150ms: 核心描边保持，柔光关闭
 *    - 1150–1400ms: 基础柔光平滑淡入 (0% -> 12%)，运动层不启动
 *    - 1400ms 起: 基础柔光保持 12%，运动柔光开始连续循环
 * 
 * 3. 外围柔光:
 *    - 基础柔光: #D9BE7D, 12% 不透明度, 8 CSS px 羽化
 *    - 运动柔光: 覆盖 ~15% 轮廓弧长, 两端平滑透明度渐变, 峰值不透明度 <= 15%
 *    - 连续循环无跳跃, 2600ms后核心线保持、柔光继续循环
 */
export const FishContourGlowRenderer: React.FC<FishContourGlowRendererProps> = ({
  contourData,
  currentTime,
  imageWidth,
  imageHeight,
  displayedWidth,
}) => {
  if (!contourData || !contourData.svgPath) {
    return null;
  }

  const totalLength = contourData.totalLength || 1000;
  const t = Math.max(0, currentTime);

  // CSS px to SVG viewBox units scaling:
  // e.g. If image natural width is 1152 and displayed CSS width is 384, scale = 3.0.
  // 1.2 CSS px * 3.0 = 3.6 SVG units, ensuring rendered line width on screen is EXACTLY 1.2 CSS px!
  const svgScale = displayedWidth && displayedWidth > 0
    ? imageWidth / displayedWidth
    : (imageWidth > 1000 ? 2.6 : 1.0);

  const coreLineWidth = 1.2 * svgScale;
  const baseFeatherRadius = 8.0 * svgScale;

  // === 1. 核心描边路径生长进度 (0–1000ms) ===
  // p = clamp(t / 1000, 0, 1)
  // e(p) = 3p² - 2p³ (smoothstep)
  const growthProgress = useMemo(() => {
    if (t <= 0) return 0;
    if (t >= 1000) return 1.0;
    const p = t / 1000;
    return 3 * p * p - 2 * p * p * p;
  }, [t]);

  // Dashoffset for core stroke growth
  const coreDashoffset = totalLength * (1 - growthProgress);

  // === 2. 基础柔光淡入控制 (1150–1400ms) ===
  // 0–1150ms: 0%
  // 1150–1400ms: smooth fade from 0% to 12%
  // 1400ms+: 12%
  const baseGlowOpacity = useMemo(() => {
    if (t < 1150) return 0;
    if (t >= 1400) return 0.12;
    const u = (t - 1150) / 250;
    const smoothU = 3 * u * u - 2 * u * u * u;
    return 0.12 * smoothU;
  }, [t]);

  // === 3. 运动柔光波 (1400ms 起连续循环) ===
  // 运动层峰值不透明度 <= 15% (0.15)
  // 波长覆盖约 15% 轮廓弧长
  // 周期：1200ms (1400ms 到 2600ms 恰好 1 个完整周期，之后无缝循环)
  const waveCycleDuration = 1200;
  const isMovingWaveActive = t >= 1400;

  const waveParams = useMemo(() => {
    if (!isMovingWaveActive) {
      return { active: false, centerPos: 0, waveLength: 0 };
    }
    const elapsed = t - 1400;
    const phase = (elapsed % waveCycleDuration) / waveCycleDuration; // 0 to 1
    const centerPos = phase * totalLength;
    const waveLength = 0.15 * totalLength;

    return { active: true, centerPos, waveLength };
  }, [isMovingWaveActive, t, totalLength]);

  // Sub-waves for smooth opacity taper at both ends (bell-shaped Gaussian profile):
  // Sub-wave 1: span 0.15 * L, strokeWidth 6 * scale, blur 8 * scale, opacity 0.05
  // Sub-wave 2: span 0.10 * L, strokeWidth 4 * scale, blur 5 * scale, opacity 0.05
  // Sub-wave 3: span 0.05 * L, strokeWidth 2 * scale, blur 2 * scale, opacity 0.05
  // Total peak center opacity = 0.05 + 0.05 + 0.05 = 0.15 (exactly <= 15%!)
  const subWaves = useMemo(() => {
    if (!waveParams.active) return [];

    const center = waveParams.centerPos;
    const w = waveParams.waveLength;

    return [
      {
        id: 'wide-tail',
        length: w, // 0.15 * L
        offset: -(center - w / 2),
        strokeWidth: 6.0 * svgScale,
        blur: baseFeatherRadius,
        opacity: 0.05,
      },
      {
        id: 'mid-body',
        length: w * 0.67, // 0.10 * L
        offset: -(center - (w * 0.67) / 2),
        strokeWidth: 3.8 * svgScale,
        blur: 5.0 * svgScale,
        opacity: 0.05,
      },
      {
        id: 'core-crest',
        length: w * 0.33, // 0.05 * L
        offset: -(center - (w * 0.33) / 2),
        strokeWidth: 2.2 * svgScale,
        blur: 2.5 * svgScale,
        opacity: 0.05,
      },
    ];
  }, [waveParams, svgScale, baseFeatherRadius]);

  return (
    <g className="fish-contour-glow-v1-1 select-none pointer-events-none">
      <defs>
        {/* Base Soft Glow Blur Filter: 8 CSS px */}
        <filter id="fcg-base-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={baseFeatherRadius} result="blur" />
        </filter>

        {/* Sub-wave Blur Filters */}
        <filter id="fcg-subwave-blur-1" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={baseFeatherRadius} result="blur" />
        </filter>
        <filter id="fcg-subwave-blur-2" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={5.0 * svgScale} result="blur" />
        </filter>
        <filter id="fcg-subwave-blur-3" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={2.5 * svgScale} result="blur" />
        </filter>
      </defs>

      {/* ========================================================
          Layer A: 基础外围柔光 (Base Soft Glow)
          - 阶段互斥: 0–1150ms 彻底关闭 (opacity: 0)
          - 1150–1400ms: 从 0% 平滑淡入至 12%
          - 1400ms 起: 恒定保持 12%
          - 颜色: #D9BE7D, 羽化: 8 CSS px
          ======================================================== */}
      {baseGlowOpacity > 0 && (
        <path
          d={contourData.svgPath}
          fill="none"
          stroke="#D9BE7D"
          strokeWidth={coreLineWidth * 4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={baseGlowOpacity}
          filter="url(#fcg-base-blur)"
        />
      )}

      {/* ========================================================
          Layer B: 运动外围柔光波 (Moving Soft Glow Wave)
          - 阶段互斥: 0–1400ms 不启动
          - 1400ms 起: 沿轮廓弧长连续循环
          - 覆盖 ~15% 轮廓弧长, 两端高斯平滑渐隐, 峰值不透明度 <= 15%
          - 无跳跃, 闭合循环无缝连接
          ======================================================== */}
      {isMovingWaveActive && subWaves.map((sub, idx) => (
        <path
          key={sub.id}
          d={contourData.svgPath}
          fill="none"
          stroke="#D9BE7D"
          strokeWidth={sub.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${sub.length} ${totalLength - sub.length} ${sub.length} ${totalLength - sub.length}`}
          strokeDashoffset={sub.offset}
          opacity={sub.opacity}
          filter={`url(#fcg-subwave-blur-${idx + 1})`}
        />
      ))}

      {/* ========================================================
          Layer C: 核心描边 (Core Stroke Growth)
          - 真实路径生长: p = clamp(t/1000, 0, 1), e(p) = 3p² - 2p³
          - 颜色: #F0DCA5
          - 线宽: 1.2 CSS px
          - 不透明度: 85% (0.85)
          - 端点与连接: round
          - 0ms: 无描边; 500ms: 50%; 1000ms: 100%; 1000ms+: 完整静止保持
          ======================================================== */}
      {growthProgress > 0 && (
        <path
          d={contourData.svgPath}
          fill="none"
          stroke="#F0DCA5"
          strokeWidth={coreLineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLength}
          strokeDashoffset={coreDashoffset}
          opacity={0.85}
        />
      )}
    </g>
  );
};
