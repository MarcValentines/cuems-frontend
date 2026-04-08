import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-tooltip-content',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `<span>{{ text }}</span>`,
  styles: [`
    app-tooltip-content {
      display: block;
      background: #000000;
      color: #ffffff;
      font-size: 0.75rem;
      padding: 5px 10px;
      border-radius: 4px;
      max-width: 260px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.06);
      animation: tooltip-in 120ms ease-out forwards;
    }
    @keyframes tooltip-in {
      from { opacity: 0; transform: scale(0.94); }
      to   { opacity: 1; transform: scale(1); }
    }
  `],
})
export class TooltipContentComponent {
  text = '';
}