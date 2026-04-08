import { Component, OnInit, OnDestroy, inject, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ProjectsService } from '../../../../services/projects/projects.service';
import { ProjectEditStateService } from '../../../../services/projects/project-edit-state.service';
import { MediaService } from '../../../../services/media/media.service';
import { IconComponent } from '../../../ui/icon/icon.component';
import { MultiselectComponent } from '../../../ui/multiselect/multiselect.component';
import { ActivityDrawerComponent } from '../../../ui/activity-drawer/activity-drawer.component';
import { DrawerService } from '../../../../services/ui/drawer.service';
import { TimecodeMaskDirective } from '../../../../core/directives';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { filter } from 'rxjs/operators';
import { ProjectWorkspaceService } from '../../../../services/project-workspace.service';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ConfirmationDialogComponent } from '../../../ui/confirmation-dialog/confirmation-dialog.component';

interface CueData {
  id: string | number;
  order: number;
  name: string;
  type: 'action' | 'audio' | 'video' | 'dmx';
  time: string;
  prewait: string;
  postwait: string;
  actionType: 'noContinue' | 'autoContinue' | 'autoFollow';
  post_go: string;
  loop: 'inf' | 'loop';
  loop_times: number; // -1 for infinite, positive number for specific times
  notes: string;
  expanded: boolean;
  activeTab: 'notes' | 'edit' | 'media';
  selectedMediaFile?: {uuid: string, file: any};
  selectedAudioOutput?: string;
  selectedVideoOutput?: string;
  selectedOutputs?: string[];
  dmx_channels?: Array<{channel: number, value: number}>;
  universe_num?: number;
  fade_in_time?: number;
  master_vol?: number;
  originalData?: any;
  action_target?: string | null;
  action_type?: string;
}

