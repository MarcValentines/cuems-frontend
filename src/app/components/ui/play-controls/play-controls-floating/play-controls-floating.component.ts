import { Component, signal, OnInit, AfterViewInit, PLATFORM_ID, inject, ViewChild } from '@angular/core';
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
export class PlayControlsFloatingComponent implements OnInit, AfterViewInit {
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
      } catch {}
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const pos = this.savedPosition ?? this.defaultPosition();
    setTimeout(() => {
      this.dragRef.setFreeDragPosition(pos);
    }, 0);
  }

  private defaultPosition(): { x: number; y: number } {
    const x = window.innerWidth - PANEL_W - 24;
    const y = window.innerHeight - PANEL_H - 24;
    return { x, y };
  }

  onDragEnded(event: CdkDragEnd): void {
    const pos = event.source.getFreeDragPosition();
    const el = event.source.getRootElement();
    const h = el.offsetHeight;
  
    const clamped = {
      x: pos.x,
      y: Math.max(8, Math.min(pos.y, window.innerHeight - h - 8)),
    };
  
    event.source.setFreeDragPosition(clamped);
    this.savedPosition = clamped;
    this.save();
  }

  toggle(): void {
    this.collapsed.update(v => !v);
    this.save();
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      collapsed: this.collapsed(),
      x: this.savedPosition?.x ?? 0,
      y: this.savedPosition?.y ?? 0,
    }));
  }
}