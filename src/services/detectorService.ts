/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ort from 'onnxruntime-web';

export interface FishDetection {
  box: [number, number, number, number]; // [x1, y1, x2, y2] in original image pixel coordinates
  confidence: number;
  width: number;
  height: number;
  areaRatio: number;
}

class DetectorService {
  private session: ort.InferenceSession | null = null;
  private isLoaded = false;
  private isLoading = false;
  private inputSize = 416;
  private modelUrl = '/models/fish_detector_yolox_nano_v0_1.onnx';

  public isReady(): boolean {
    return this.isLoaded && this.session !== null;
  }

  public async loadModel(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return this.isLoaded;
    }

    this.isLoading = true;
    try {
      console.log('Loading YOLOX fish detector ONNX model from:', this.modelUrl);
      this.session = await ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      this.isLoaded = true;
      this.isLoading = false;
      console.log('YOLOX fish detector successfully loaded');
      return true;
    } catch (err) {
      console.error('Failed to load YOLOX fish detector:', err);
      this.isLoading = false;
      return false;
    }
  }

  /**
   * Run fish detection on HTMLImageElement, Canvas or ImageData
   */
  public async detect(
    imageSource: HTMLImageElement | HTMLCanvasElement
  ): Promise<FishDetection | null> {
    if (!this.isReady()) {
      const ok = await this.loadModel();
      if (!ok) return null;
    }

    const sourceW = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
    const sourceH = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

    if (!sourceW || !sourceH) return null;

    const inputSize = this.inputSize;
    const scale = Math.min(inputSize / sourceW, inputSize / sourceH);
    const drawW = Math.max(1, Math.floor(sourceW * scale));
    const drawH = Math.max(1, Math.floor(sourceH * scale));

    // Create offscreen canvas to extract resized RGB data
    const offscreen = document.createElement('canvas');
    offscreen.width = drawW;
    offscreen.height = drawH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(imageSource, 0, 0, drawW, drawH);
    const imgData = ctx.getImageData(0, 0, drawW, drawH);
    const rawRgba = imgData.data;

    // YOLOX preprocess: [1, 3, 416, 416] in BGR float32, letterbox fill 114
    const tensorData = new Float32Array(1 * 3 * inputSize * inputSize);
    tensorData.fill(114.0);

    for (let y = 0; y < drawH; y++) {
      for (let x = 0; x < drawW; x++) {
        const srcIdx = (y * drawW + x) * 4;
        const r = rawRgba[srcIdx];
        const g = rawRgba[srcIdx + 1];
        const b = rawRgba[srcIdx + 2];
        const dstIdx = y * inputSize + x;

        // BGR order
        tensorData[0 * inputSize * inputSize + dstIdx] = b;
        tensorData[1 * inputSize * inputSize + dstIdx] = g;
        tensorData[2 * inputSize * inputSize + dstIdx] = r;
      }
    }

    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, inputSize, inputSize]);
    const feeds: Record<string, ort.Tensor> = {};
    const inputName = this.session!.inputNames[0] || 'images';
    feeds[inputName] = inputTensor;

    const results = await this.session!.run(feeds);
    const outputName = this.session!.outputNames[0] || 'output';
    const output = results[outputName];
    const data = output.data as Float32Array;
    const numRows = output.dims[1];

    const rawDetections: FishDetection[] = [];

    for (let i = 0; i < numRows; i++) {
      const off = i * 6;
      const cx = data[off];
      const cy = data[off + 1];
      const w = data[off + 2];
      const h = data[off + 3];
      const obj = data[off + 4];
      const cls = data[off + 5];
      const conf = obj * cls;

      if (conf >= 0.2) {
        const x1 = Math.max(0, Math.round((cx - w / 2) / scale));
        const y1 = Math.max(0, Math.round((cy - h / 2) / scale));
        const x2 = Math.min(sourceW, Math.round((cx + w / 2) / scale));
        const y2 = Math.min(sourceH, Math.round((cy + h / 2) / scale));

        const bw = x2 - x1;
        const bh = y2 - y1;
        const areaRatio = (bw * bh) / (sourceW * sourceH);

        if (bw > 25 && bh > 25) {
          rawDetections.push({
            box: [x1, y1, x2, y2],
            confidence: parseFloat(conf.toFixed(4)),
            width: bw,
            height: bh,
            areaRatio: parseFloat(areaRatio.toFixed(4)),
          });
        }
      }
    }

    if (rawDetections.length === 0) return null;

    // Apply Non-Maximum Suppression (NMS) with IoU threshold 0.45
    rawDetections.sort((a, b) => b.confidence - a.confidence);
    const nmsDetections: FishDetection[] = [];

    const computeIoU = (boxA: [number, number, number, number], boxB: [number, number, number, number]) => {
      const xA = Math.max(boxA[0], boxB[0]);
      const yA = Math.max(boxA[1], boxB[1]);
      const xB = Math.min(boxA[2], boxB[2]);
      const yB = Math.min(boxA[3], boxB[3]);
      const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
      const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
      const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);
      return interArea / Math.max(1, boxAArea + boxBArea - interArea);
    };

    for (const det of rawDetections) {
      let keep = true;
      for (const selected of nmsDetections) {
        if (computeIoU(det.box, selected.box) > 0.45) {
          keep = false;
          break;
        }
      }
      if (keep) {
        nmsDetections.push(det);
      }
    }

    return nmsDetections[0] || null;
  }

  public async detectAll(
    imageSource: HTMLImageElement | HTMLCanvasElement
  ): Promise<FishDetection[]> {
    const single = await this.detect(imageSource);
    return single ? [single] : [];
  }
}

export const detectorService = new DetectorService();