@Component({
  selector: 'app-sequence',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    IconComponent,
    TranslateModule,
    TimecodeMaskDirective,
    MultiselectComponent,
    ActivityDrawerComponent,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    ConfirmationDialogComponent
  ],
  templateUrl: './sequence.component.html',
  styleUrl: './sequence.component.css'
})
export class ProjectEditSequenceComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectsService = inject(ProjectsService);
  private editStateService = inject(ProjectEditStateService);
  private mediaService = inject(MediaService);
  private translateService = inject(TranslateService);
  public drawerService = inject(DrawerService);
  private subscription = new Subscription();
  workspace = inject(ProjectWorkspaceService);
  isConfirmDeleteOpen = false;
  cueToDeleteIndex: number | null = null;
  readonly DRAWER_WIDTH = 500; // px

  projectUuid: string | null = null;
  projectData: any = null;
  originalCues: CueData[] = [];
  hasUnsavedChanges = false;
  fileList: any[] = [];

  cues: CueData[] = [];

  hasProjectChanges = false;

  // Inline dropdown of action type
  openActionDropdown: number | null = null;

  readonly actionTypeOptions = [
    { value: 'pause', label: 'Auto pause', icon: 'post_go_pause' },
    { value: 'go', label: 'Auto continue', icon: 'post_go_go' },
    { value: 'go_at_end', label: 'Auto follow', icon: 'post_go_go_at_end' }
  ];

  // Inline editing
  editingPrewait: number | null = null;
  editingPostwait: number | null = null;

  ngOnInit() {
    this.route.parent?.params.subscribe(params => {
      this.projectUuid = params['uuid'];
      this.projectsService.loadProject(this.projectUuid);
    });

    this.subscription.add(
      this.projectsService.projectLoaded.subscribe(projectData => {
        this.projectData = projectData;
        this.loadProjectCues(projectData);
      })
    );

    this.subscription.add(
      this.editStateService.changes$.subscribe(hasChanges => {
        if (this.projectUuid) {
          this.hasProjectChanges = this.editStateService.hasProjectChanges(this.projectUuid);
          
          if (!this.hasProjectChanges && this.hasUnsavedChanges) {
            this.hasUnsavedChanges = false;
            this.originalCues = JSON.parse(JSON.stringify(this.cues));
          }
        }
      })
    );

    this.subscription.add(
      this.projectsService.projectSaved.subscribe(savedProjectUuid => {
        if (this.projectUuid && savedProjectUuid === this.projectUuid) {
          this.hasUnsavedChanges = false;
          this.originalCues = JSON.parse(JSON.stringify(this.cues));
          
          this.editStateService.clearTemporaryCues(this.projectUuid);
        }
      })
    );

    this.mediaService.getFileList();

    this.subscription.add(
      this.mediaService.fileListLoaded.subscribe(() => {
        this.rematchMediaFiles();
      })
    );

    this.loadInitialMappings();

    this.subscription.add(
      this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: NavigationEnd) => {
        if (this.hasUnsavedChanges && this.cues.length > 0) {
          this.saveTemporaryCues();
        }
      })
    );
  }

  ngOnDestroy() {
    if (this.projectUuid && this.cues.length > 0) {
      this.editStateService.saveTemporaryCues(this.projectUuid, this.cues, this.hasUnsavedChanges);

    }
    this.subscription.unsubscribe();
  }

  public saveTemporaryCues(): void {
    if (this.projectUuid && this.cues.length > 0) {
      this.editStateService.saveTemporaryCues(this.projectUuid, this.cues, this.hasUnsavedChanges);
    }
  }

  private loadProjectCues(projectData: any) {
    try {
      const expandedStates = this.saveExpandedStates();
      
      let shouldUseTemporaryCues = false;
      let temporaryCuesData = null;
      
      if (this.projectUuid) {
        temporaryCuesData = this.editStateService.getTemporaryCues(this.projectUuid);
        shouldUseTemporaryCues = temporaryCuesData !== null && temporaryCuesData.cues.length > 0;
      }
      
      if (shouldUseTemporaryCues && temporaryCuesData) {
        this.cues = JSON.parse(JSON.stringify(temporaryCuesData.cues));
        this.hasUnsavedChanges = temporaryCuesData.hasUnsavedChanges;
        
        this.restoreExpandedStates(expandedStates);
        
        this.originalCues = JSON.parse(JSON.stringify(this.cues));
      } else {
        if (projectData.CuemsScript?.['CueList']?.['contents']) {
          
          this.cues = this.transformCuesFromProject(projectData.CuemsScript['CueList']['contents']);

          this.restoreExpandedStates(expandedStates);
          
          this.originalCues = JSON.parse(JSON.stringify(this.cues)); 
        } else {
          this.cues = [];
          this.originalCues = [];
          this.hasUnsavedChanges = false;
        }
      }
    } catch (error) {
      this.cues = [];
      this.originalCues = [];
      this.hasUnsavedChanges = false;
    }

    this.loadInitialMappings();
  }

  private rematchMediaFiles(): void {
    const fileList = this.mediaService.fileList();
    if (!fileList || fileList.length === 0) return;

    let changed = false;
    for (const cue of this.cues) {
      if (cue.selectedMediaFile) continue;

      const cueTypeKey = this.getCueTypeKey(cue.originalData);
      const cueData = cueTypeKey ? cue.originalData[cueTypeKey] : null;
      if (!cueData?.Media?.file_name) continue;

      for (const fileObj of fileList) {
        const fileKeys = Object.keys(fileObj);
        if (fileKeys.length > 0) {
          const uuid = fileKeys[0];
          const file = fileObj[uuid];
          if (file && file.unix_name === cueData.Media.file_name) {
            cue.selectedMediaFile = { uuid, file };
            changed = true;
            break;
          }
        }
      }
    }

    if (changed) {
      this.originalCues = JSON.parse(JSON.stringify(this.cues));
    }
  }

  /**
   * Save the current expanded state of the cues
   */
  private saveExpandedStates(): Map<string, { expanded: boolean, activeTab: 'notes' | 'edit' | 'media' }> {
    const states = new Map<string, { expanded: boolean, activeTab: 'notes' | 'edit' | 'media' }>();
    
    this.cues.forEach(cue => {
      if (cue.expanded) {
        const stableKey = `${cue.order}_${cue.name}_${cue.type}`;
        states.set(stableKey, {
          expanded: cue.expanded,
          activeTab: cue.activeTab
        });
      }
    });
    
    return states;
  }

  private restoreExpandedStates(states: Map<string, { expanded: boolean, activeTab: 'notes' | 'edit' | 'media' }>) {
    this.cues.forEach(cue => {
      const stableKey = `${cue.order}_${cue.name}_${cue.type}`;
      const savedState = states.get(stableKey);
      
      if (savedState) {
        cue.expanded = savedState.expanded;
        cue.activeTab = savedState.activeTab;
      }
    });
  }

  /**
   * Transform the cues structure 
   */
  private transformCuesFromProject(projectCues: any[]): CueData[] {
    return projectCues.map((cueItem, index) => {
      let cueData: any = null;
      let cueType: 'action' | 'audio' | 'video' | 'dmx' = 'audio';

      if (cueItem.AudioCue) {
        cueData = cueItem.AudioCue;
        cueType = 'audio';
      } else if (cueItem.VideoCue) {
        cueData = cueItem.VideoCue;
        cueType = 'video';
      } else if (cueItem.ActionCue) {
        cueData = cueItem.ActionCue;
        cueType = 'action';
      } else if (cueItem.DmxCue) {
        cueData = cueItem.DmxCue;
        cueType = 'dmx';
      }

      if (!cueData) {
        return null;
      }

      // Extract media file information if it exists
      let selectedMediaFile: {uuid: string, file: any} | undefined;
      if (cueData.Media && cueData.Media.file_name) {
        // Search the file in the current list of files
        const fileList = this.mediaService.fileList();
        for (const fileObj of fileList) {
          const fileKeys = Object.keys(fileObj);
          if (fileKeys.length > 0) {
            const uuid = fileKeys[0];
            const file = fileObj[uuid];
            if (file && file.unix_name === cueData.Media.file_name) {
              selectedMediaFile = { uuid, file };
              break;
            }
          }
        }
      }

      let selectedAudioOutput: string | undefined = undefined;
      let selectedVideoOutput: string | undefined = undefined;
      let selectedOutputs: string[] = [];

      
      if (cueType === 'audio') {         
        let audioOutputs: string[] = [];
        
        if (cueData.AudioCueOutput?.output_name) {
          audioOutputs.push(cueData.AudioCueOutput.output_name);
        } else if (cueData.outputs && Array.isArray(cueData.outputs)) {
          for (const output of cueData.outputs) {
            if (output.AudioCueOutput?.output_name) {
              audioOutputs.push(output.AudioCueOutput.output_name);
            }
          }
        } else {
          for (const key in cueData) {
            if (cueData[key] && typeof cueData[key] === 'object' && cueData[key].output_name) {
              audioOutputs.push(cueData[key].output_name);
              break;
            }
          }
        }
        
        if (audioOutputs.length > 0) {
          const validOutputs: string[] = [];
          
          for (const audioOutput of audioOutputs) {
            const parsedOutput = this.projectsService.parseOutputString(audioOutput);
            if (parsedOutput) {
              const foundInCurrentMappings = this.projectsService.findOutputInMappings(parsedOutput.uuid, parsedOutput.name);
              if (foundInCurrentMappings) {
                validOutputs.push(audioOutput);
              }
            }
          }
          
          if (validOutputs.length > 0) {
            selectedOutputs = validOutputs;
            selectedAudioOutput = validOutputs[0];

          } else {
            const mappingsResponse = this.projectsService.initialMappings();
            const defaultOutput = mappingsResponse?.value?.default_audio_output;
            if (defaultOutput && this.audioMappingOptions.length > 0) {
              selectedAudioOutput = this.audioMappingOptions[0].value;
              selectedOutputs = [this.audioMappingOptions[0].value];
            } else {
              selectedOutputs = audioOutputs;
              selectedAudioOutput = audioOutputs[0];
            }
          }
        }
      } 
      
      if (cueType === 'video') {       
        let videoOutputs: string[] = [];
        
        if (cueData.VideoCueOutput?.output_name) {
          videoOutputs.push(cueData.VideoCueOutput.output_name);
        } else if (cueData.outputs && Array.isArray(cueData.outputs)) {
          for (const output of cueData.outputs) {
            if (output.VideoCueOutput?.output_name) {
              videoOutputs.push(output.VideoCueOutput.output_name);
            }
          }
        } else {
          for (const key in cueData) {
            if (cueData[key] && typeof cueData[key] === 'object' && cueData[key].output_name) {
              videoOutputs.push(cueData[key].output_name);
              break;
            }
          }
        }
        
        if (videoOutputs.length > 0) {
          const validOutputs: string[] = [];
          
          for (const videoOutput of videoOutputs) {
            const parsedOutput = this.projectsService.parseOutputString(videoOutput);
            if (parsedOutput) {
              const foundInCurrentMappings = this.projectsService.findOutputInMappings(parsedOutput.uuid, parsedOutput.name);
              if (foundInCurrentMappings) {
                validOutputs.push(videoOutput);
              }
            }
          }
          
          if (validOutputs.length > 0) {
            selectedOutputs = validOutputs;
            selectedVideoOutput = validOutputs[0];
          } else {
            const mappingsResponse = this.projectsService.initialMappings();
            const defaultOutput = mappingsResponse?.value?.default_video_output;
            if (defaultOutput && this.videoMappingOptions.length > 0) {
              selectedVideoOutput = this.videoMappingOptions[0].value;
              selectedOutputs = [this.videoMappingOptions[0].value];
            } else {
              selectedOutputs = videoOutputs;
              selectedVideoOutput = videoOutputs[0];
            }
          }
        }
      }

      let universe_num = 0;
      if (cueType === 'dmx' && cueData.DmxScene?.DmxUniverse?.universe_num) {
        universe_num = cueData.DmxScene.DmxUniverse.universe_num;
      }

      let dmx_channels: Array<{channel: number, value: number}> = [];
      if (cueType === 'dmx' && cueData.DmxScene?.DmxUniverse?.dmx_channels) {
        dmx_channels = cueData.DmxScene.DmxUniverse.dmx_channels.map((channelWrapper: any) => {
          const channelData = channelWrapper.DmxChannel || channelWrapper;
          const rawChannel = channelData.channel ?? 0;
          return {
            channel: rawChannel + 1,
            value: channelData.value || 0
          };
        });
      }

      return {
        id: cueData.id || index + 1,
        order: index + 1,
        name: cueData.name || `Cue ${index + 1}`,
        type: cueType,
        time: this.formatTimecode(cueData.offset?.CTimecode || '00:00:00.000'),
        prewait: this.formatTimecode(cueData.prewait?.CTimecode || '00:00:00.000'),
        postwait: this.formatTimecode(cueData.postwait?.CTimecode || '00:00:00.000'),
        actionType: this.determineActionType(cueData.post_go),
        post_go: cueData.post_go || 'pause',
        loop: this.determineLoopType(cueData.loop),
        loop_times: this.determineLoopTimes(cueData.loop),
        notes: cueData.description || '',
        expanded: false,
        activeTab: 'notes' as 'notes' | 'edit' | 'media',
        selectedMediaFile,
        selectedAudioOutput,
        selectedVideoOutput,
        selectedOutputs,
        dmx_channels,
        universe_num,
        fade_in_time: cueType === 'dmx' ? (() => { const ms = cueData.fadein_time ?? cueData.fade_in_time; return ms != null ? Number(ms) / 1000 : 0; })() : undefined,
        master_vol: cueData.master_vol || 20,
        action_target: cueType === 'action' ? (cueData.action_target || null) : undefined,
        action_type: cueType === 'action' ? (cueData.action_type || 'play') : undefined,
        originalData: cueItem // Keep original data
      };
    }).filter(cue => cue !== null) as CueData[];
  }

  /**
   * Format a timecode keeping the full format "00:00:00.000"
   */
  private formatTimecode(timecode: string): string {
    if (!timecode) return '00:00:00.000';
    // If it already has milliseconds, return it as is
    if (timecode.includes('.')) {
      return timecode;
    }
    // If it doesn't have milliseconds, add ".000"
    return `${timecode}.000`;
  }

  /**
   * Ensure that a timecode has milliseconds format
   */
  private ensureMilliseconds(timecode: string): string {
    if (!timecode) return '00:00:00.000';
    // If it already has milliseconds, return it as is
    if (timecode.includes('.')) {
      return timecode;
    }
    // If it doesn't have milliseconds, add ".000"
    return `${timecode}.000`;
  }

  /**
   * Determine the action type based on post_go
   */
  private determineActionType(postGo: string): 'noContinue' | 'autoContinue' | 'autoFollow' {
    switch (postGo) {
      case 'continue':
        return 'autoContinue';
      case 'follow':
        return 'autoFollow';
      default:
        return 'noContinue';
    }
  }

  /**
   * Determine the loop type based on the server value
   */
  private determineLoopType(loopValue: any): 'inf' | 'loop' {
    if (loopValue === -1 || loopValue === 0) {
      return 'inf';
    }
    return 'loop';
  }

  /**
   * Determine the number of times the loop
   */
  private determineLoopTimes(loopValue: any): number {
    if (loopValue === -1 || loopValue === 0) {
      return -1; // Infinite
    }
    return typeof loopValue === 'number' && loopValue > 0 ? loopValue : 1;
  }

  public onCueChange(): void {
    this.checkForChanges();
  }

  public clearUnsavedChangesState(): void {
    this.hasUnsavedChanges = false;
    this.originalCues = JSON.parse(JSON.stringify(this.cues));
    
    if (this.projectUuid) {
      this.editStateService.clearTemporaryCues(this.projectUuid);
    }
  }

  public checkForChanges(): void {
    this.hasUnsavedChanges = JSON.stringify(this.cues) !== JSON.stringify(this.originalCues);

    if (this.projectUuid) {
      this.editStateService.saveTemporaryCues(this.projectUuid, this.cues, this.hasUnsavedChanges);
    }

    if (this.projectUuid) {
      if (this.hasUnsavedChanges) {
        const cueListData = this.prepareCueListForSaving();
        this.editStateService.markComponentAsChanged('sequence', this.projectUuid, cueListData);
      } else {
        this.editStateService.markComponentAsSaved('sequence', this.projectUuid);
      }
    }
  }

  private prepareCueListForSaving(): any {
    const serverCues: any[] = [];

    for (let i = 0; i < this.cues.length; i++) {
      const cue = this.cues[i];
      const transformed = this.transformCueToServerFormat(cue);

      if (transformed !== null) {
        serverCues.push(transformed);
      }
    }

    return {
      contents: serverCues.length === 0 ? null : serverCues
    };
  }

  toggleTab(index: number, tab: 'notes' | 'edit' | 'media') {
    const cue = this.cues[index];
    if (cue.expanded && cue.activeTab === tab) {
      cue.expanded = false;
    } else {
      cue.expanded = true;
      cue.activeTab = tab;
    }
  }

  setActiveTab(index: number, tab: 'notes' | 'edit' | 'media') {
    this.cues[index].activeTab = tab;
  }

  collapseRow(index: number) {
    this.cues[index].expanded = false;
  }

  addCue(type: 'action' | 'audio' | 'video' | 'dmx') {
    const defaultNames = {
      action: this.translateService.instant('new.action'),
      audio: this.translateService.instant('new.audio'),
      video: this.translateService.instant('new.video'),
      dmx: this.translateService.instant('new.dmx')
    };

    const newCue: CueData = {
      id: this.generateUUID(),
      order: this.cues.length + 1, // Added at the end
      name: defaultNames[type],
      type: type,
      time: '00:00:00.000',
      prewait: '00:00:00.000',
      postwait: '00:00:00.000',
      actionType: 'noContinue',
      post_go: 'pause',
      loop: 'loop',
      loop_times: 1,
      notes: '',
      expanded: true,
      activeTab: 'edit' as 'notes' | 'edit' | 'media',
      selectedMediaFile: undefined,
    };

    newCue.selectedOutputs = [];
    
    if (this.audioMappingOptions.length === 0 || this.videoMappingOptions.length === 0) {
      this.loadInitialMappings();
    }
    
    const mappingsResponse = this.projectsService.initialMappings();
    let defaultAudioOutput = '';
    let defaultVideoOutput = '';
    
    if (mappingsResponse?.value) {
      defaultAudioOutput = mappingsResponse.value.default_audio_output || '';
      defaultVideoOutput = mappingsResponse.value.default_video_output || '';
    }
    
    if (type === 'audio') {
      const template = this.projectsService.projectTemplate();
      newCue.master_vol = template?.['CuemsScript']?.['CueList']?.['contents']?.find((item: any) => item.AudioCue)?.AudioCue?.master_vol || 20;
      if (this.audioMappingOptions.length > 0) {
        newCue.selectedAudioOutput = this.audioMappingOptions[0].value;
        newCue.selectedOutputs = [this.audioMappingOptions[0].value];
      } else if (defaultAudioOutput) {
        newCue.selectedAudioOutput = defaultAudioOutput;
        newCue.selectedOutputs = [defaultAudioOutput];
      } else {
        newCue.selectedOutputs = [];
      }
    }
    
    if (type === 'video') {
      if (this.videoMappingOptions.length > 0) {
        newCue.selectedVideoOutput = this.videoMappingOptions[0].value;
        newCue.selectedOutputs = [this.videoMappingOptions[0].value];
      } else if (defaultVideoOutput) {
        newCue.selectedVideoOutput = defaultVideoOutput;
        newCue.selectedOutputs = [defaultVideoOutput];
      } else {
        newCue.selectedOutputs = [];
      }
    }
    
    if (type === 'dmx') {
      const template = this.projectsService.projectTemplate();
      let initialChannels = [{
        channel: 1,
        value: 0
      }];
      
      if (template?.['CuemsScript']?.['CueList']?.['contents']) {
        const contents = template['CuemsScript']['CueList']['contents'];
        const dmxTemplate = contents.find((item: any) => item.DmxCue);
        
        if (dmxTemplate?.DmxCue?.DmxScene?.DmxUniverse?.dmx_channels) {
          initialChannels = dmxTemplate.DmxCue.DmxScene.DmxUniverse.dmx_channels.map((channelWrapper: any) => {
            const channelData = channelWrapper.DmxChannel || channelWrapper;
            const rawChannel = Number(channelData.channel ?? 0);
            return {
              channel: rawChannel + 1,
              value: Number(channelData.value || 0)
            };
          });
        }
      }
      
      newCue.dmx_channels = initialChannels;
      newCue.fade_in_time = 0;
    }

    if (type === 'action') {
      newCue.action_target = null;
      newCue.action_type = 'play';
    }
    
    if (type !== 'audio' && type !== 'video' && type !== 'dmx') {
      newCue.selectedOutputs = [];
    }
    
    const newCueIndex = this.cues.length;

    this.cues.push(newCue);

    this.cues.forEach((cue, i) => {
      cue.order = i + 1;
    });

    this.checkForChanges();

    setTimeout(() => {
      this.scrollToNewCue(newCueIndex);
    }, 100);
  }

  duplicateCue(index: number): void {
    const original = this.cues[index];
    
    const duplicate: CueData = {
      ...JSON.parse(JSON.stringify(original)),
      id: this.generateUUID(),
      name: this.getCopyName(original.name),
      expanded: false,
    };
  
    this.cues.splice(index + 1, 0, duplicate); // insert just below
  
    this.cues.forEach((cue, i) => {
      cue.order = i + 1;
    });
  
    this.checkForChanges();
  
    setTimeout(() => {
      this.scrollToNewCue(index + 1);
    }, 100);
  }

  private getCopyName(originalName: string): string {
    const base = originalName.replace(/\s-\sCopy(\s\(\d+\))?$/, '');
    const copies = this.cues.map(c => c.name).filter(n =>
      n === `${base} - Copy` || n.match(new RegExp(`^${base} - Copy \\((\\d+)\\)$`))
    );
    if (copies.length === 0) return `${base} - Copy`;
    const max = copies.reduce((acc, n) => {
      const match = n.match(/\((\d+)\)$/);
      return Math.max(acc, match ? parseInt(match[1]) : 1);
    }, 1);
    return `${base} - Copy (${max + 1})`;
  }

  /**
   * Move scroll to the new cue
   */
  private scrollToNewCue(cueIndex: number): void {
    const cueRow = document.querySelector(`[data-cue-index="${cueIndex}"]`) as HTMLElement;
    
    if (cueRow) {
      cueRow.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
      
      cueRow.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      cueRow.style.transition = 'background-color 0.3s ease';
      
      setTimeout(() => {
        cueRow.style.backgroundColor = '';
      }, 2000);
    }
  }


  saveChanges(): void {
    // Moved saving to the parent component
  }


  saveProject(): void {
    if (this.projectUuid && this.hasProjectChanges) {
      const modifiedData = this.editStateService.getProjectModifiedData(this.projectUuid);
      
      if (modifiedData && Object.keys(modifiedData).length > 0) {
        const updatedProject = JSON.parse(JSON.stringify(this.projectData));
        
        if (modifiedData.sequence) {
          if (!updatedProject.CuemsScript) {
            updatedProject.CuemsScript = {};
          }
          if (!updatedProject.CuemsScript.CueList) {
            const template = this.projectsService.projectTemplate();
            if (template?.['CuemsScript']?.['CueList']) {             
              updatedProject.CuemsScript.CueList = JSON.parse(JSON.stringify(template['CuemsScript']['CueList']));
              // Merge the ID and set contents as an empty array
              updatedProject.CuemsScript.CueList.id = this.generateUUID();
              updatedProject.CuemsScript.CueList.contents = [];
            } else {
              // Fallback
              updatedProject.CuemsScript.CueList = {
                autoload: false,
                description: null,
                enabled: true,
                id: this.generateUUID(),
                loop: 0,
                name: "empty",
                offset: { CTimecode: "00:00:00.000" },
                post_go: "pause",
                postwait: { CTimecode: "00:00:00.000" },
                prewait: { CTimecode: "00:00:00.000" },
                target: null,
                timecode: false,
                ui_properties: null,
                contents: []
              };
            }
          }
          
          if (modifiedData.sequence.contents === null) {
            updatedProject.CuemsScript.CueList.contents = null;
          } else if (Array.isArray(modifiedData.sequence.contents) && modifiedData.sequence.contents.length === 0) {
            updatedProject.CuemsScript.CueList.contents = null;
          } else {
            updatedProject.CuemsScript.CueList.contents = modifiedData.sequence.contents;
          }
          

          if (updatedProject.CuemsScript.CueList.contents) {
            updatedProject.CuemsScript.CueList.contents.forEach((cueItem: any, index: number) => {
              const cueKey = Object.keys(cueItem)[0];
              const cue = cueItem[cueKey];
              if (cueKey === 'AudioCue' && cue.AudioCueOutput) {

              } else if (cueKey === 'VideoCue' && cue.VideoCueOutput) {

              }
            });
          }
        }
        
        if (!updatedProject.uuid && this.projectUuid) {
          updatedProject.uuid = this.projectUuid;
        }
      
        this.projectsService.updateProject(updatedProject);
      }
    }
  }

  private transformCueToServerFormat(cue: CueData): any {
    const template = this.projectsService.projectTemplate();

    if (!template?.['CuemsScript']?.['CueList']?.['contents']) {
      return null;
    }

    const contents = template['CuemsScript']['CueList']['contents'];

    let templateCue: any = null;
    let cueTypeKey: string = '';

    for (const item of contents) {
      const itemKeys = Object.keys(item);
      if (cue.type === 'audio' && itemKeys.includes('AudioCue')) {
        templateCue = item['AudioCue'];
        cueTypeKey = 'AudioCue';
        break;
      } else if (cue.type === 'video' && itemKeys.includes('VideoCue')) {
        templateCue = item['VideoCue'];
        cueTypeKey = 'VideoCue';
        break;
      } else if (cue.type === 'action' && itemKeys.includes('ActionCue')) {
        templateCue = item['ActionCue'];
        cueTypeKey = 'ActionCue';
        break;
      } else if (cue.type === 'dmx' && itemKeys.includes('DmxCue')) {
        templateCue = item['DmxCue'];
        cueTypeKey = 'DmxCue';
        break;
      }
    }

    if (!templateCue) {
      return null;
    }

    const newCue = JSON.parse(JSON.stringify(templateCue));

    newCue.name = cue.name;
    newCue.description = cue.notes;
    newCue.id = cue.id && typeof cue.id === 'string' && cue.id.includes('-')  ? cue.id  : this.generateUUID();
    newCue.post_go = cue.post_go;
    newCue.offset = { CTimecode: this.ensureMilliseconds(cue.time) };
    newCue.prewait = { CTimecode: this.ensureMilliseconds(cue.prewait) };
    newCue.postwait = { CTimecode: this.ensureMilliseconds(cue.postwait) };

    // Assign loop: -1 for infinite, positive number for specific times
    newCue.loop = cue.loop === 'inf' ? -1 : cue.loop_times;

    if (cue.type === 'audio') {
      newCue.master_vol = cue.master_vol || 20;
    }

    // For ActionCue, delete Media if it exists in the template
    if (cue.type === 'action' && newCue.Media) {
      delete newCue.Media;
    }

    if (cue.type === 'action') {
      newCue.action_target = cue.action_target || null;
      newCue.action_type = cue.action_type || 'play';
    }    

    if (cue.type === 'audio' || cue.type === 'video') {
      if (newCue.Media) {
        if (cue.selectedMediaFile && cue.selectedMediaFile.file.unix_name) {
          newCue.Media = {
            file_name: cue.selectedMediaFile.file.unix_name,
            id: cue.selectedMediaFile.uuid,
            duration: '00:00:00.000',
            regions: [
              {
                Region: {
                  id: 0,
                  loop: 1,
                  in_time: { CTimecode: "00:00:00.000" },
                  out_time: { CTimecode: "00:00:00.000" }
                }
              }
            ]
          };
        } else {
          delete newCue.Media;
        }
      }

      if (cue.type === 'audio') {
        let selectedOutputs: string[] = [];
        
        if (cue.selectedOutputs && Array.isArray(cue.selectedOutputs) && cue.selectedOutputs.length > 0) {
          selectedOutputs = cue.selectedOutputs;
        } else if (cue.selectedAudioOutput) {
          selectedOutputs = [cue.selectedAudioOutput];
        }

        this.assignMultipleAudioOutputs(newCue, selectedOutputs);
      } else if (cue.type === 'video') {
        let selectedOutputs: string[] = [];
        
        if (cue.selectedOutputs && Array.isArray(cue.selectedOutputs) && cue.selectedOutputs.length > 0) {
          selectedOutputs = cue.selectedOutputs;
        } else if (cue.selectedVideoOutput) {
          selectedOutputs = [cue.selectedVideoOutput];
        }
        
        this.assignMultipleVideoOutputs(newCue, selectedOutputs);
      }
    }

    // Handle DMX channels - only for dmx cues
    if (cue.type === 'dmx') {
      if (cue.dmx_channels && cue.dmx_channels.length > 0) {
        if (!newCue.DmxScene) {
          newCue.DmxScene = {
            DmxUniverse: {
              dmx_channels: [],
              universe_num: cue.universe_num ?? 0
            },
            id: 0
          };
        }
        if (!newCue.DmxScene.DmxUniverse) {
          newCue.DmxScene.DmxUniverse = {
            dmx_channels: [],
            universe_num: cue.universe_num ?? 0
          };
        }
        
        // Assign the DMX channels: UI is 1-based (1–512), project/engine/dmxplayer use 0-based buffer index (OLA channel 1 = index 0)
        newCue.DmxScene.DmxUniverse.dmx_channels = cue.dmx_channels.map(ch => ({
          DmxChannel: {
            channel: Math.max(0, Number(ch.channel) - 1),
            value: Number(ch.value)
          }
        }));
        
        newCue.DmxScene.DmxUniverse.universe_num = cue.universe_num ?? 0;
      } else {
        if (newCue.DmxScene && newCue.DmxScene.DmxUniverse) {
          newCue.DmxScene.DmxUniverse.dmx_channels = [];
          newCue.DmxScene.DmxUniverse.universe_num = cue.universe_num ?? 0;
        }
      }
      newCue.fadein_time = Math.round((cue.fade_in_time ?? 0) * 1000);
    }

    const result = { [cueTypeKey]: newCue };
    
    return result;
  }


  private generateUUID(): string {
    return uuidv4();
  }

  /**
   * Reorder cues
   */
  onDrop(event: CdkDragDrop<CueData[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.cues, event.previousIndex, event.currentIndex);

      this.updateCueOrders();

      this.checkForChanges();
    }
  }

  private updateCueOrders(): void {
    this.cues.forEach((cue, index) => {
      cue.order = index + 1;
    });
  }

  public shouldShowWarningIcon(cue: CueData): boolean {
    // Only for audio/video, no action, no dmx
    if ((cue.type === 'action') || (cue.type === 'dmx')) return false;

    // If there is a media file selected, no show warning
    if (cue.selectedMediaFile) return false;

    let warning = null;
    if (cue.originalData?.AudioCue?.ui_properties?.warning !== undefined) {
      warning = cue.originalData.AudioCue.ui_properties.warning;
    } else if (cue.originalData?.VideoCue?.ui_properties?.warning !== undefined) {
      warning = cue.originalData.VideoCue.ui_properties.warning;
    }

    // Show if it is null or 2
    return warning === null || warning === 2;
  }

  public getCueTypeKey(originalData: any): string | null {
    if (!originalData) return null;
    
    const keys = Object.keys(originalData);
    const cueTypeKeys = keys.filter(key => 
      key === 'AudioCue' || key === 'VideoCue' || key === 'ActionCue' || key === 'DmxCue'
    );
    
    return cueTypeKeys[0] || null;
  }

  public getCueData(originalData: any): any {
    const cueTypeKey = this.getCueTypeKey(originalData);
    return cueTypeKey ? originalData[cueTypeKey] : null;
  }

  public onLoopTypeChange(cue: CueData): void {
    if (cue.loop === 'inf') {
      cue.loop_times = -1;
    } else {
      // If it changes to 'loop', set a default value if it is -1
      if (cue.loop_times === -1) {
        cue.loop_times = 1;
      }
    }
    this.checkForChanges();
  }

  public getMediaFilesByType(type: 'audio' | 'video'): Array<{uuid: string, file: any}> {
    return this.mediaService.getFilesByType(type);
  }

  public onMasterVolumeChange(cue: CueData, value: number): void {
    cue.master_vol = value;
    this.checkForChanges();
  }

  public onMediaFileSelect(cue: CueData, uuid: string): void {
    const files = this.getMediaFilesByType(cue.type as 'audio' | 'video');
    const selectedFile = files.find(f => f.uuid === uuid);
    
    if (selectedFile) {
      cue.selectedMediaFile = selectedFile;
      this.checkForChanges();
    }
  }

  public onMediaFileSelectFromEvent(cue: CueData, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const uuid = target?.value || '';
    this.onMediaFileSelect(cue, uuid);
  }

  public getSelectedMediaFileName(cue: CueData): string {
    if (cue.selectedMediaFile) {
      return cue.selectedMediaFile.file.name;
    }
    return '';
  }

  public hasMediaFileSelected(cue: CueData): boolean {
    return !!(cue.selectedMediaFile && cue.selectedMediaFile.file.unix_name);
  }

  @HostListener('document:click')
  closeDropdown(): void {
    this.openActionDropdown = null;
  }

  toggleActionDropdown(i: number, event: Event) {
    event.stopPropagation();
    this.openActionDropdown = this.openActionDropdown === i ? null : i;
  }

  selectActionType(i: number, value: string) {
    this.cues[i].post_go = value;
    this.checkForChanges();
    this.openActionDropdown = null;
  }

  onDropdownClick(event: Event) {
    event.stopPropagation();
  }

  getActionTypeLabel(value: string): string {
    const found = this.actionTypeOptions.find(opt => opt.value === value);
    return found ? found.label : '';
  }

  /**
   * Starts inline editing of prewait
   */
  startEditPrewait(index: number, event: Event): void {
    event.stopPropagation();
    this.editingPrewait = index;
  }

  /**
   * Starts inline editing of postwait
   */
  startEditPostwait(index: number, event: Event): void {
    event.stopPropagation();
    this.editingPostwait = index;
  }

  /**
   * Finishes inline editing
   */
  finishEdit(): void {
    this.editingPrewait = null;
    this.editingPostwait = null;
    this.checkForChanges();
  }

  /**
   * Close the inlineediting when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Only close if there is some editing active
    if (this.editingPrewait !== null || this.editingPostwait !== null) {
      const target = event.target as HTMLElement;
      if (!target.closest('input[type="text"]')) {
        this.finishEdit();
      }
    }
  }

  onInputClick(event: Event): void {
    event.stopPropagation();
  }

  public reloadCuesFromProject(): void {
    if (this.projectData) {
      if (this.projectUuid) {
        this.editStateService.clearTemporaryCues(this.projectUuid);
      }
      
      this.loadProjectCues(this.projectData);
    }
  }

  mappingOptions: { value: string, label: string }[] = [];
  audioMappingOptions: { value: string, label: string }[] = [];
  videoMappingOptions: { value: string, label: string }[] = [];

  getMappingOptionsForCue(cue: CueData): { value: string, label: string }[] {
    let options: { value: string, label: string }[] = [];
    
    if (cue.type === 'audio') {
      options = this.audioMappingOptions;
    }
    
    if (cue.type === 'video') {
      options = this.videoMappingOptions;
    }
    
    return options;
  }

  getSelectedOutputsForCue(cue: CueData): string[] {
    let selectedValues: string[] = [];
    
    if (cue.selectedOutputs && cue.selectedOutputs.length > 0) {
      selectedValues = cue.selectedOutputs;
    } else if (cue.type === 'audio' && cue.selectedAudioOutput) {
      selectedValues = [cue.selectedAudioOutput];
    } else if (cue.type === 'video' && cue.selectedVideoOutput) {
      selectedValues = [cue.selectedVideoOutput];
    }
    
    return selectedValues;
  }

  getPlaceholderForCue(cue: CueData): string {
    if (cue.type === 'audio') {
      return 'Selecciona salidas de audio';
    } else if (cue.type === 'video') {
      return 'Selecciona salidas de video';
    }
    return 'Selecciona opciones';
  }

  onOutputSelectionChange(selectedValues: string[], cue: CueData): void { 
    // Fallback for maintaining one by default
    if (!selectedValues || selectedValues.length === 0) {    
      // Use the first available output as fallback
      if (cue.type === 'audio' && this.audioMappingOptions.length > 0) {
        selectedValues = [this.audioMappingOptions[0].value];
      } else if (cue.type === 'video' && this.videoMappingOptions.length > 0) {
        selectedValues = [this.videoMappingOptions[0].value];
      }
    }
    
    cue.selectedOutputs = selectedValues || [];
    
    if (cue.type === 'audio') {
      cue.selectedAudioOutput = selectedValues && selectedValues.length > 0 ? selectedValues[0] : undefined;
    } else if (cue.type === 'video') {
      cue.selectedVideoOutput = selectedValues && selectedValues.length > 0 ? selectedValues[0] : undefined;
    }
    
    this.checkForChanges();
  }


  getCueOptionsForAction(currentCue: CueData): { value: string, label: string }[] {
    const options = this.cues
      .filter(c => c !== currentCue)
      .map(c => ({
        value: String(c.id),
        label: `${c.order}. ${c.name}`
      }));
    
    return options;
  }
  
  onActionTargetChange(selectedValue: string | string[], cue: CueData): void {
    if (Array.isArray(selectedValue)) {
      cue.action_target = selectedValue.length > 0 ? selectedValue[0] : null;
    } else {
      cue.action_target = selectedValue || null;
    }

    this.checkForChanges();
  } 

  private loadInitialMappings(): void {
    const mappings = this.projectsService.mappingOptions();
    
    if (mappings && mappings.length > 0) {
      this.audioMappingOptions = mappings.filter(mapping => 
        mapping.type === 'audio'
      ).map(mapping => ({
        value: mapping.uuid,
        label: mapping.name
      }));
      
      this.videoMappingOptions = mappings.filter(mapping => 
        mapping.type === 'video'
      ).map(mapping => ({
        value: mapping.uuid,
        label: mapping.name
      }));
      
      this.mappingOptions = [...this.audioMappingOptions, ...this.videoMappingOptions];
    }
  }

  private assignMultipleAudioOutputs(audioCue: any, selectedOutputs: string[]): void {
    if (!selectedOutputs || !Array.isArray(selectedOutputs) || selectedOutputs.length === 0) {
      return;
    }

    const templateAudioOutput = this.getTemplateOutputStructure('audio');
    if (!templateAudioOutput) {
      console.warn('No se pudo obtener la estructura template para AudioCueOutput');
      return;
    }

    audioCue.outputs = [];
    
    selectedOutputs.forEach((selectedOutput, index) => {
      let outputToAssign = selectedOutput;
      const parsedOutput = this.projectsService.parseOutputString(selectedOutput);
      let foundOutputInMappings = null;

      if (parsedOutput) {
        foundOutputInMappings = this.projectsService.findOutputInMappings(parsedOutput.uuid, parsedOutput.name);
      }

      if (!foundOutputInMappings) {
        if (this.audioMappingOptions.length > 0) {
          outputToAssign = this.audioMappingOptions[0].value;
        } else {
          return;
        }
      }

      const clonedAudioOutput = JSON.parse(JSON.stringify(templateAudioOutput));
      clonedAudioOutput.output_name = outputToAssign;

      const audioOutputData = {
        AudioCueOutput: clonedAudioOutput
      };

      audioCue.outputs.push(audioOutputData);
    });
  }

  private assignMultipleVideoOutputs(videoCue: any, selectedOutputs: string[]): void {
    if (!selectedOutputs || !Array.isArray(selectedOutputs) || selectedOutputs.length === 0) {
      return;
    }

    const templateVideoOutput = this.getTemplateOutputStructure('video');
    if (!templateVideoOutput) {
      console.warn('No se pudo obtener la estructura template para VideoCueOutput');
      return;
    }

    videoCue.outputs = [];
    
    selectedOutputs.forEach((selectedOutput, index) => {
      let outputToAssign = selectedOutput;
      const parsedOutput = this.projectsService.parseOutputString(selectedOutput);
      let foundOutputInMappings = null;

      if (parsedOutput) {
        foundOutputInMappings = this.projectsService.findOutputInMappings(parsedOutput.uuid, parsedOutput.name);
      }

      if (!foundOutputInMappings) {
        if (this.videoMappingOptions.length > 0) {
          outputToAssign = this.videoMappingOptions[0].value;
        } else {
          return;
        }
      }

      const clonedVideoOutput = JSON.parse(JSON.stringify(templateVideoOutput));
      clonedVideoOutput.output_name = outputToAssign;

      const videoOutputData = {
        VideoCueOutput: clonedVideoOutput
      };

      videoCue.outputs.push(videoOutputData);
    });
  }

  /**
   * Add a new DMX channel to a cue
   */
  addDmxChannel(cue: CueData): void {
    if (cue.type !== 'dmx') return;
    
    if (!cue.dmx_channels) {
      cue.dmx_channels = [];
    }
    
    // Find the next available channel number (DMX channels start at 1)
    let nextChannel = 1;
    const existingChannels = cue.dmx_channels.map(ch => ch.channel);
    while (existingChannels.includes(nextChannel)) {
      nextChannel++;
    }
    
    cue.dmx_channels.push({
      channel: nextChannel,
      value: 0
    });
    
    this.checkForChanges();
  }
  
  removeDmxChannel(cue: CueData, index: number): void {
    if (cue.type !== 'dmx' || !cue.dmx_channels) return;
    
    cue.dmx_channels.splice(index, 1);
    this.checkForChanges();
  }
  
  /**
   * Validate that the channel number is not duplicated
   */
  isDmxChannelNumValid(cue: CueData, channel: number, currentIndex: number): boolean {
    if (cue.type !== 'dmx' || !cue.dmx_channels) return true;
    
    return !cue.dmx_channels.some((ch, index) => ch.channel === channel && index !== currentIndex);
  }
  
  /**
   * Handle the change of DMX channel number
   */
  onDmxChannelNumChange(cue: CueData, index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let newChannel = parseInt(input.value, 10);
    if (isNaN(newChannel) || newChannel < 1) newChannel = 1;
    if (newChannel > 512) newChannel = 512;
    
    if (cue.type !== 'dmx' || !cue.dmx_channels || !cue.dmx_channels[index]) return;
    
    if (this.isDmxChannelNumValid(cue, newChannel, index)) {
      cue.dmx_channels[index].channel = newChannel;
      input.value = String(newChannel);
      this.checkForChanges();
    } else {
      setTimeout(() => {
        input.value = cue.dmx_channels![index].channel.toString();
      });
    }
  }
  
  onDmxChannelValueChange(cue: CueData, index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let newValue = parseInt(input.value, 10);
  
    if (isNaN(newValue)) return;
  
    newValue = Math.min(255, Math.max(0, newValue));
    input.value = String(newValue);
  
    if (cue.type !== 'dmx' || !cue.dmx_channels || !cue.dmx_channels[index]) return;
    cue.dmx_channels[index].value = newValue;
    this.checkForChanges();
  }

  trackByChannelIndex(index: number, channel: any): number {
    return index;
  }

  onUniverseNumChange(cue: CueData, value: any): void {
    // Handle empty string or null/undefined values
    if (value === '' || value === null || value === undefined) {
      cue.universe_num = 0;
      this.checkForChanges();
      return;
    }
    
    const newValue = parseInt(value.toString());
    
    if (cue.type !== 'dmx') return;
    
    // Validate range: 0-999
    if (isNaN(newValue)) {
      cue.universe_num = 0;
    } else if (newValue < 0) {
      cue.universe_num = 0;
    } else if (newValue > 999) {
      cue.universe_num = 999;
    } else {
      cue.universe_num = newValue;
    }
    
    this.checkForChanges();
  }

  onDmxFadeTimeChange(cue: CueData, value: any): void {
    if (cue.type !== 'dmx') return;
    if (value === '' || value === null || value === undefined) {
      cue.fade_in_time = 0;
      this.checkForChanges();
      return;
    }
    const num = parseFloat(value.toString());
    cue.fade_in_time = isNaN(num) || num < 0 ? 0 : num;
    this.checkForChanges();
  }

  private getTemplateOutputStructure(cueType: 'audio' | 'video'): any | null {
    const template = this.projectsService.projectTemplate();
    
    if (!template?.['CuemsScript']?.['CueList']?.['contents']) {
      return null;
    }

    const contents = template['CuemsScript']['CueList']['contents'];
    
    for (const item of contents) {
      const itemKeys = Object.keys(item);
      
      if (cueType === 'audio' && itemKeys.includes('AudioCue')) {
        const audioCue = item['AudioCue'];
        // Search in outputs if it exists
        if (audioCue.outputs && Array.isArray(audioCue.outputs) && audioCue.outputs.length > 0) {
          // Return the first AudioCueOutput as template
          const firstOutput = audioCue.outputs.find((output: any) => output.AudioCueOutput);
          if (firstOutput) {
            return JSON.parse(JSON.stringify(firstOutput.AudioCueOutput));
          }
        }
        // Fallback: search AudioCueOutput directly
        if (audioCue.AudioCueOutput) {
          return JSON.parse(JSON.stringify(audioCue.AudioCueOutput));
        }
        break;
      } else if (cueType === 'video' && itemKeys.includes('VideoCue')) {
        const videoCue = item['VideoCue'];
        // Search in outputs if it exists
        if (videoCue.outputs && Array.isArray(videoCue.outputs) && videoCue.outputs.length > 0) {
          // Return the first VideoCueOutput as template
          const firstOutput = videoCue.outputs.find((output: any) => output.VideoCueOutput);
          if (firstOutput) {
            return JSON.parse(JSON.stringify(firstOutput.VideoCueOutput));
          }
        }
          // Fallback: search VideoCueOutput directly
        if (videoCue.VideoCueOutput) {
          return JSON.parse(JSON.stringify(videoCue.VideoCueOutput));
        }
        break;
      }
    }
    
    return null;
  }

  openDeleteConfirmation(index: number): void {
    this.isConfirmDeleteOpen = true;
    this.cueToDeleteIndex = index;
  }

  closeDeleteConfirmation(): void {
    this.isConfirmDeleteOpen = false;
    this.cueToDeleteIndex = null;
  }

  confirmDelete(): void {
    if (this.cueToDeleteIndex !== null) {
      this.deleteCue(this.cueToDeleteIndex);
    }
    this.closeDeleteConfirmation();
  }

  private deleteCue(index: number) {
    const deletedCueId = String(this.cues[index].id);

    this.cues.splice(index, 1);

    // Nullify action_target if it pointed to the deleted cue
    this.cues.forEach(cue => {
      if (cue.type === 'action' && cue.action_target === deletedCueId) {
        cue.action_target = null;
      }
    });      
      
    // Reorder the numbers of order
    this.cues.forEach((cue, i) => {
      cue.order = i + 1;
    });

    this.checkForChanges();
  }  
}
