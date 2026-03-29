import { inject } from '@angular/core';
import { OscService } from '../../../services/osc.service';

export abstract class PlayControlsBase {
  protected oscService = inject(OscService);

  get timecodeDisplay(): string {
    const ms = this.oscService.timecodeMs();
    return ms != null ? this.oscService.timecodeToHHMMSS(ms) : '--:--:--';
  }
}