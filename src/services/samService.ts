/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SamModel,
  AutoProcessor,
  RawImage,
  env,
} from '@huggingface/transformers';
import {
  BackendDevice,
  CandidateMask,
  MaskResult,
  ModelStatus,
  PromptPoint,
} from '../types';
import { getLargestConnectedComponent } from '../utils/contourExtraction';

// Configure transformers.js for browser client execution
env.allowLocalModels = false;
env.useBrowserCache = true;

export const MODEL_ID = 'Xenova/slimsam-77-uniform';

export interface ModelProgressInfo {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

class SamService {
  private model: any = null;
  private processor: any = null;
  private status: ModelStatus = 'NOT_LOADED';
  private activeDevice: BackendDevice = 'wasm';
  private loadDurationMs: number | null = null;
  private lastError: string | null = null;

  // Cached state for current image to allow fast re-inference with points
  private currentRawImage: any = null;
  private currentImageDims: { width: number; height: number } | null = null;

  public getStatus(): ModelStatus {
    return this.status;
  }

  public getActiveDevice(): BackendDevice {
    return this.activeDevice;
  }

  public getLoadDuration(): number | null {
    return this.loadDurationMs;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public isModelReady(): boolean {
    return this.status === 'READY' && this.model !== null && this.processor !== null;
  }

  /**
   * Check if WebGPU is actually supported in the current browser runtime
   */
  public async isWebGpuSupported(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false;
    }
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  /**
   * Initialize and load the SlimSAM model into browser memory
   */
  public async loadModel(
    preferredDevice: BackendDevice = 'webgpu',
    onProgress?: (info: ModelProgressInfo) => void
  ): Promise<{ success: boolean; device: BackendDevice; durationMs: number; error?: string }> {
    this.status = 'LOADING';
    this.lastError = null;
    const startTime = performance.now();

    // Check device availability
    let targetDevice: BackendDevice = preferredDevice;
    if (preferredDevice === 'webgpu') {
      const webGpuAvail = await this.isWebGpuSupported();
      if (!webGpuAvail) {
        console.warn('WebGPU not available in current environment. Gracefully falling back to WASM.');
        targetDevice = 'wasm';
      }
    }

    try {
      onProgress?.({
        status: 'download',
        name: 'SAM Processor',
        file: 'preprocessor_config.json',
        progress: 10,
      });

      this.processor = await AutoProcessor.from_pretrained(MODEL_ID);

      onProgress?.({
        status: 'download',
        name: 'SlimSAM Model',
        file: 'encoder & decoder weights',
        progress: 35,
      });

      // Try loading model with target device
      try {
        this.model = await SamModel.from_pretrained(MODEL_ID, {
          device: targetDevice,
          dtype: targetDevice === 'webgpu' ? 'fp32' : 'q8',
          progress_callback: (p: any) => {
            if (onProgress) {
              onProgress({
                status: p.status,
                name: p.name || 'SlimSAM',
                file: p.file || '',
                progress: p.progress !== undefined ? Math.round(p.progress) : undefined,
                loaded: p.loaded,
                total: p.total,
              });
            }
          },
        });
        this.activeDevice = targetDevice;
      } catch (deviceErr: any) {
        if (targetDevice === 'webgpu') {
          console.warn('Failed loading on WebGPU, falling back to WASM:', deviceErr);
          targetDevice = 'wasm';
          this.model = await SamModel.from_pretrained(MODEL_ID, {
            device: 'wasm',
            dtype: 'q8',
            progress_callback: (p: any) => {
              if (onProgress) {
                onProgress({
                  status: p.status,
                  name: p.name || 'SlimSAM (WASM fallback)',
                  file: p.file || '',
                  progress: p.progress !== undefined ? Math.round(p.progress) : undefined,
                  loaded: p.loaded,
                  total: p.total,
                });
              }
            },
          });
          this.activeDevice = 'wasm';
        } else {
          throw deviceErr;
        }
      }

      this.status = 'READY';
      const endTime = performance.now();
      this.loadDurationMs = Math.round(endTime - startTime);

      onProgress?.({
        status: 'ready',
        name: MODEL_ID,
        progress: 100,
      });

      return {
        success: true,
        device: this.activeDevice,
        durationMs: this.loadDurationMs,
      };
    } catch (err: any) {
      console.error('Error loading SAM model:', err);
      this.status = 'ERROR';
      this.lastError = err?.message || String(err);
      return {
        success: false,
        device: targetDevice,
        durationMs: Math.round(performance.now() - startTime),
        error: this.lastError || undefined,
      };
    }
  }

  /**
   * Set and prepare image from HTMLImageElement or Blob/DataURL
   */
  public async setImage(imgSource: HTMLImageElement | string): Promise<{ width: number; height: number }> {
    let rawImg: any;

    if (typeof imgSource === 'string') {
      rawImg = await RawImage.fromURL(imgSource);
    } else {
      // Create canvas to extract RawImage from HTMLImageElement
      const canvas = document.createElement('canvas');
      canvas.width = imgSource.naturalWidth || imgSource.width;
      canvas.height = imgSource.naturalHeight || imgSource.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D canvas context');
      ctx.drawImage(imgSource, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      rawImg = new RawImage(imgData.data, canvas.width, canvas.height, 4);
    }

    this.currentRawImage = rawImg;
    this.currentImageDims = { width: rawImg.width, height: rawImg.height };
    return this.currentImageDims;
  }

  public clearImage(): void {
    this.currentRawImage = null;
    this.currentImageDims = null;
  }

  /**
   * Execute real SAM segmentation inference automatically, with an optional focal point or detection box
   */
  public async segment(
    focalOrPoints?: PromptPoint[] | { x: number; y: number },
    candidateIndexToSelect = 0,
    detectionBox?: [number, number, number, number]
  ): Promise<MaskResult> {
    if (!this.isModelReady()) {
      throw new Error('SAM 模型尚未加载完成，请先加载模型');
    }
    if (!this.currentRawImage || !this.currentImageDims) {
      throw new Error('尚未上传鱼获照片');
    }

    const { width, height } = this.currentImageDims;
    let points: PromptPoint[] = [];

    if (Array.isArray(focalOrPoints) && focalOrPoints.length > 0) {
      points = focalOrPoints;
    } else if (focalOrPoints && 'x' in focalOrPoints) {
      // User tapped a specific location on the fish
      const fx = focalOrPoints.x;
      const fy = focalOrPoints.y;
      points = [
        { id: 'focus-main', x: fx, y: fy, label: 1 },
        { id: 'focus-left', x: Math.max(10, Math.round(fx - width * 0.08)), y: fy, label: 1 },
        { id: 'focus-right', x: Math.min(width - 10, Math.round(fx + width * 0.08)), y: fy, label: 1 },
        { id: 'focus-top', x: fx, y: Math.max(10, Math.round(fy - height * 0.08)), label: 1 },
        { id: 'focus-bot', x: fx, y: Math.min(height - 10, Math.round(fy + height * 0.08)), label: 1 },
      ];
    } else if (detectionBox) {
      // Use bounding box from custom YOLOX fish detector
      const [bx1, by1, bx2, by2] = detectionBox;
      const bw = Math.max(20, bx2 - bx1);
      const bh = Math.max(20, by2 - by1);
      const bcx = Math.round((bx1 + bx2) / 2);
      const bcy = Math.round((by1 + by2) / 2);
      const isVertical = bh > bw * 1.15;

      if (isVertical) {
        // Vertical fish (like angler holding fish vertically)
        // Crucial: The top 15%-20% is the hand/lip-gripper, NOT the fish body!
        // Distribute positive points firmly along the fish torso and spine (28% to 88%)
        points = [
          { id: 'box-center', x: bcx, y: Math.round(by1 + bh * 0.56), label: 1 },
          { id: 'box-upper', x: bcx, y: Math.round(by1 + bh * 0.28), label: 1 },
          { id: 'box-mid-up', x: bcx, y: Math.round(by1 + bh * 0.44), label: 1 },
          { id: 'box-mid-down', x: bcx, y: Math.round(by1 + bh * 0.72), label: 1 },
          { id: 'box-lower', x: bcx, y: Math.round(by1 + bh * 0.88), label: 1 },
          // Lateral body points on the main fish flank
          { id: 'box-lat-left', x: Math.max(bx1 + 8, Math.round(bcx - bw * 0.22)), y: Math.round(by1 + bh * 0.55), label: 1 },
          { id: 'box-lat-right', x: Math.min(bx2 - 8, Math.round(bcx + bw * 0.22)), y: Math.round(by1 + bh * 0.55), label: 1 },
          // Negative point at top gripper/hand area above mouth
          { id: 'box-gripper-neg', x: bcx, y: Math.max(0, Math.round(by1 - 10)), label: 0 },
        ];
      } else {
        // Horizontal fish (laying down or held horizontally)
        // Distribute positive points along the horizontal spine
        points = [
          { id: 'box-center', x: bcx, y: bcy, label: 1 },
          { id: 'box-head', x: Math.round(bx1 + bw * 0.20), y: bcy, label: 1 },
          { id: 'box-mid-left', x: Math.round(bx1 + bw * 0.38), y: bcy, label: 1 },
          { id: 'box-mid-right', x: Math.round(bx1 + bw * 0.62), y: bcy, label: 1 },
          { id: 'box-tail', x: Math.round(bx1 + bw * 0.80), y: bcy, label: 1 },
          // Dorsal and ventral body points
          { id: 'box-dorsal', x: bcx, y: Math.max(by1 + 5, Math.round(bcy - bh * 0.2)), label: 1 },
          { id: 'box-ventral', x: bcx, y: Math.min(by2 - 5, Math.round(bcy + bh * 0.2)), label: 1 },
        ];
      }
    } else {
      // Automatic fish body center detection
      const cx = Math.round(width * 0.5);
      const cy = Math.round(height * 0.52);
      points = [
        { id: 'auto-center', x: cx, y: cy, label: 1 },
        { id: 'auto-body-left', x: Math.round(cx - width * 0.12), y: cy, label: 1 },
        { id: 'auto-body-right', x: Math.round(cx + width * 0.12), y: cy, label: 1 },
        { id: 'auto-body-top', x: cx, y: Math.round(cy - height * 0.1), label: 1 },
        { id: 'auto-body-bot', x: cx, y: Math.round(cy + height * 0.1), label: 1 },
      ];
    }

    this.status = 'INFERENCE_RUNNING';
    const startTime = performance.now();

    try {
      // Format points: [[[x1, y1], [x2, y2], ...]]
      // Format labels: [[label1, label2, ...]]
      const inputPoints = [points.map((p) => [p.x, p.y])];
      const inputLabels = [points.map((p) => p.label)];

      // 1. Process inputs through processor
      const inputs = await this.processor(this.currentRawImage, {
        input_points: inputPoints,
        input_labels: inputLabels,
      });

      // 2. Run model forward pass
      const outputs = await this.model(inputs);

      // 3. Post process masks to original image dimensions
      const postProcessedMasks = await this.processor.post_process_masks(
        outputs.pred_masks,
        inputs.original_sizes,
        inputs.reshaped_input_sizes
      );

      const endTime = performance.now();
      const inferenceTimeMs = Math.round(endTime - startTime);
      this.status = 'READY';

      const maskTensor = postProcessedMasks[0]; // [1, 3, height, width]
      const rawMaskData = maskTensor.data as Uint8Array; // 0 or 1
      const totalPixels = width * height;
      const numCandidates = 3;

      // Extract IoU scores
      const iouScoresData = outputs.iou_scores?.data || [0.95, 0.9, 0.85];

      const candidates: CandidateMask[] = [];

      for (let c = 0; c < numCandidates; c++) {
        const offset = c * totalPixels;
        const binaryMask = new Uint8Array(totalPixels);
        let pixelCount = 0;
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;

        let bx1 = 0, by1 = 0, bx2 = width, by2 = height;
        if (detectionBox) {
          // Generous safety margin (45%) to ensure long fins and tail are not artificially sliced
          const padX = Math.round((detectionBox[2] - detectionBox[0]) * 0.45);
          const padY = Math.round((detectionBox[3] - detectionBox[1]) * 0.45);
          bx1 = Math.max(0, detectionBox[0] - padX);
          by1 = Math.max(0, detectionBox[1] - padY);
          bx2 = Math.min(width, detectionBox[2] + padX);
          by2 = Math.min(height, detectionBox[3] + padY);
        }

        for (let i = 0; i < totalPixels; i++) {
          if (rawMaskData[offset + i] > 0) {
            const px = i % width;
            const py = Math.floor(i / width);

            // Clip pixels completely outside the generous fish box margin
            if (detectionBox && (px < bx1 || px > bx2 || py < by1 || py > by2)) {
              binaryMask[i] = 0;
              continue;
            }

            binaryMask[i] = 255;
            pixelCount++;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          } else {
            binaryMask[i] = 0;
          }
        }

        // Clean each candidate mask with LCC so isolated gripper or hand fragments are excluded
        const lcc = getLargestConnectedComponent(binaryMask, width, height);
        const cleanData = lcc.cleanMask;
        const validPixelCount = lcc.pixelCount;
        const validBbox = lcc.bbox;
        const areaRatio = totalPixels > 0 ? validPixelCount / totalPixels : 0;
        const iou = Number(iouScoresData[c] ?? 0.85);

        // Check if this candidate meets trustworthiness criteria
        let isTrustworthy = false;
        if (detectionBox && validPixelCount > 0) {
          const targetW = detectionBox[2] - detectionBox[0];
          const targetH = detectionBox[3] - detectionBox[1];
          const targetArea = targetW * targetH;
          const covRatio = validPixelCount / targetArea;
          const isVert = targetH > targetW * 1.1;
          const majorSpan = isVert
            ? (validBbox[3] - validBbox[1]) / Math.max(1, targetH)
            : (validBbox[2] - validBbox[0]) / Math.max(1, targetW);

          isTrustworthy = covRatio >= 0.18 && covRatio <= 0.85 && majorSpan >= 0.48 && iou >= 0.60;
        }

        candidates.push({
          index: c,
          iouScore: parseFloat(iou.toFixed(4)),
          data: cleanData,
          pixelCount: validPixelCount,
          areaRatio: parseFloat(areaRatio.toFixed(4)),
          bbox: validBbox,
          isTrustworthy,
        });
      }

      // Rank candidates to prefer complete whole-fish segmentation over tiny fragments
      if (detectionBox) {
        const targetW = detectionBox[2] - detectionBox[0];
        const targetH = detectionBox[3] - detectionBox[1];
        const targetArea = targetW * targetH;

        candidates.sort((a, b) => {
          // Coverage score: how close candidate area is to the expected fish body area
          const aCov = Math.min(a.pixelCount / Math.max(1, targetArea * 0.35), 1.0);
          const bCov = Math.min(b.pixelCount / Math.max(1, targetArea * 0.35), 1.0);

          // Span score: does the candidate span along the fish's major axis?
          const aSpan = Math.min((a.bbox[3] - a.bbox[1]) / Math.max(1, targetH * 0.7), 1.0) *
                        Math.min((a.bbox[2] - a.bbox[0]) / Math.max(1, targetW * 0.7), 1.0);
          const bSpan = Math.min((b.bbox[3] - b.bbox[1]) / Math.max(1, targetH * 0.7), 1.0) *
                        Math.min((b.bbox[2] - b.bbox[0]) / Math.max(1, targetW * 0.7), 1.0);

          const aScore = a.iouScore * 0.4 + aCov * 0.3 + aSpan * 0.3;
          const bScore = b.iouScore * 0.4 + bCov * 0.3 + bSpan * 0.3;

          return bScore - aScore;
        });
      } else {
        candidates.sort((a, b) => b.iouScore - a.iouScore);
      }

      return {
        width,
        height,
        selectedCandidateIndex: candidateIndexToSelect,
        candidates,
        inferenceTimeMs,
        timestamp: new Date().toLocaleTimeString(),
      };
    } catch (err: any) {
      this.status = 'READY';
      console.error('Inference error:', err);
      throw err;
    }
  }
}

export const samService = new SamService();
