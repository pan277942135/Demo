/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Upload,
  Sparkles,
  Fish,
  Eye,
  EyeOff,
  Waves,
} from 'lucide-react';
import {
  ContourData,
  EffectBranch,
  GoldContourParams,
  MaskResult,
  SpeciesData,
  ViewMode,
  WaterResonanceConfig,
} from '../types';
import { FishDetection } from '../services/detectorService';
import { VirtualFishRipple } from './VirtualFishRipple';
import { WaterResonanceRenderer, DEFAULT_WATER_RESONANCE_CONFIG } from './WaterResonanceRenderer';
import { FishContourGlowRenderer } from './FishContourGlowRenderer';

export type VisualModeSelection = 'AUTO' | 'FORCE_REAL' | 'FORCE_VIRTUAL';

interface CanvasViewportProps {
  imageSrc: string | null;
  imageDims: { width: number; height: number } | null;
  maskResult: MaskResult | null;
  contourData: ContourData | null;
  fishDetection: FishDetection | null;
  viewMode: ViewMode;
  contourParams: GoldContourParams;
  speciesData: SpeciesData;
  currentTime: number; // 0 to 2600 ms+
  isAnalyzing: boolean;
  effectBranch?: EffectBranch;
  waterResonanceConfig?: WaterResonanceConfig;
  onSelectEffectBranch?: (branch: EffectBranch) => void;
  isFallbackActive?: boolean;
  isMaskTrustworthy?: boolean;
  isBboxTrustworthy?: boolean;
  fallbackReason?: string;
  isPureVisualMode?: boolean;
  onTogglePureVisualMode?: () => void;
  visualModeOverride?: VisualModeSelection;
  onImageUploaded: (file: File) => void;
  onLoadReferencePhoto?: () => void;
  onLoadPresetPhoto?: () => void;
  onTapToRefocus?: (x: number, y: number) => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  imageSrc,
  imageDims,
  maskResult,
  contourData,
  fishDetection,
  viewMode,
  contourParams,
  speciesData,
  currentTime,
  isAnalyzing,
  effectBranch = 'CLASSIC_GOLD_CONTOUR',
  waterResonanceConfig = DEFAULT_WATER_RESONANCE_CONFIG,
  onSelectEffectBranch,
  isFallbackActive = false,
  isMaskTrustworthy = true,
  isBboxTrustworthy = true,
  fallbackReason,
  isPureVisualMode = false,
  onTogglePureVisualMode,
  visualModeOverride = 'AUTO',
  onImageUploaded,
  onLoadPresetPhoto,
  onTapToRefocus,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [showBox, setShowBox] = useState<boolean>(true);
  const [displayedImgWidth, setDisplayedImgWidth] = useState<number>(380);

