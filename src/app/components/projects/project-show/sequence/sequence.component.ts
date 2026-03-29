import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ProjectsService } from '../../../../services/projects/projects.service';
import { IconComponent } from '../../../ui/icon/icon.component';
import { ActivityDrawerComponent } from '../../../ui/activity-drawer/activity-drawer.component';
import { DrawerService } from '../../../../services/ui/drawer.service';
import { Subscription } from 'rxjs';
import { OscService } from '../../../../services/osc.service';

@Component({
  selector: 'app-project-show-sequence',
  templateUrl: './sequence.component.html',
  standalone: true,
  imports: [CommonModule, IconComponent, ActivityDrawerComponent]
})
export class ProjectShowSequenceComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private projectsService = inject(ProjectsService);
  public drawerService = inject(DrawerService);
  private oscService = inject(OscService);

  readonly DRAWER_WIDTH = 500; // px
  
  public project: any;
  public projectUuid: string | null = null;
  private projectLoadedSubscription?: Subscription;

  ngOnInit(): void {
    this.route.parent?.params.subscribe(params => {
      this.projectUuid = params['uuid'];
      console.log('Sequence - Project UUID:', this.projectUuid);

      if (this.projectsService.projects().length === 0) {
        this.projectsService.getProjectList();
      }

      this.projectsService.loadProject(this.projectUuid);
    });

    this.projectLoadedSubscription = this.projectsService.projectLoaded.subscribe(projectData => {
      if (projectData) {
        const basicProjectData = this.projectsService.projects().find(p => p.uuid === this.projectUuid);
        if (basicProjectData) {
          if (!projectData.uuid) projectData.uuid = basicProjectData.uuid;
          if (!projectData.name) projectData.name = basicProjectData.name;
          if (!projectData.unix_name) projectData.unix_name = basicProjectData.unix_name;
          if (!projectData.created) projectData.created = basicProjectData.created;
          if (!projectData.modified) projectData.modified = basicProjectData.modified;
        }
        
        this.project = projectData;

        if (projectData?.CuemsScript?.CueList?.contents) {
          const namesMap: Record<string, string> = {};
          projectData.CuemsScript.CueList.contents.forEach((cueItem: any) => {
            const id = this.getCueId(cueItem);
            const name = this.getCueName(cueItem);
            if (id !== 'unknown') namesMap[id] = name;
          });
          this.oscService.cueNames.set(namesMap);
        }        
      }
    });
  }

  ngOnDestroy(): void {
    if (this.projectLoadedSubscription) {
      this.projectLoadedSubscription.unsubscribe();
    }
  }

  getCueId(cueItem: any): string {
    if (cueItem.AudioCue) return cueItem.AudioCue.id;
    else if (cueItem.VideoCue) return cueItem.VideoCue.id;
    else if (cueItem.ActionCue) return cueItem.ActionCue.id;
    else if (cueItem.DmxCue) return cueItem.DmxCue.id;
    return 'unknown';
  }

  getCueName(cueItem: any): string {
    if (cueItem.AudioCue) {
      return cueItem.AudioCue.name || 'Unnamed Audio Cue';
    } else if (cueItem.VideoCue) {
      return cueItem.VideoCue.name || 'Unnamed Video Cue';
    } else if (cueItem.ActionCue) {
      return cueItem.ActionCue.name || 'Unnamed Action Cue';
    } else if (cueItem.DmxCue) {
      return cueItem.DmxCue.name || 'Unnamed Dmx Cue';
    }
    return 'Unknown Cue';
  }

  getCueTypeIcon(cueItem: any): string {
    if (cueItem.AudioCue) return 'audio';
    if (cueItem.VideoCue) return 'video';
    if (cueItem.ActionCue) return 'action';
    if (cueItem.DmxCue) return 'dmx';
    return 'action';
  }

  getCuePrewait(cueItem: any): string {
    let cueData = null;
    if (cueItem.AudioCue) cueData = cueItem.AudioCue;
    else if (cueItem.VideoCue) cueData = cueItem.VideoCue;
    else if (cueItem.ActionCue) cueData = cueItem.ActionCue;
    else if (cueItem.DmxCue) cueData = cueItem.DmxCue;
    return cueData?.prewait?.CTimecode || '00:00:00.000';
  }

  getCuePostwait(cueItem: any): string {
    let cueData = null;
    if (cueItem.AudioCue) cueData = cueItem.AudioCue;
    else if (cueItem.VideoCue) cueData = cueItem.VideoCue;
    else if (cueItem.ActionCue) cueData = cueItem.ActionCue;
    else if (cueItem.DmxCue) cueData = cueItem.DmxCue;
    return cueData?.postwait?.CTimecode || '00:00:00.000';
  }

  getCueActionIcon(cueItem: any): string {
    let cueData = null;
    if (cueItem.AudioCue) cueData = cueItem.AudioCue;
    else if (cueItem.VideoCue) cueData = cueItem.VideoCue;
    else if (cueItem.ActionCue) cueData = cueItem.ActionCue;
    else if (cueItem.DmxCue) cueData = cueItem.DmxCue;
    const postGo = cueData?.post_go || 'pause';
    return 'post_go_' + postGo;
  }

  /**
   * Format order number with zero padding (0000)
   */
  formatOrderNumber(order: number): string {
    return order.toString().padStart(4, '0');
  }

  getCueDuration(cueItem: any): string {
    let cueData = null;
    if (cueItem.AudioCue) cueData = cueItem.AudioCue;
    else if (cueItem.VideoCue) cueData = cueItem.VideoCue;
    else if (cueItem.ActionCue) cueData = cueItem.ActionCue;
    else if (cueItem.DmxCue) cueData = cueItem.DmxCue;
    return cueData?.Media?.duration || '-';
  }

  getCuePlaybackClasses(cueItem: any): string {
    const cueId = this.getCueId(cueItem);
    const isNextCue = this.oscService.nextCue() === cueId;
    const status = this.oscService.getCueStatus(cueId);
    const isPlaying = status >= 1 && status < 100;
    const isPlayed = status === 100;
  
    //console.log('cueId:', cueId, 'status:', status, 'all statuses:', this.oscService.cueStatuses());

    if (isNextCue) {
      return 'hover:bg-primary transition-colors bg-primary-light text-dark-100 font-semibold';
    }
  
    if (isPlaying) {
      return 'hover:bg-secondary transition-colors bg-secondary-light text-dark-100 font-semibold';
    }
  
    if (isPlayed) {
      return 'hover:bg-dark-200 transition-colors opacity-40 text-gray-500';
    }
  
    // unplayed default
    return 'hover:bg-dark-200 transition-colors';
  }

  onClickSetNextCue(cueItem: any): void {
    const uuid = this.getCueId(cueItem);
    this.oscService.setNextCue(uuid);
  }  
}
