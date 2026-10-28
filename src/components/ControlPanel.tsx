/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Upload,
  Sparkles,
  Layers,
  Download,
  RefreshCw,
  Check,
  AlertTriangle,
  FileCheck,
  Fish,
  Zap,
  Eye,
  EyeOff,
  SunMedium,
  Waves,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import {
  BackendDevice,
  CandidateMask,
  ContourData,
  EffectBranch,
  GoldContourParams,
  MaskResult,
  ModelStatus,
  SpeciesData,
  ViewMode,
  WaterResonanceConfig,
} from '../types';
import { ModelProgressInfo } from '../services/samService';
import { FishDetection } from '../services/detectorService';
import { VisualModeSelection } from './CanvasViewport';
import { DEFAULT_WATER_RESONANCE_CONFIG } from './WaterResonanceRenderer';

interface ControlPanelProps {
  modelStatus: ModelStatus;
  activeDevice: BackendDevice;
  modelProgress: ModelProgressInfo | null;
  loadDurationMs: number | null;
  lastError: string | null;
  imageSrc: string | null;
  imageDims: { width: number; height: number } | null;
  maskResult: MaskResult | null;
  contourData: ContourData | null;
  fishDetection: FishDetection | null;
  viewMode: ViewMode;
  contourParams: GoldContourParams;
  speciesData: SpeciesData;
  simplificationTolerance: number;
  isAnalyzing: boolean;
  effectBranch?: EffectBranch;
  waterResonanceConfig?: WaterResonanceConfig;
  onSelectEffectBranch?: (branch: EffectBranch) => void;
  visualModeOverride?: VisualModeSelection;
  onSetVisualModeOverride?: (mode: VisualModeSelection) => void;
  isPureVisualMode?: boolean;
  onTogglePureVisualMode?: () => void;
  onLoadModel: (device: BackendDevice) => void;
  onImageUploaded: (file: File) => void;
  onLoadReferencePhoto?: () => void;
  onLoadPresetPhoto?: () => void;
  onClearImage: () => void;
  onRunRecognition: () => void;
  onSelectCandidate: (index: number) => void;
  onSetSimplificationTolerance: (val: number) => void;
  setViewMode: (mode: ViewMode) => void;
  onUpdateContourParams: (params: Partial<GoldContourParams>) => void;
  onUpdateSpeciesData: (data: Partial<SpeciesData>) => void;
  onPlayAnimation: () => void;
  onExportBinaryMask: () => void;
  onExportOverlayPng: () => void;
  onExportContourPng: () => void;
  onExportSvg: () => void;
  onExportConfigJson: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  modelStatus,
  activeDevice,
  modelProgress,
  loadDurationMs,
  lastError,
  imageSrc,
  maskResult,
  contourData,
  fishDetection,
  viewMode,
  contourParams,
  speciesData,
  simplificationTolerance,
  isAnalyzing,
  effectBranch = 'WATER_RESONANCE',
  waterResonanceConfig = DEFAULT_WATER_RESONANCE_CONFIG,
  onSelectEffectBranch,
  visualModeOverride = 'AUTO',
  onSetVisualModeOverride,
  isPureVisualMode = false,
  onTogglePureVisualMode,
  onLoadModel,
  onImageUploaded,
  onLoadPresetPhoto,
  onClearImage,
  onRunRecognition,
  onSelectCandidate,
  onSetSimplificationTolerance,
  setViewMode,
  onUpdateContourParams,
  onUpdateSpeciesData,
  onPlayAnimation,
  onExportBinaryMask,
  onExportOverlayPng,
  onExportContourPng,
  onExportSvg,
  onExportConfigJson,
}) => {
  const [activeTab, setActiveTab] = useState<'recognize' | 'glow' | 'species' | 'export'>('recognize');
  const [preferredDevice, setPreferredDevice] = useState<BackendDevice>('webgpu');

  const selectedCandidate: CandidateMask | undefined =
    maskResult?.candidates[maskResult.selectedCandidateIndex];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-800 bg-neutral-950/60 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('recognize')}
          className={`flex-1 min-w-[95px] py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'recognize'
              ? 'border-[#729E9B] text-[#729E9B] bg-neutral-900/50'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Waves className="w-3.5 h-3.5 text-[#729E9B]" />
          <span>鱼体识别</span>
        </button>

        <button
          onClick={() => setActiveTab('glow')}
          className={`flex-1 min-w-[95px] py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'glow'
              ? 'border-[#D9BE7D] text-[#F0DCA5] bg-neutral-900/50'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <SunMedium className="w-3.5 h-3.5 text-[#D9BE7D]" />
          <span>光影微调</span>
        </button>

        <button
          onClick={() => setActiveTab('species')}
          className={`flex-1 min-w-[90px] py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'species'
              ? 'border-[#91B9B2] text-[#91B9B2] bg-neutral-900/50'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Fish className="w-3.5 h-3.5 text-[#91B9B2]" />
          <span>鱼种信息</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 min-w-[80px] py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'export'
              ? 'border-blue-400 text-blue-300 bg-neutral-900/50'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>导出</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* TAB 1: 鱼体识别 (Recognize) */}
        {activeTab === 'recognize' && (
          <div className="space-y-4">
            {/* Effect Branch Selection Card: "新增一种效果分支，和原来的不相互影响" */}
            <div className="p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-[#729E9B]" />
                  <span>动效分支选择 (不相互影响)</span>
                </span>
                {onTogglePureVisualMode && (
                  <button
                    onClick={onTogglePureVisualMode}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                      isPureVisualMode
                        ? 'bg-[#D9BE7D] text-neutral-950 font-bold border-[#F0DCA5]'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
                    }`}
                  >
                    {isPureVisualMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-[#D9BE7D]" />}
                    <span>{isPureVisualMode ? '纯视觉 (开)' : '纯视觉预览'}</span>
                  </button>
                )}
              </div>

              {onSelectEffectBranch && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => onSelectEffectBranch('WATER_RESONANCE')}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      effectBranch === 'WATER_RESONANCE'
                        ? 'bg-[#729E9B]/20 border-[#729E9B] text-neutral-100 font-semibold shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[#729E9B]">
                      <Waves className="w-3.5 h-3.5" />
                      <span className="font-bold">湖面回响 V1 (新)</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Water Resonance · 自然水波回响与静默残光
                    </div>
                  </button>

                  <button
                    onClick={() => onSelectEffectBranch('CLASSIC_GOLD_CONTOUR')}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      effectBranch === 'CLASSIC_GOLD_CONTOUR'
                        ? 'bg-[#D9BE7D]/20 border-[#D9BE7D] text-neutral-100 font-semibold shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[#D9BE7D]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-bold">原版金色轮廓 V2</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      纤细金光轮廓与三波段扩散方案
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* When Water Resonance Branch is Active: Show Optics Inspector Card */}
            {effectBranch === 'WATER_RESONANCE' ? (
              <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-[#729E9B]/30 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#729E9B] font-semibold">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Water Resonance 固定参数表 (V1)</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#729E9B]/20 rounded text-[#729E9B] font-mono">
                    2600ms
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-neutral-300">
                  <div className="p-1.5 rounded bg-neutral-900/60 border border-neutral-800">
                    <span className="text-neutral-500">L1 环境水光:</span>{' '}
                    <span className="text-[#729E9B]">#729E9B (0.08)</span>
                  </div>
                  <div className="p-1.5 rounded bg-neutral-900/60 border border-neutral-800">
                    <span className="text-neutral-500">L4 暖金残光:</span>{' '}
                    <span className="text-[#C8AE76]">#C8AE76 (0.06)</span>
                  </div>
                  <div className="p-1.5 rounded bg-neutral-900/60 border border-neutral-800">
                    <span className="text-neutral-500">第一波 (300-850ms):</span>{' '}
                    <span className="text-[#D9BE7D]">42%→80% (0.18)</span>
                  </div>
                  <div className="p-1.5 rounded bg-neutral-900/60 border border-neutral-800">
                    <span className="text-neutral-500">第二波 (700-1250ms):</span>{' '}
                    <span className="text-[#E2CFA0]">52%→88% (0.14)</span>
                  </div>
                  <div className="p-1.5 rounded bg-neutral-900/60 border border-neutral-800 col-span-2">
                    <span className="text-neutral-500">第三波 (1100-1650ms):</span>{' '}
                    <span className="text-[#A7C8BF]">60%→95% (0.10)</span>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-400 leading-relaxed pt-1 border-t border-neutral-800/80">
                  五重高斯软体积光场，低频确定性扰动波前，2100ms后扩散完全消失，2100-2600ms严格稳定静态。
                </div>
              </div>
            ) : (
              /* When Classic Branch is Active: Show Classic Mode Switchers */
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
                <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D9BE7D]" />
                  <span>经典版视觉模式</span>
                </span>
                {onSetVisualModeOverride && (
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      onClick={() => onSetVisualModeOverride('AUTO')}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        visualModeOverride === 'AUTO'
                          ? 'bg-[#D9BE7D]/15 border-[#D9BE7D] text-[#F0DCA5] font-semibold'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="text-[11px]">智能门禁</div>
                    </button>
                    <button
                      onClick={() => onSetVisualModeOverride('FORCE_REAL')}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        visualModeOverride === 'FORCE_REAL'
                          ? 'bg-[#D9BE7D]/20 border-[#D9BE7D] text-[#F0DCA5] font-bold'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="text-[11px]">模式 A 真实</div>
                    </button>
                    <button
                      onClick={() => onSetVisualModeOverride('FORCE_VIRTUAL')}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        visualModeOverride === 'FORCE_VIRTUAL'
                          ? 'bg-[#91B9B2]/20 border-[#91B9B2] text-[#91B9B2] font-bold'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <div className="text-[11px]">模式 B 虚拟</div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Model Card */}
            <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#729E9B]" />
                    <span>端侧协同系统</span>
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    YOLOX 定位 + SlimSAM 分割
                  </p>
                </div>
                {/* Device Selector */}
                <div className="flex rounded-md bg-neutral-900 p-0.5 border border-neutral-800">
                  <button
                    onClick={() => setPreferredDevice('webgpu')}
                    disabled={modelStatus === 'LOADING'}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                      preferredDevice === 'webgpu'
                        ? 'bg-violet-600 text-white'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    WebGPU
                  </button>
                  <button
                    onClick={() => setPreferredDevice('wasm')}
                    disabled={modelStatus === 'LOADING'}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                      preferredDevice === 'wasm'
                        ? 'bg-blue-600 text-white'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    WASM
                  </button>
                </div>
              </div>

              {/* Detector Status Badge */}
              <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[11px] text-neutral-300 flex items-center justify-between">
                <span>1. 鱼体检测定位:</span>
                {fishDetection ? (
                  <span className="font-mono text-[#D9BE7D] font-bold">
                    已锁定 ({(fishDetection.confidence * 100).toFixed(1)}%)
                  </span>
                ) : (
                  <span className="text-neutral-400">待推理</span>
                )}
              </div>

              {/* SAM Status */}
              <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-300 flex items-center justify-between">
                <span>2. SlimSAM 像素级分割:</span>
                <span className="font-mono text-emerald-400">
                  {modelStatus === 'READY' ? '就绪' : modelStatus}
                </span>
              </div>

              {modelStatus !== 'READY' ? (
                <button
                  onClick={() => onLoadModel(preferredDevice)}
                  disabled={modelStatus === 'LOADING'}
                  className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-2 border border-neutral-700 transition-colors disabled:opacity-50"
                >
                  {modelStatus === 'LOADING' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#729E9B]" />
                      <span>正在载入 SAM 权重 ({modelProgress?.progress ?? 20}%)...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-[#729E9B]" />
                      <span>预载 SAM 模型</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>模型已就绪 ({activeDevice.toUpperCase()})</span>
                  </div>
                  {loadDurationMs && (
                    <span className="font-mono text-[11px] text-emerald-400">
                      {loadDurationMs}ms
                    </span>
                  )}
                </div>
              )}

              {lastError && (
                <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/50 text-[11px] text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="break-all">{lastError}</p>
                </div>
              )}
            </div>

            {/* Photo Upload Box */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                <span>鱼获照片</span>
                {imageSrc && (
                  <button
                    onClick={onClearImage}
                    className="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors"
                  >
                    更换/清空
                  </button>
                )}
              </label>

              <label className="w-full py-2.5 px-3 rounded-xl bg-neutral-800/90 hover:bg-neutral-700/90 border border-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm">
                <Upload className="w-4 h-4 text-[#729E9B]" />
                <span>{imageSrc ? '更换其他鱼获照片' : '上传本地鱼获照片 (JPG/PNG)'}</span>
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

              {onLoadPresetPhoto && (
                <button
                  type="button"
                  onClick={onLoadPresetPhoto}
                  disabled={isAnalyzing}
                  className="w-full py-2 px-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-[#D9BE7D]/40 hover:border-[#D9BE7D] text-[#F0DCA5] hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50 group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#D9BE7D] group-hover:rotate-12 transition-transform" />
                  <span>使用预置图片 (快速查看效果)</span>
                </button>
              )}
            </div>

            {/* Main Action: 认识这条鱼 */}
            <div className="pt-2">
              <button
                onClick={onRunRecognition}
                disabled={!imageSrc || isAnalyzing}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#729E9B] via-[#D9BE7D] to-[#729E9B] hover:opacity-95 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 shadow-xl shadow-teal-950/30 active:scale-[0.98]"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>正在认识这条鱼 · 分析特征中...</span>
                  </>
                ) : (
                  <>
                    <Waves className="w-4 h-4" />
                    <span>认识这条鱼 (启动水光扩散与回响)</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-neutral-400 text-center mt-2">
                Water Resonance: 静默感知 → 三次回响扩散 → 暖金残光凝结 (2600ms)
              </p>
            </div>

            {/* View Mode Quick Switcher */}
            {maskResult && (
              <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                <label className="text-[11px] font-medium text-neutral-400">
                  画布呈现模式
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: 'COMPOSITE', label: '原图+水光回响' },
                    { id: 'ORIGINAL', label: '原始照片' },
                    { id: 'MASK_OVERLAY', label: 'Mask 覆盖' },
                    { id: 'CONTOUR_ONLY', label: '纯水光场' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setViewMode(m.id as ViewMode)}
                      className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-colors ${
                        viewMode === m.id
                          ? 'bg-[#729E9B]/20 border-[#729E9B] text-[#729E9B]'
                          : 'bg-neutral-800/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 光影微调 (Glow & Optical Tuning) */}
        {activeTab === 'glow' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-neutral-950/70 border border-neutral-800 text-xs text-neutral-300 flex items-start gap-2">
              <SunMedium className="w-4 h-4 text-[#D9BE7D] flex-shrink-0 mt-0.5" />
              <span>
                微调规范指定的 <strong>Water (#729E9B)</strong>、<strong>Sun Gold (#D9BE7D)</strong> 与 <strong>Residue Gold (#C8AE76)</strong> 光学场。
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-300">纤细暖金 Core 线宽</span>
                  <span className="text-[#F0DCA5] font-mono">{contourParams.coreLineWidth.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={3.0}
                  step={0.1}
                  value={contourParams.coreLineWidth}
                  onChange={(e) => onUpdateContourParams({ coreLineWidth: parseFloat(e.target.value) })}
                  className="w-full accent-[#D9BE7D]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-300">柔光羽化 (Feather Blur)</span>
                  <span className="text-[#F0DCA5] font-mono">{contourParams.featherBlur.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  step={0.5}
                  value={contourParams.featherBlur}
                  onChange={(e) => onUpdateContourParams({ featherBlur: parseFloat(e.target.value) })}
                  className="w-full accent-[#D9BE7D]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-300">腹部与鳍膜光芒扩散</span>
                  <span className="text-[#F0DCA5] font-mono">{contourParams.rimGlowSpread} px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={32}
                  step={2}
                  value={contourParams.rimGlowSpread}
                  onChange={(e) => onUpdateContourParams({ rimGlowSpread: parseFloat(e.target.value) })}
                  className="w-full accent-[#D9BE7D]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-300">轮廓曲率平滑容差</span>
                  <span className="text-[#F0DCA5] font-mono">{simplificationTolerance.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={4.0}
                  step={0.2}
                  value={simplificationTolerance}
                  onChange={(e) => onSetSimplificationTolerance(parseFloat(e.target.value))}
                  className="w-full accent-[#D9BE7D]"
                />
              </div>
            </div>

            <button
              onClick={onPlayAnimation}
              className="w-full py-2.5 px-3 rounded-lg bg-[#729E9B] hover:bg-[#628b88] text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>重新播放完整 2600ms 动效</span>
            </button>
          </div>
        )}

        {/* TAB 3: 鱼种信息 (Species Data) */}
        {activeTab === 'species' && (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-neutral-400">鱼种名称 (可根据上传照片修改)</label>
              <input
                type="text"
                value={speciesData.name}
                onChange={(e) => onUpdateSpeciesData({ name: e.target.value })}
                className="w-full mt-1 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-100 focus:border-[#729E9B] outline-none font-medium"
                placeholder="例如：野生鲤鱼 (Common Carp)"
              />
            </div>

            <div>
              <label className="text-neutral-400">拉丁学名 (Binomial Name)</label>
              <input
                type="text"
                value={speciesData.latinName}
                onChange={(e) => onUpdateSpeciesData({ latinName: e.target.value })}
                className="w-full mt-1 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-100 focus:border-[#729E9B] outline-none font-serif italic"
                placeholder="例如：Cyprinus carpio"
              />
            </div>

            <div>
              <label className="text-neutral-400">科属分类</label>
              <input
                type="text"
                value={speciesData.family}
                onChange={(e) => onUpdateSpeciesData({ family: e.target.value })}
                className="w-full mt-1 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-100 focus:border-[#729E9B] outline-none"
                placeholder="例如：鲤形目 鲤科 鲤属"
              />
            </div>

            <div>
              <label className="text-neutral-400">生态特征描述</label>
              <textarea
                rows={3}
                value={speciesData.habitat}
                onChange={(e) => onUpdateSpeciesData({ habitat: e.target.value })}
                className="w-full mt-1 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-100 focus:border-[#729E9B] outline-none"
                placeholder="例如：水库晨钓捕获，体格健硕，腹鳍与尾鳍在晨曦中呈现天然金黄透光。"
              />
            </div>
          </div>
        )}

        {/* TAB 4: 导出 (Exports) */}
        {activeTab === 'export' && (
          <div className="space-y-3 text-xs">
            <h5 className="font-semibold text-neutral-300">导出数据产物</h5>

            <div className="space-y-2">
              <button
                onClick={onExportContourPng}
                disabled={!contourData && !fishDetection}
                className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium flex items-center justify-between transition-colors disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <Waves className="w-3.5 h-3.5 text-[#729E9B]" />
                  <span>下载最终效果图 (PNG)</span>
                </span>
                <Download className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              <button
                onClick={onExportBinaryMask}
                disabled={!selectedCandidate}
                className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium flex items-center justify-between transition-colors disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#729E9B]" />
                  <span>下载真实分割 Mask (PNG)</span>
                </span>
                <Download className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              <button
                onClick={onExportSvg}
                disabled={!contourData}
                className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium flex items-center justify-between transition-colors disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-3.5 h-3.5 text-[#D9BE7D]" />
                  <span>导出真实轮廓矢量路径 (SVG)</span>
                </span>
                <Download className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              <button
                onClick={onExportConfigJson}
                className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>导出测试参数与指标配置 (JSON)</span>
                </span>
                <Download className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
