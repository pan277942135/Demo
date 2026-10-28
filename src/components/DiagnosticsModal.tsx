/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Cpu,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';
import { DiagnosticLog } from '../types';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: DiagnosticLog;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fish-sam-diagnostic-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">
                系统运行诊断与验收核验报告
              </h3>
              <p className="text-[11px] text-neutral-400">
                渔见 AI · 真实 SAM 分割、金色轮廓与时间轴联动测试记录
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Key Runtime Metrics Table */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                推理模型 ID
              </div>
              <div className="text-xs font-mono font-semibold text-neutral-200 truncate">
                {diagnostics.modelId}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                实测运行后端
              </div>
              <div className="text-xs font-mono font-bold text-violet-400 uppercase">
                {diagnostics.device}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                模型初始化耗时
              </div>
              <div className="text-xs font-mono font-bold text-amber-400">
                {diagnostics.loadDurationMs !== null
                  ? `${diagnostics.loadDurationMs} ms`
                  : '未记录'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                实际分割推理耗时
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400">
                {diagnostics.inferenceDurationMs !== null
                  ? `${diagnostics.inferenceDurationMs} ms`
                  : '尚未运行'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                预测 IoU 质量分
              </div>
              <div className="text-xs font-mono font-bold text-teal-400">
                {diagnostics.iouScore !== null ? diagnostics.iouScore : 'N/A'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                真实轮廓矢量顶点
              </div>
              <div className="text-xs font-mono font-bold text-yellow-400">
                {diagnostics.simplifiedVertices !== null
                  ? `${diagnostics.simplifiedVertices} 顶点`
                  : 'N/A'}
              </div>
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>必检测试项执行状态记录 (Section 11 联合验收)</span>
            </h4>
            <div className="border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800/80 bg-neutral-950/40">
              {Object.entries(diagnostics.verificationChecklist).map(([key, val]) => (
                <div key={key} className="p-2.5 flex items-center justify-between">
                  <span className="text-neutral-300 font-medium">{key}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      val === true || val === 'PASS'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        : val === 'PENDING'
                        ? 'bg-neutral-800 text-neutral-400'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                    }`}
                  >
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error log if any */}
          {diagnostics.errorLog && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>运行错误信息:</span>
              </div>
              <p className="font-mono text-[11px] break-all">{diagnostics.errorLog}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-[11px] text-neutral-400">
            真实运行环境：浏览器端 ONNX Runtime + Transformers.js
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>已复制 JSON</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>复制报告</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载诊断报告</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
