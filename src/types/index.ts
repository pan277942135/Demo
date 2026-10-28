/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModelStatus = 'NOT_LOADED' | 'LOADING' | 'READY' | 'INFERENCE_RUNNING' | 'ERROR';

export type BackendDevice = 'webgpu' | 'wasm';

export interface PromptPoint {
  id: string;
  x: number; // in original image pixel coordinates
  y: number; // in original image pixel coordinates
  label: 1 | 0; // 1 = positive (include), 0 = negative (exclude)
}

export interface CandidateMask {
  index: number;
  iouScore: number;
  data: Uint8Array; // 0 or 255 binary mask
  pixelCount: number;
  areaRatio: number;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  isTrustworthy?: boolean;
}

export interface MaskResult {
  width: number;
  height: number;
  selectedCandidateIndex: number;
  candidates: CandidateMask[];
  inferenceTimeMs: number;
  timestamp: string;
  isMaskTrustworthy?: boolean;
  isBboxTrustworthy?: boolean;
  isFallbackActive?: boolean;
  fallbackReason?: string;
}

export interface ContourPoint {
  x: number;
  y: number;
}

export interface ContourData {
  points: ContourPoint[];
  simplifiedPoints: ContourPoint[];
  svgPath: string;
  totalLength: number;
  rawPointCount: number;
  simplifiedPointCount: number;
  extractionTimeMs: number;
}

export type ViewMode =
  | 'ORIGINAL'
  | 'MASK_OVERLAY'
  | 'BINARY_MASK'
  | 'CONTOUR_ONLY'
  | 'COMPOSITE';

export type EffectBranch = 'WATER_RESONANCE' | 'CLASSIC_GOLD_CONTOUR';

/**
 * 渔见 AI — Water Resonance 湖面回响高保真动效 V1 专用配置 (Section X)
 */
export interface WaterResonanceConfig {
  version: '1.0.0';
  durationMs: number; // 2600ms
  ambientColor: string; // #729E9B
  ambientAlpha: number; // 0.08
  rippleColor: string; // #D9BE7D
  rippleAlpha: number; // 0.18
  goldColor: string; // #F0DCA5
  goldAlpha: number; // 0.12
  residueColor: string; // #C8AE76
  residueAlpha: number; // 0.06
  fishFieldLengthRatio: number; // 0.88
  fishFieldWidthRatio: number; // 0.72
  softFeatherRatio: number; // 0.14
  wavefrontWidthRatio: number; // 0.015
  waveDistortionRatio: number; // 0.006
  pulseCount: number; // 3
  pulseStartTimes: number[]; // [300, 700, 1100]
  pulseDurations: number[]; // [550, 550, 550]
  pulseStartScales: number[]; // [0.42, 0.52, 0.60]
  pulseEndScales: number[]; // [0.80, 0.88, 0.95]
  pulsePeakAlphas: number[]; // [0.18, 0.14, 0.10]
  pulseColors: string[]; // ['#D9BE7D', '#E2CFA0', '#A7C8BF']
  freezeAtMs: number; // 2100ms
  geometryMode: 'TRUSTED_MASK' | 'BBOX_ONLY' | 'NO_GEOMETRY';
}

export interface GoldContourParams {
  coreLineWidth: number;      // 1.0 - 4.0 px (default 1.4)
  goldBrightness: number;     // 0.5 - 2.0 (default 1.0)
  softGlowIntensity: number;  // 0.2 - 2.5 (default 1.0)
  featherBlur: number;        // 1.0 - 12.0 px (default 5.0)
  rimGlowSpread: number;      // 8.0 - 36.0 px (default 18.0)
  bellyGlowBoost: number;     // 1.0 - 3.0 (default 1.6)
  strokeDuration: number;     // ms (default 550)
  sweepDuration: number;      // ms (default 650)
  coreColor: string;          // default #F0DCA5
  glowColor: string;          // default #D9BE7D
}

export interface SpeciesData {
  name: string;
  latinName: string;
  family: string;
  habitat: string;
  confidenceNote: string;
  isDemo: boolean;
}

export interface DiagnosticLog {
  modelId: string;
  device: BackendDevice;
  modelStatus: ModelStatus;
  loadDurationMs: number | null;
  inferenceDurationMs: number | null;
  imageDimensions: { width: number; height: number } | null;
  maskDimensions: { width: number; height: number } | null;
  maskPixelCount: number | null;
  maskAreaRatio: number | null;
  bbox: [number, number, number, number] | null;
  iouScore: number | null;
  contourVertices: number | null;
  simplifiedVertices: number | null;
  timelineDurationMs: number;
  verificationChecklist: { [key: string]: boolean | string };
  errorLog?: string;
  effectBranch?: EffectBranch;
  waterResonanceConfig?: WaterResonanceConfig;
}
