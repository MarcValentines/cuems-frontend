import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PlayControlsBase } from '../play-controls-base.component';

@Component({
  selector: 'app-play-controls-panel',
  imports: [TranslateModule],
  templateUrl: './play-controls-panel.component.html'
})
export class PlayControlsPanelComponent extends PlayControlsBase {}