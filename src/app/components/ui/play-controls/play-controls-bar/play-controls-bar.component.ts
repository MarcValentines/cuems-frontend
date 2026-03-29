import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PlayControlsBase } from '../play-controls-base.component';
import { IconComponent } from '../../icon/icon.component';

@Component({
  selector: 'app-play-controls-bar-info',
  imports: [TranslateModule],
  template: `
    <span class="flex gap-2 shrink-0 px-4">
      <span>
        <span class="font-medium">{{ 'playControls.project' | translate }}:</span>
        <span class="text-primary ml-1">{{ oscService.loadedProject() || '—' }}</span>
      </span>
      <span>·</span>
      <span>
        <span class="font-medium">{{ 'playControls.timecode' | translate }}:</span>
        <span class="font-mono text-secondary tabular-nums ml-1">{{ timecodeDisplay }}</span>
      </span>
      <span>·</span>
      <span>
        <span class="font-medium">{{ 'playControls.status' | translate }}:</span>
        <span class="ml-1"
          [class.text-secondary]="oscService.running()"
          [class.text-gray-600]="!oscService.running()">
          {{ (oscService.running() ? 'playControls.playing' : 'playControls.stopped') | translate }}
        </span>
      </span>
      <span>·</span>
      <span>
        <span class="font-medium">{{ 'playControls.nextCue' | translate }}:</span>
        <span class="ml-1 text-primary">{{ oscService.cueNames()[oscService.nextCue() ?? ''] || oscService.nextCue() || '—' }}</span>
      </span>
    </span>
  `
})
export class PlayControlsBarInfoComponent extends PlayControlsBase {}

@Component({
  selector: 'app-play-controls-bar',
  imports: [TranslateModule, IconComponent, PlayControlsBarInfoComponent],
  templateUrl: './play-controls-bar.component.html'
})
export class PlayControlsBarComponent extends PlayControlsBase {}