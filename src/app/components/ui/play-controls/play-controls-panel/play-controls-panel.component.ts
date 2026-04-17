import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PlayControlsBase } from '../play-controls-base.component';
import { TooltipDirective } from '../../../../core/directives/tooltip.directive';

@Component({
  selector: 'app-play-controls-panel',
  imports: [TranslateModule, TooltipDirective],
  templateUrl: './play-controls-panel.component.html'
})
export class PlayControlsPanelComponent extends PlayControlsBase {}