  // Measure actual displayed CSS width of the image to scale SVG line width to exact CSS px
  useEffect(() => {
    if (!imgRef.current) return;
    const updateWidth = () => {
      if (imgRef.current && imgRef.current.clientWidth > 0) {
        setDisplayedImgWidth(imgRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [imageSrc]);

  // Render mask onto overlay canvas whenever mask or viewMode changes
  useEffect(() => {
    if (!maskCanvasRef.current || !imageDims) return;
    const canvas = maskCanvasRef.current;
    canvas.width = imageDims.width;
    canvas.height = imageDims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!maskResult) return;
    const candidate = maskResult.candidates[maskResult.selectedCandidateIndex];
    if (!candidate) return;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    const maskData = candidate.data;
    const total = canvas.width * canvas.height;

    if (viewMode === 'BINARY_MASK') {
      // Pure black & white
      for (let i = 0; i < total; i++) {
        const val = maskData[i] > 127 ? 255 : 0;
        const idx = i * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    } else if (viewMode === 'MASK_OVERLAY') {
      // Only show overlay if user explicitly selects MASK_OVERLAY mode
      for (let i = 0; i < total; i++) {
        if (maskData[i] > 127) {
          const idx = i * 4;
          data[idx] = 217; // #D9BE7D
          data[idx + 1] = 190;
          data[idx + 2] = 125;
          data[idx + 3] = 90;
        }
      }
    }
    // In COMPOSITE mode (default), maskCanvasRef is completely transparent!
    ctx.putImageData(imgData, 0, 0);
  }, [maskResult, viewMode, imageDims]);

  // Determine active visual branch based on override or quality gate:
  const effectiveMode: 'REAL' | 'VIRTUAL' | 'NONE' = (() => {
    if (visualModeOverride === 'FORCE_REAL') return 'REAL';
    if (visualModeOverride === 'FORCE_VIRTUAL') return 'VIRTUAL';
    if (isMaskTrustworthy && contourData) return 'REAL';
    if (isBboxTrustworthy && fishDetection) return 'VIRTUAL';
    return 'NONE';
  })();

  const showRealContour = effectiveMode === 'REAL' && contourData && (
    viewMode === 'CONTOUR_ONLY' ||
    viewMode === 'COMPOSITE' ||
    viewMode === 'ORIGINAL' ||
    viewMode === 'MASK_OVERLAY'
  );

  const showVirtualRipple = effectiveMode === 'VIRTUAL' && fishDetection;

  // Handle click on canvas image to re-center or tap-to-focus
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current || !imageDims || !onTapToRefocus) return;
    const rect = imgRef.current.getBoundingClientRect();

    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return;
    }

    const scaleX = imageDims.width / rect.width;
    const scaleY = imageDims.height / rect.height;

    const clickX = Math.round((e.clientX - rect.left) * scaleX);
    const clickY = Math.round((e.clientY - rect.top) * scaleY);

    onTapToRefocus(clickX, clickY);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageUploaded(file);
      }
    }
  };

  const shouldRenderSvg = imageDims && (
    (effectBranch === 'WATER_RESONANCE') ||
    showRealContour ||
    showVirtualRipple ||
    (showBox && fishDetection && !isPureVisualMode)
  );

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-[620px] lg:h-[720px] bg-[#07090d] rounded-2xl overflow-hidden border transition-all flex items-center justify-center select-none shadow-2xl ${
        isDragOver
          ? 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-400/40'
          : 'border-neutral-800'
      }`}
    >
      {/* Ambient Radial Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(217,190,125,0.04)_0%,rgba(10,14,22,0.6)_60%,rgba(6,8,12,0.95)_100%)]" />

      {/* When no image is uploaded: Clean upload prompt */}
      {!imageSrc ? (
        <div className="max-w-md p-8 text-center z-10 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center mb-5 text-[#D9BE7D] shadow-2xl">
            <Upload className="w-10 h-10 animate-bounce" />
          </div>
          <h3 className="text-lg font-bold text-neutral-100 mb-1.5 tracking-tight">
            上传真实鱼获照片
          </h3>
          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            请上传您拍摄的真实鱼获照片。系统将自动进行高精度鱼体定位，呈现 <strong>Fish Contour Glow V1.1</strong> 真实路径生长与外围双层柔光。
          </p>

          <div className="w-full space-y-3">
            <label className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#D9BE7D] to-[#F0DCA5] hover:from-[#cbb06e] hover:to-[#e4d098] text-neutral-950 font-bold text-sm cursor-pointer flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-950/20 active:scale-[0.98]">
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>选择手机/电脑中的鱼获照片上传</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onImageUploaded(e.target.files[0]);
                  }
                }}
              />
            </label>

            {/* 快速查看预置图片按钮 */}
            {onLoadPresetPhoto && (
              <button
                type="button"
                onClick={onLoadPresetPhoto}
                disabled={isAnalyzing}
                className="w-full py-3 px-5 rounded-xl bg-neutral-900/90 hover:bg-neutral-850 border border-[#D9BE7D]/50 hover:border-[#D9BE7D] text-[#F0DCA5] hover:text-white font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 group"
              >
                <Sparkles className="w-4 h-4 text-[#D9BE7D] group-hover:rotate-12 transition-transform" />
                <span>使用预置图片</span>
                <span className="text-xs text-neutral-400 group-hover:text-neutral-300 font-normal">
                  (免上传快速查看效果)
                </span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Image & Optics Stage */
        <div
          onClick={handleCanvasClick}
          className="relative max-w-full max-h-full flex items-center justify-center cursor-default"
        >
          {/* L0: Base Fish Image - Completely stable, zero displacement, zero scaling jitter */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Fish Catch"
            className={`max-w-full max-h-[600px] lg:max-h-[700px] object-contain block pointer-events-none transition-opacity duration-300 ${
              viewMode === 'BINARY_MASK' ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Mask Canvas Layer (Only visible in explicit mask inspection modes) */}
          <canvas
            ref={maskCanvasRef}
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300 ${
              viewMode === 'ORIGINAL' || viewMode === 'CONTOUR_ONLY' || viewMode === 'COMPOSITE'
                ? 'opacity-0'
                : 'opacity-100'
            }`}
          />

          {/* SVG Optical Layer */}
          {shouldRenderSvg && (
            <svg
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
              viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
            >
              {/* BRANCH 1: Water Resonance (湖面回响 V1) */}
              {effectBranch === 'WATER_RESONANCE' ? (
                <WaterResonanceRenderer
                  currentTime={currentTime}
                  imageWidth={imageDims.width}
                  imageHeight={imageDims.height}
                  fishDetection={fishDetection}
                  contourData={contourData}
                  isMaskTrustworthy={isMaskTrustworthy}
                  isBboxTrustworthy={isBboxTrustworthy}
                  isPureVisualMode={isPureVisualMode}
                  config={waterResonanceConfig}
                />
              ) : (
                /* BRANCH 2: Fish Contour Glow V1.1 (原版金色轮廓 V1.1 核心生长与双层柔光) */
                <>
                  {/* Mode B: BBOX Virtual Ripple (Fallback when Mask untrustworthy) */}
                  {showVirtualRipple && (
                    <VirtualFishRipple
                      box={fishDetection.box}
                      currentTime={currentTime}
                      imageWidth={imageDims.width}
                      imageHeight={imageDims.height}
                      isPureVisualMode={isPureVisualMode}
                    />
                  )}

                  {/* Mode A: Fish Contour Glow V1.1 (Real Mask Cumulative Arc Length Growth & Dual-layer Soft Glow) */}
                  {showRealContour && contourData && (
                    <FishContourGlowRenderer
                      contourData={contourData}
                      currentTime={currentTime}
                      isPlaying={true}
                      imageWidth={imageDims.width}
                      imageHeight={imageDims.height}
                      displayedWidth={displayedImgWidth}
                      isPureVisualMode={isPureVisualMode}
                    />
                  )}
                </>
              )}

              {/* AI Fish Target Tracking BBOX (Hidden in Pure Visual Mode) */}
              {!isPureVisualMode && showBox && fishDetection && (
                <g className="transition-all duration-300">
                  <rect
                    x={fishDetection.box[0]}
                    y={fishDetection.box[1]}
                    width={fishDetection.width}
                    height={fishDetection.height}
                    fill="rgba(217, 190, 125, 0.04)"
                    stroke="rgba(217, 190, 125, 0.55)"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                    rx="4"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(217, 190, 125, 0.3))' }}
                  />
                  {(() => {
                    const [bx1, by1, bx2, by2] = fishDetection.box;
                    const bLen = Math.max(14, Math.min(32, Math.min(fishDetection.width, fishDetection.height) * 0.20));
                    return (
                      <g stroke="#F0DCA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <path d={`M ${bx1} ${by1 + bLen} L ${bx1} ${by1} L ${bx1 + bLen} ${by1}`} />
                        <path d={`M ${bx2 - bLen} ${by1} L ${bx2} ${by1} L ${bx2} ${by1 + bLen}`} />
                        <path d={`M ${bx1} ${by2 - bLen} L ${bx1} ${by2} L ${bx1 + bLen} ${by2}`} />
                        <path d={`M ${bx2 - bLen} ${by2} L ${bx2} ${by2} L ${bx2 - bLen} ${by2}`} />
                      </g>
                    );
                  })()}
                  <g transform={`translate(${fishDetection.box[0]}, ${Math.max(26, fishDetection.box[1] - 8)})`}>
                    <rect
                      x="0"
                      y="-20"
                      width={Math.min(240, Math.max(160, fishDetection.width))}
                      height="20"
                      rx="4"
                      fill="rgba(10, 14, 22, 0.90)"
                      stroke="#D9BE7D"
                      strokeWidth="1"
                    />
                    <text
                      x="7"
                      y="-5"
                      fill="#F0DCA5"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      🎯 鱼体锁定 {(fishDetection.confidence * 100).toFixed(0)}% [{fishDetection.width}×{fishDetection.height}]
                    </text>
                  </g>
                </g>
              )}
            </svg>
          )}

          {/* Quick HUD Controls (Top Right) */}
          <div className="absolute top-4 right-4 z-30 pointer-events-auto flex items-center gap-2">
            {/* Effect Branch Quick Switcher */}
            {onSelectEffectBranch && (
              <div className="flex rounded-full bg-neutral-900/85 backdrop-blur-md p-0.5 border border-neutral-700 shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEffectBranch('CLASSIC_GOLD_CONTOUR');
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                    effectBranch === 'CLASSIC_GOLD_CONTOUR'
                      ? 'bg-[#D9BE7D] text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="切换为 Fish Contour Glow V1.1 真实金色轮廓"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>金色轮廓 V1.1</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEffectBranch('WATER_RESONANCE');
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                    effectBranch === 'WATER_RESONANCE'
                      ? 'bg-[#729E9B] text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="切换为 Water Resonance 湖面回响 V1 动效分支"
                >
                  <Waves className="w-3 h-3" />
                  <span>湖面回响</span>
                </button>
              </div>
            )}

            {/* Pure Visual Mode Toggle Button */}
            {onTogglePureVisualMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePureVisualMode();
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 backdrop-blur-md border transition-all shadow-lg ${
                  isPureVisualMode
                    ? 'bg-[#D9BE7D] text-neutral-950 border-[#F0DCA5] font-semibold'
                    : 'bg-neutral-900/80 border-neutral-700 text-neutral-300 hover:text-neutral-100'
                }`}
                title="切换纯视觉预览：隐藏所有方框、标签和测试文字，只保留纯净原图与动效"
              >
                {isPureVisualMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#D9BE7D]" />}
                <span>{isPureVisualMode ? '纯视觉 (开启)' : '纯视觉'}</span>
              </button>
            )}

            {/* Quick Preset Photo Switch */}
            {!isPureVisualMode && onLoadPresetPhoto && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadPresetPhoto();
                }}
                disabled={isAnalyzing}
                className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-neutral-900/80 border border-neutral-700 hover:border-[#D9BE7D]/60 text-neutral-300 hover:text-[#F0DCA5] backdrop-blur-md transition-all shadow flex items-center gap-1.5"
                title="重新载入预置图片并运行分析"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D9BE7D]" />
                <span className="hidden sm:inline">预置图片</span>
              </button>
            )}

            {/* BBOX Toggle (Hidden when in pure visual mode) */}
            {!isPureVisualMode && fishDetection && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBox((prev) => !prev);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 backdrop-blur-md border transition-all shadow-lg ${
                  showBox
                    ? 'bg-[#182020] border-[#D9BE7D]/60 text-[#F0DCA5]'
                    : 'bg-neutral-900/80 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                }`}
                title="切换显示/隐藏检测定位框"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D9BE7D]" />
                <span>{showBox ? '定位框' : '显示框'}</span>
              </button>
            )}
          </div>

          {/* Quick Tap-To-Focus Hint (Hidden in pure visual mode) */}
          {!isPureVisualMode && (
            <div className="absolute top-4 left-4 z-20 pointer-events-none">
              <div className="px-3 py-1 rounded-full bg-neutral-900/70 border border-neutral-800 backdrop-blur-md text-[11px] text-neutral-400 flex items-center gap-1.5 shadow">
                <Sparkles className="w-3 h-3 text-[#D9BE7D]" />
                <span>点击鱼身可快速重定位</span>
              </div>
            </div>
          )}

          {/* Bottom Frosted Capsule (Hidden in pure visual mode) */}
          {!isPureVisualMode && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
              <div className="px-5 py-3 rounded-full bg-neutral-900/90 border border-[#D9BE7D]/40 shadow-2xl backdrop-blur-xl flex items-center gap-3.5 min-w-[280px] transition-all">
                <div className="relative flex items-center justify-center flex-shrink-0">
                  <div className="w-7 h-7 rounded-full border-[2px] animate-spin border-[#D9BE7D]/20 border-t-[#D9BE7D]" />
                  <div className="absolute w-1.5 h-1.5 rounded-full bg-[#F0DCA5] shadow-[0_0_6px_#D9BE7D]" />
                </div>

                <div className="flex-1">
                  {isAnalyzing ? (
                    <>
                      <div className="text-xs font-semibold text-neutral-100">正在认识这条鱼</div>
                      <div className="text-[11px] text-neutral-400">分析鱼体特征与形态...</div>
                    </>
                  ) : effectBranch === 'WATER_RESONANCE' ? (
                    <>
                      <div className="text-xs font-semibold text-[#729E9B] flex items-center gap-1">
                        <Waves className="w-3.5 h-3.5 text-[#729E9B]" />
                        <span>Water Resonance · 湖面回响 V1</span>
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {currentTime < 300
                          ? '静默感知 · 水光初现'
                          : currentTime < 1650
                          ? '三次回响扩散 · 柔和折射波纹'
                          : currentTime < 2100
                          ? '光影凝结中 · 残光收敛'
                          : '完全静态 · 暖金残光稳定'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-[#F0DCA5] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#D9BE7D]" />
                        <span>Fish Contour Glow V1.1 · 真实轮廓金光</span>
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {currentTime < 1000
                          ? `0–1000ms: 核心描边生长中 (${Math.round((currentTime / 1000) * 100)}%)`
                          : currentTime < 1150
                          ? '1000–1150ms: 描边保持 · 柔光关闭'
                          : currentTime < 1400
                          ? '1150–1400ms: 基础柔光平滑淡入 (0%→12%)'
                          : '1400ms+: 基础柔光保持 · 运动柔光连续循环 (15%周长)'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
