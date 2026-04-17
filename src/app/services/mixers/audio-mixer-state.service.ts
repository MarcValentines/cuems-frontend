import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioMixerStateService {
  private nodeVolumes = signal<Record<string, number>>({});
  private outputVolumes = signal<Record<string, number>>({});

  setNodeVolume(nodeUuid: string, volume: number): void {
    this.nodeVolumes.update(v => ({ ...v, [nodeUuid]: volume }));
  }

  getNodeVolume(nodeUuid: string): number {
    return this.nodeVolumes()[nodeUuid] ?? 100;
  }

  setOutputVolume(outputId: string, volume: number): void {
    this.outputVolumes.update(v => ({ ...v, [outputId]: volume }));
  }

  getOutputVolume(outputId: string): number {
    return this.outputVolumes()[outputId] ?? 100;
  }

  clear(): void {
    this.nodeVolumes.set({});
    this.outputVolumes.set({});
  }
}