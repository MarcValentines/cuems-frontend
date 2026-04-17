import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IconComponent } from '../../../ui/icon/icon.component';
import { ProjectsService } from '../../../../services/projects/projects.service';
import { OscService } from '../../../../services/osc.service';
import { Subscription } from 'rxjs';
import { AudioMixerStateService } from '../../../../services/mixers/audio-mixer-state.service';

@Component({
  selector: 'app-project-show-audio-mixer',
  templateUrl: './audio-mixer.component.html',
  standalone: true,
  imports: [CommonModule, IconComponent, FormsModule]
})
export class ProjectShowAudioMixerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private projectsService = inject(ProjectsService);
  private oscService = inject(OscService);
  private audioMixerStateService = inject(AudioMixerStateService);
  public project: any;
  public projectUuid: string | null = null;
  public audioCues: any[] = [];
  private projectLoadedSubscription?: Subscription;
  public audioMappingOptions: { value: string, label: string }[] = [];
  public audioNodes: any[] = [];

  ngOnInit(): void {
    this.route.parent?.params.subscribe(params => {
      this.projectUuid = params['uuid'];
      console.log('Audio Mixer - Project UUID:', this.projectUuid);

      if (this.projectsService.projects().length === 0) {
        this.projectsService.getProjectList();
      }

      this.projectsService.loadProject(this.projectUuid);
      this.loadAudioNodesWithRetry();
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
        //this.extractAudioCues();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.projectLoadedSubscription) {
      this.projectLoadedSubscription.unsubscribe();
    }
  }

  // private extractAudioCues(): void {
  //   this.audioCues = [];
    
  //   if (this.project?.CuemsScript?.CueList?.contents) {
  //     this.project.CuemsScript.CueList.contents.forEach((cueItem: any) => {
  //       if (cueItem.AudioCue) {
  //         this.audioCues.push(cueItem.AudioCue);
  //       }
  //     });
  //   }
    
  //   console.log('Audio Cues found:', this.audioCues);
  // }

  private getAudioNodesFromLocalStorage(): any[] {
    const mappingsData = localStorage.getItem('initial_mappings');
    if (!mappingsData) return [];
    
    try {
      const data = JSON.parse(mappingsData);
      
      const mappings = data.value;
      
      if (!mappings || !mappings.nodes || !Array.isArray(mappings.nodes)) {
        console.error('Invalid mappings structure');
        return [];
      }
      
      return mappings.nodes
        .filter((nodeWrapper: any) => nodeWrapper?.node?.audio !== null)
        .map((nodeWrapper: any, nodeIndex: number) => {
          const node = nodeWrapper.node;
          const outputs: any[] = [];
          node.audio.forEach((audioSection: any) => {
            if (audioSection.outputs) {
              audioSection.outputs.forEach((outputWrapper: any, outputIndex: number) => {
                outputs.push({
                  parentId: node.uuid,
                  id: `${node.uuid}_${outputWrapper.output.id ?? outputWrapper.output.name}`,
                  name: outputWrapper.output.name,
                  volume: this.audioMixerStateService.getOutputVolume(`${node.uuid}_${outputWrapper.output.id ?? outputWrapper.output.name}`),
                  index: outputIndex
                });
              });
            }
          });
          
          return {
            index: nodeIndex,
            uuid: node.uuid,
            volume: this.audioMixerStateService.getNodeVolume(node.uuid),
            outputs: outputs
          };
        });
        
    } catch (error) {
      console.error('Error parsing mappings JSON:', error);
      return [];
    }
  }
  
  private loadAudioNodesWithRetry(): void {
    this.tryLoad();
  }
  
  private tryLoad(attempt: number = 1, maxAttempts: number = 5): void {
    this.audioNodes = this.getAudioNodesFromLocalStorage();
    
    if (this.audioNodes.length > 0) {
      console.log('Mappings loaded successfully:', this.audioNodes);
    } else if (attempt < maxAttempts) {
      console.log(`Attempt ${attempt} failed, retrying in ${attempt * 500}ms...`);
      setTimeout(() => this.tryLoad(attempt + 1, maxAttempts), attempt * 500);
    } else {
      console.warn('Failed to load mappings after', maxAttempts, 'attempts');
    }
  }

  /**
   * Get the short name of an output (remove the UUID from the beginning)
   */
  getOutputDisplayName(outputName: string): string {
    const parts = outputName.split('_');
    if (parts.length > 1) {
      return parts.slice(1).join('_');
    }
    return outputName;
  }

  public sliderToFloat(sliderValue: number): number {
    return sliderValue / 100;
  }

  public floatToSlider(floatValue: number): number {
    return Math.round(floatValue * 100);
  }

  public onMasterVolumeChange(node: any, sliderValue: number): void {
    node.volume = sliderValue;
    this.audioMixerStateService.setNodeVolume(node.uuid, sliderValue);
    const floatVolume = this.sliderToFloat(sliderValue);
    this.oscService.sendMasterVolumeUpdate(node.uuid, floatVolume);
  }
  
  public onNodeVolumeChange(node: any, output: any, sliderValue: number): void {
    output.volume = sliderValue;
    this.audioMixerStateService.setOutputVolume(output.id, sliderValue);
    const floatVolume = this.sliderToFloat(sliderValue);
    const channelIndex = output.index;
    this.oscService.sendNodeVolumeUpdate(node.uuid, channelIndex, floatVolume);
  }  
}
