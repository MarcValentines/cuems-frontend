import { Component, input, model, viewChild, ElementRef, HostListener, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

type Segment = 'hh' | 'mm' | 'ss' | 'mmm';

const SEGMENTS: Segment[] = ['hh', 'mm', 'ss', 'mmm'];
const SEGMENT_MAX: Record<Segment, number> = { hh: 23, mm: 59, ss: 59, mmm: 999 };
const SEGMENT_DIGITS: Record<Segment, number> = { hh: 2, mm: 2, ss: 2, mmm: 3 };

@Component({
  selector: 'app-timecode-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timecode-input.component.html'
})
export class TimecodeInputComponent {
  variant = input<'inline' | 'default'>('default');
  value = model<string>('00:00:00.000');

  private container = viewChild<ElementRef>('container');
  activeSegment = signal<Segment | null>(null);
  private buffer = '';

  private segments = signal({ hh: 0, mm: 0, ss: 0, mmm: 0 });

  display = computed(() => {
    const s = this.segments();
    return {
      hh: s.hh.toString().padStart(2, '0'),
      mm: s.mm.toString().padStart(2, '0'),
      ss: s.ss.toString().padStart(2, '0'),
      mmm: s.mmm.toString().padStart(3, '0'),
    };
  });

  constructor() {
    effect(() => {
      const parsed = this.parse(this.value());
      if (parsed) this.segments.set(parsed);
    });
  } 

  selectSegment(segment: Segment, event: MouseEvent): void {
    event.stopPropagation();
    this.activeSegment.set(segment);
    this.buffer = '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.container()?.nativeElement.contains(event.target)) {
      this.activeSegment.set(null);
      this.buffer = '';
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.activeSegment()) return;

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.handleDigit(event.key);
      return;
    }

    switch (event.key) {
      case 'ArrowUp':   event.preventDefault(); this.step(1); break;
      case 'ArrowDown': event.preventDefault(); this.step(-1); break;
      case 'Tab':
      case 'ArrowRight': event.preventDefault(); this.moveSegment(1); break;
      case 'ArrowLeft':  event.preventDefault(); this.moveSegment(-1); break;
      case 'Backspace':  event.preventDefault(); this.handleBackspace(); break;
      case 'Escape':
      case 'Enter': this.activeSegment.set(null); this.buffer = ''; break;
    }
  }

  private handleDigit(digit: string): void {
    const seg = this.activeSegment()!;
    this.buffer += digit;
    const val = Math.min(parseInt(this.buffer, 10), SEGMENT_MAX[seg]);
    this.segments.update(s => ({ ...s, [seg]: val }));
    if (this.buffer.length >= SEGMENT_DIGITS[seg]) {
      this.buffer = '';
      this.moveSegment(1);
    }
    this.emit();
  }

  private handleBackspace(): void {
    const seg = this.activeSegment()!;
    if (this.buffer.length > 0) {
      this.buffer = this.buffer.slice(0, -1);
    } else {
      this.segments.update(s => ({ ...s, [seg]: 0 }));
    }
    this.emit();
  }

  private step(dir: 1 | -1): void {
    const seg = this.activeSegment()!;
    const max = SEGMENT_MAX[seg];
    this.segments.update(s => {
      const next = s[seg] + dir;
      return { ...s, [seg]: next < 0 ? max : next > max ? 0 : next };
    });
    this.emit();
  }

  private moveSegment(dir: 1 | -1): void {
    this.buffer = '';
    const idx = SEGMENTS.indexOf(this.activeSegment()!);
    const next = idx + dir;
    this.activeSegment.set(next >= 0 && next < SEGMENTS.length ? SEGMENTS[next] : null);
  }

  private emit(): void {
    const d = this.display();
    this.value.set(`${d.hh}:${d.mm}:${d.ss}.${d.mmm}`);
  }

  private parse(value: string): { hh: number; mm: number; ss: number; mmm: number } | null {
    const match = value.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
    if (!match) return null;
    return {
      hh: parseInt(match[1]),
      mm: parseInt(match[2]),
      ss: parseInt(match[3]),
      mmm: parseInt(match[4])
    };
  }
}