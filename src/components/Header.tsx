/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Cpu,
  Zap,
  Image as ImageIcon,
  Activity,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { BackendDevice, MaskResult, ModelStatus } from '../types';

interface HeaderProps {
  modelStatus: ModelStatus;
  activeDevice: BackendDevice;
  imageDims: { width: number; height: number } | null;
  maskResult: MaskResult | null;
  onOpenDiagnostics: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  modelStatus,
  activeDevice,
  imageDims,
  maskResult,
  onOpenDiagnostics,
}) => {
  const getStatusBadge = () => {
    switch (modelStatus) {
      case 'NOT_LOADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
            <span className="w-2 h-2 rounded-full bg-neutral-500" />
            模型未加载
          </span>
        );
      case 'LOADING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-700/50">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            权重加载中...
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            SAM就绪 (SlimSAM)
          </span>
        );
      case 'INFERENCE_RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-700/50">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            正在分割推理...
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-950/60 text-rose-300 border border-rose-700/50">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            加载/推理异常
          </span>
        );
    }
  };

  const selectedCandidate =
    maskResult && maskResult.candidates[maskResult.selectedCandidateIndex];

  return (
    <header className="bg-neutral-900/95 border-b border-neutral-800 px-4 py-3 sticky top-0 z-30 backdrop-blur">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-teal-500/20 border border-amber-500/30 flex items-center justify-center shadow-inner">
            <span className="text-amber-400 font-bold text-base tracking-tighter">渔</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-neutral-100 tracking-tight">
                Fish Mask &amp; Gold Contour Lab
              </h1>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                v1.0 独立实验舱
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              渔见 AI · 真实 SAM 鱼体分割 · 真实金色轮廓 · 鱼种自然转场
            </p>
          </div>
        </div>

        {/* Real-time Status Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Model status */}
          {getStatusBadge()}

          {/* Backend Device */}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-neutral-800/80 text-neutral-300 border border-neutral-700">
            {activeDevice === 'webgpu' ? (
              <Zap className="w-3.5 h-3.5 text-violet-400" />
            ) : (
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span className="font-mono uppercase">{activeDevice}</span>
          </span>

          {/* Photo Dimensions */}
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-neutral-800/80 text-neutral-300 border border-neutral-700">
            <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-mono">
              {imageDims ? `${imageDims.width}×${imageDims.height}` : '未载入照片'}
            </span>
          </span>

          {/* Inference Latency */}
          {maskResult && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-neutral-800/80 text-teal-300 border border-neutral-700">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-mono">{maskResult.inferenceTimeMs}ms</span>
            </span>
          )}

          {/* Mask Coverage */}
          {selectedCandidate ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-teal-950/50 text-teal-300 border border-teal-800/40">
              <Layers className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-mono">
                Mask ({(selectedCandidate.areaRatio * 100).toFixed(1)}%)
              </span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-neutral-800/50 text-neutral-500 border border-neutral-800">
              <Layers className="w-3.5 h-3.5" />
              无有效Mask
            </span>
          )}

          {/* Diagnostics Button */}
          <button
            onClick={onOpenDiagnostics}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 hover:border-neutral-600 transition-colors shadow-sm"
            title="查看完整测试诊断记录"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>诊断报告</span>
          </button>
        </div>
      </div>
    </header>
  );
};
