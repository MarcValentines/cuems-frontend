import { Component, signal, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID, inject, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CdkDrag, CdkDragHandle, CdkDragEnd } from '@angular/cdk/drag-drop';
import { PlayControlsPanelComponent } from '../play-controls-panel/play-controls-panel.component';
import { PlayControlsBarComponent } from '../play-controls-bar/play-controls-bar.component';
import { IconComponent } from '../../icon/icon.component';

const STORAGE_KEY = 'play-controls-floating';
const PANEL_W = 340;
const PANEL_H = 300;

@Component({
  selector: 'app-play-controls-floating',
  standalone: true,
  imports: [CdkDrag, CdkDragHandle, PlayControlsPanelComponent, PlayControlsBarComponent, IconComponent],
  templateUrl: './play-controls-floating.component.html',
})
export class PlayControlsFloatingComponent implements OnInit, AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  @ViewChild('dragRef') dragRef!: CdkDrag;

  collapsed = signal(false);
  private savedPosition: { x: number; y: number } | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        this.collapsed.set(saved.collapsed ?? false);
        if (saved.x != null && saved.y != null) {
          this.savedPosition = { x: saved.x, y: saved.y };
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const pos = this.clampPosition(this.savedPosition ?? this.defaultPosition());
    setTimeout(() => {
      this.dragRef.setFreeDragPosition(pos);
    }, 0);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.removeEventListener('resize', this.onResize);
  }

  onDragEnded(event: CdkDragEnd): void {
    const pos = event.source.getFreeDragPosition();
    const clamped = this.clampPosition(pos);
    event.source.setFreeDragPosition(clamped);
    this.savedPosition = clamped;
    this.save();
  }

  toggle(): void {
    this.collapsed.update(v => !v);
    this.save();
  }

  private defaultPosition(): { x: number; y: number } {
    const x = window.innerWidth - PANEL_W - 24;
    const y = window.innerHeight - PANEL_H - 24;
    return { x, y };
  }

  private clampPosition(pos: { x: number; y: number }): { x: number; y: number } {
    return {
      x: Math.max(8, Math.min(pos.x, window.innerWidth - PANEL_W - 8)),
      y: Math.max(8, Math.min(pos.y, window.innerHeight - PANEL_H - 8)),
    };
  }

  private onResize = (): void => {
    const base = this.savedPosition ?? this.defaultPosition();
    const clamped = this.clampPosition(base);
    this.dragRef.setFreeDragPosition(clamped);
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      collapsed: this.collapsed(),
      x: this.savedPosition?.x ?? 0,
      y: this.savedPosition?.y ?? 0,
    }));
  }
}