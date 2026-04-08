import {
    Directive,
    ElementRef,
    OnDestroy,
    TemplateRef,
    inject,
    input,
    effect,
  } from '@angular/core';
  import {
    Overlay,
    OverlayRef,
    FlexibleConnectedPositionStrategy,
    ConnectedPosition,
  } from '@angular/cdk/overlay';
  import {
    ComponentPortal,
    TemplatePortal,
  } from '@angular/cdk/portal';
  import { ViewContainerRef } from '@angular/core';
  import { TooltipContentComponent } from '../../components/ui/tooltip/tooltip-content.component';
  
  export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'auto';
  
  @Directive({
    selector: '[appTooltip]',
    standalone: true,
    host: {
      '(mouseenter)': 'show()',
      '(mouseleave)': 'hide()',
      '(focusin)': 'show()',
      '(focusout)': 'hide()',
    },
  })
  export class TooltipDirective implements OnDestroy {
    appTooltip = input<string | TemplateRef<unknown> | null>(null);
    tooltipPosition = input<TooltipPosition>('auto');
    tooltipDisabled = input<boolean>(false);
    tooltipContext = input<unknown>(null); // context for TemplateRef
  
    private readonly overlay = inject(Overlay);
    private readonly elementRef = inject(ElementRef<HTMLElement>);
    private readonly viewContainerRef = inject(ViewContainerRef);
  
    private overlayRef: OverlayRef | null = null;
    private showTimeout: ReturnType<typeof setTimeout> | null = null;
    private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  
    constructor() {
      // If the tooltip changes while visible, update content
      effect(() => {
        const content = this.appTooltip();
        if (this.overlayRef?.hasAttached() && content) {
          this.updateContent();
        }
      });
    }
  
    show(): void {
      if (this.tooltipDisabled() || !this.appTooltip()) return;
  
      this.clearHideTimeout();
  
      this.showTimeout = setTimeout(() => {
        this.attach();
      }, 120); // small delay to avoid firing on fast hovers
    }
  
    hide(): void {
      this.clearShowTimeout();
  
      this.hideTimeout = setTimeout(() => {
        this.detach();
      }, 80);
    }
  
    private attach(): void {
      if (this.overlayRef?.hasAttached()) return;
  
      this.overlayRef = this.overlay.create({
        positionStrategy: this.buildPositionStrategy(),
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        panelClass: ['app-tooltip-panel', 'pointer-events-none'],
      });
  
      const content = this.appTooltip();
  
      if (typeof content === 'string') {
        // Mount the simple content component
        const portal = new ComponentPortal(
          TooltipContentComponent,
          this.viewContainerRef
        );
        const componentRef = this.overlayRef.attach(portal);
        componentRef.instance.text = content;
        componentRef.changeDetectorRef.detectChanges();
      } else if (content instanceof TemplateRef) {
        // Mount template with context
        const portal = new TemplatePortal(content, this.viewContainerRef, {
          $implicit: this.tooltipContext(),
        });
        this.overlayRef.attach(portal);
      }
    }
  
    private detach(): void {
      this.overlayRef?.detach();
      this.overlayRef?.dispose();
      this.overlayRef = null;
    }
  
    private updateContent(): void {
      // For strings, simply reattach; for TemplateRef CDK handles it
      this.detach();
      this.attach();
    }
  
    private buildPositionStrategy(): FlexibleConnectedPositionStrategy {
      const position = this.tooltipPosition();
      const positions: ConnectedPosition[] =
        position === 'auto'
          ? POSITIONS_AUTO
          : [POSITION_MAP[position], ...POSITIONS_AUTO.filter(p => p !== POSITION_MAP[position])];
  
      return this.overlay
        .position()
        .flexibleConnectedTo(this.elementRef)
        .withPositions(positions)
        .withPush(true) // if it doesn't fit, push inside the viewport
        .withViewportMargin(8);
    }
  
    private clearShowTimeout(): void {
      if (this.showTimeout !== null) {
        clearTimeout(this.showTimeout);
        this.showTimeout = null;
      }
    }
  
    private clearHideTimeout(): void {
      if (this.hideTimeout !== null) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    }
  
    ngOnDestroy(): void {
      this.clearShowTimeout();
      this.clearHideTimeout();
      this.detach();
    }
  }
  
  // ── CDK Positions ──────────────────────────────────────────────────────────
  
  const POSITION_MAP: Record<Exclude<TooltipPosition, 'auto'>, ConnectedPosition> = {
    top: {
      originX: 'center', originY: 'top',
      overlayX: 'center', overlayY: 'bottom',
      offsetY: -6, panelClass: 'tooltip--top',
    },
    'top-left': {
      originX: 'start', originY: 'top',
      overlayX: 'start', overlayY: 'bottom',
      offsetY: -6, panelClass: 'tooltip--top-left',
    },
    'top-right': {
      originX: 'end', originY: 'top',
      overlayX: 'end', overlayY: 'bottom',
      offsetY: -6, panelClass: 'tooltip--top-right',
    },
    bottom: {
      originX: 'center', originY: 'bottom',
      overlayX: 'center', overlayY: 'top',
      offsetY: 6, panelClass: 'tooltip--bottom',
    },
    'bottom-left': {
      originX: 'start', originY: 'bottom',
      overlayX: 'start', overlayY: 'top',
      offsetY: 6, panelClass: 'tooltip--bottom-left',
    },
    'bottom-right': {
      originX: 'end', originY: 'bottom',
      overlayX: 'end', overlayY: 'top',
      offsetY: 6, panelClass: 'tooltip--bottom-right',
    },
    left: {
      originX: 'start', originY: 'center',
      overlayX: 'end', overlayY: 'center',
      offsetX: -6, panelClass: 'tooltip--left',
    },
    right: {
      originX: 'end', originY: 'center',
      overlayX: 'start', overlayY: 'center',
      offsetX: 6, panelClass: 'tooltip--right',
    },
  };
  
  // Fallback order for 'auto': prefer top, then bottom, left, right
  const POSITIONS_AUTO: ConnectedPosition[] = [
    POSITION_MAP.top,
    POSITION_MAP.bottom,
    POSITION_MAP.right,
    POSITION_MAP.left,
  ];