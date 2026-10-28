/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  Sparkles,
  Sun,
  ShieldCheck,
  Eye,
  CheckCircle,
  Activity,
} from 'lucide-react';

interface TimelineControllerProps {
  currentTime: number; // 0 to 2600 ms+
  totalDuration?: number; // default 2600 ms
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (timeMs: number) => void;
  onReplay: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export const TimelineController: React.FC<TimelineControllerProps> = ({
  currentTime,
  totalDuration = 2600,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onReplay,
  onReset,
  disabled = false,
}) => {
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Section 6: "2600ms 主时间轴结束后，核心描边保持完整，柔光继续循环，直到用户暂停或重播。"
      // Advance time continuously during playback so the moving glow loop keeps cycling!
      const nextTime = currentTime + delta;
      onSeek(nextTime);

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, currentTime, onSeek]);

  // Phase information strictly matching Fish Contour Glow V1.1 specifications:
  // 0–1000ms: 阶段 1: 核心描边生长 (smoothstep真实弧长生长, 0ms无描边, 500ms半程, 1000ms全线闭合)
  // 1000–1150ms: 阶段 2: 描边静止保持 (全线稳定闭合，柔光关闭)
  // 1150–1400ms: 阶段 3: 基础柔光平滑淡入 (0% → 12%, 8 CSS px羽化)
  // 1400–2600ms+: 阶段 4: 运动柔光连续循环 (15%周长连续推进循环，峰值<=15%)
  const getPhaseInfo = (t: number) => {
    if (t < 1000) {
      return {
        id: 1,
        title: '核心描边生长',
        desc: '真实弧长smoothstep生长 · 0ms无描边 · 500ms半程 · 1000ms闭合',
        color: 'text-[#F0DCA5]',
        badge: '0–1000ms',
      };
    } else if (t < 1150) {
      return {
        id: 2,
        title: '描边静止保持',
        desc: '核心线保持完整85% · 柔光完全关闭',
        color: 'text-[#F0DCA5] font-semibold',
        badge: '1000–1150ms',
      };
    } else if (t < 1400) {
      return {
        id: 3,
        title: '基础柔光淡入',
        desc: '基础外围柔光平滑淡入 (0% → 12%) · 运动层暂不启动',
        color: 'text-[#D9BE7D]',
        badge: '1150–1400ms',
      };
    } else if (t <= 2600) {
      return {
        id: 4,
        title: '运动柔光连续循环',
        desc: '基础柔光保持12% · 15%轮廓柔光波连续无缝循环 (峰值≤15%)',
        color: 'text-[#D9BE7D] font-bold',
        badge: '1400–2600ms',
      };
    } else {
      return {
        id: 5,
        title: '主线完成 · 柔光继续循环',
        desc: '核心描边稳定保持 · 柔光继续连续循环直到暂停或重播',
        color: 'text-[#D9BE7D] font-bold',
        badge: `2600ms+ (${Math.round(t)}ms)`,
      };
    }
  };

  const activePhase = getPhaseInfo(currentTime);
  const sliderValue = Math.min(totalDuration, currentTime);
  const progressPercent = Math.min(100, Math.max(0, (sliderValue / totalDuration) * 100));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-xl">
      {/* Top Controls & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          {isPlaying ? (
            <button
              onClick={onPause}
              disabled={disabled}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-medium text-xs flex items-center gap-1.5 border border-neutral-700 transition-colors disabled:opacity-50"
              title="暂停 (冻结当前进度与相位)"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>暂停</span>
            </button>
          ) : (
            <button
              onClick={onPlay}
              disabled={disabled}
              className="px-3.5 py-1.5 rounded-lg bg-[#D9BE7D] hover:bg-[#cbb06e] text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
              title="播放动效 (从当前位置继续播放)"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>播放动效</span>
            </button>
          )}

          <button
            onClick={onReplay}
            disabled={disabled}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors disabled:opacity-50"
            title="从0ms从头重播 (重置描边与柔光相位)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onReset}
            disabled={disabled}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors disabled:opacity-50"
            title="重置到0ms并暂停"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Current Active Phase Readout */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 font-mono">
            {Math.round(currentTime)}ms / {totalDuration}ms
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-neutral-800/90 border border-neutral-700">
            <span className={`w-2 h-2 rounded-full bg-[#D9BE7D] ${isPlaying ? 'animate-pulse' : ''}`} />
            <span className={activePhase.color}>{activePhase.title}</span>
            <span className="text-neutral-400 font-mono text-[11px]">
              ({activePhase.badge})
            </span>
          </span>
        </div>
      </div>

      {/* Scrub Slider Bar with Strict Exclusive Phase Regions */}
      <div className="relative mb-3">
        <div className="relative h-2.5 w-full rounded-full bg-neutral-800 overflow-hidden flex">
          {/* Phase 1: 0–1000ms (38.5%): 核心描边生长 (柔光OFF) */}
          <div
            style={{ width: `${(1000 / totalDuration) * 100}%` }}
            className="h-full bg-[#F0DCA5]/25 border-r border-neutral-700/80"
            title="0–1000ms: 仅绘制核心描边，柔光彻底关闭"
          />
          {/* Phase 2: 1000–1150ms (5.7%): 描边静止保持 (柔光OFF) */}
          <div
            style={{ width: `${(150 / totalDuration) * 100}%` }}
            className="h-full bg-[#F0DCA5]/40 border-r border-neutral-700/80"
            title="1000–1150ms: 核心描边保持完整，柔光关闭"
          />
          {/* Phase 3: 1150–1400ms (9.6%): 基础柔光平滑淡入 (0%->12%) */}
          <div
            style={{ width: `${(250 / totalDuration) * 100}%` }}
            className="h-full bg-[#D9BE7D]/25 border-r border-neutral-700/80"
            title="1150–1400ms: 外围柔光淡入，运动层暂不启动"
          />
          {/* Phase 4: 1400–2600ms (46.2%): 运动柔光连续循环 */}
          <div
            style={{ width: `${(1200 / totalDuration) * 100}%` }}
            className="h-full bg-[#D9BE7D]/40"
            title="1400–2600ms+: 基础柔光保持，运动柔光连续循环"
          />

          {/* Filled Progress Bar */}
          <div
            style={{ width: `${progressPercent}%` }}
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#F0DCA5] via-[#D9BE7D] to-[#F0DCA5] opacity-90 pointer-events-none"
          />
        </div>

        {/* Range Input for continuous scrubbing */}
        <input
          type="range"
          min={0}
          max={totalDuration}
          step={10}
          value={sliderValue}
          disabled={disabled}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize disabled:cursor-not-allowed"
          title="拖拽时间轴进度"
        />
      </div>

      {/* 7 Quick Keyframe Jump Buttons strictly matching Section 7:
          0ms, 500ms, 1000ms, 1150ms, 1400ms, 2000ms, 2600ms */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {/* Keyframe 0ms */}
        <button
          onClick={() => onSeek(0)}
          className={`p-1.5 rounded-lg border text-left transition-all ${
            currentTime < 250
              ? 'bg-[#F0DCA5]/25 border-[#F0DCA5] text-[#F0DCA5]'
              : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title="0ms: 无描边，柔光关闭"
        >
          <div className="flex items-center gap-1 font-semibold text-[11px]">
            <Eye className="w-3 h-3 text-[#F0DCA5]" />
            <span>0ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">无描边</div>
        </button>

        {/* Keyframe 500ms */}
        <button
          onClick={() => onSeek(500)}
          className={`p-1.5 rounded-lg border text-left transition-all ${
            currentTime >= 250 && currentTime < 750
              ? 'bg-[#F0DCA5]/25 border-[#F0DCA5] text-[#F0DCA5]'
              : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title="500ms: 路径约绘制至一半 (smoothstep e(0.5)=0.5)"
        >
          <div className="flex items-center gap-1 font-semibold text-[11px]">
            <Activity className="w-3 h-3 text-[#F0DCA5]" />
            <span>500ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">半程生长</div>
        </button>

        {/* Keyframe 1000ms */}
        <button
          onClick={() => onSeek(1000)}
          className={`p-1.5 rounded-lg border text-left transition-all ${
            currentTime >= 750 && currentTime < 1080
              ? 'bg-[#F0DCA5]/25 border-[#F0DCA5] text-[#F0DCA5]'
              : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title="1000ms: 路径绘制完成闭合，柔光仍关闭"
        >
          <div className="flex items-center gap-1 font-semibold text-[11px]">
            <CheckCircle className="w-3 h-3 text-[#F0DCA5]" />
            <span>1000ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">描边完成</div>
        </button>

        {/* Keyframe 1150ms */}
        <button
          onClick={() => onSeek(1150)}
          className={`p-1.5 rounded-lg border text-left transition-all ${
            currentTime >= 1080 && currentTime < 1280
              ? 'bg-[#F0DCA5]/25 border-[#F0DCA5] text-[#F0DCA5]'
              : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title="1150ms: 完整描边静止保持，柔光即将启动"
        >
          <div className="flex items-center gap-1 font-semibold text-[11px]">
            <ShieldCheck className="w-3 h-3 text-[#F0DCA5]" />
            <span>1150ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">描边保持</div>
        </button>

        {/* Keyframe 1400ms */}
        <button
          onClick={() => onSeek(1400)}
          className={`p-1.5 rounded-lg border text-left transition-all ${
            currentTime >= 1280 && currentTime < 1700
              ? 'bg-[#D9BE7D]/25 border-[#D9BE7D] text-[#D9BE7D]'
              : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title="1400ms: 基础柔光淡入至12%，运动层开始启动"
        >
          <div className="flex items-center gap-1 font-semibold text-[11px]">
            <Sun className="w-3 h-3 text-[#D9BE7D]" />
            <span>1400ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">柔光启动</div>
        </button>

        {/* Keyframe 2000ms */}
        <button
          onClick={() => onSeek(2000)}
          className={`p-1.5 rounded-lg border text-left transition-all ${
            currentTime >= 1700 && currentTime < 2300
              ? 'bg-[#D9BE7D]/25 border-[#D9BE7D] text-[#D9BE7D]'
              : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title="2000ms: 运动柔光平滑游巡过半程"
        >
          <div className="flex items-center gap-1 font-semibold text-[11px]">
            <Sparkles className="w-3 h-3 text-[#D9BE7D]" />
            <span>2000ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">连续循环</div>
        </button>

        {/* Keyframe 2600ms */}
        <button
          onClick={() => onSeek(2600)}
          className={`p-1.5 rounded-lg border text-left transition-all ${
            currentTime >= 2300
              ? 'bg-[#D9BE7D]/25 border-[#D9BE7D] text-[#D9BE7D]'
              : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title="2600ms: 核心描边保持完整，柔光继续循环"
        >
          <div className="flex items-center gap-1 font-semibold text-[11px]">
            <ShieldCheck className="w-3 h-3 text-[#D9BE7D]" />
            <span>2600ms</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">终态循环</div>
        </button>
      </div>
    </div>
  );
};
