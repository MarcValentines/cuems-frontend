import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppPageHeaderComponent } from '../layout/app-page-header/app-page-header.component';
import { ConfirmationDialogComponent  } from '../ui/confirmation-dialog/confirmation-dialog.component';
import { IconComponent } from '../ui/icon/icon.component';
import { ProjectsService, InitialMappingsResponse } from '../../services/projects/projects.service';
import { TranslateModule } from '@ngx-translate/core';
import { WebsocketService } from '../../services/websocket.service';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../services/ui/notification.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, AppPageHeaderComponent, IconComponent, TranslateModule, ConfirmationDialogComponent],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  private projectsService = inject(ProjectsService);
  private wsService = inject(WebsocketService);
  private destroyRef = inject(DestroyRef);
  private notificationService = inject(NotificationService);
  public mappings: InitialMappingsResponse | null = null;
  public isConfirmRemoveNodeOpen = false;
  private selectedNodeUuidToRemove: string | null = null;
  public isConfirmAddNodeOpen = false;
  private selectedNodeUuidToAdd: string | null = null;

  public activeNodes: any[] = [];
  newNodes: any[] = [];

  constructor() {
    this.wsService.messages
      .pipe(
        filter(response => response && response.type === 'nodelist_modify'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response.value === 'OK') {
            this.notificationService.showSuccess('Lista de nodos modificada exitosamente');
          }
        }
      });
  }  

  ngOnInit(): void {
    this.mappings = this.projectsService.initialMappings();
  
    if (this.mappings) {
      this.loadNodes();
    }
  }

  private loadNodes(): void {
    const mappings = this.projectsService.initialMappings();
    if (mappings?.value) {
      this.activeNodes = mappings.value.nodes || [];
      this.newNodes = mappings.value.new_nodes || [];
    }
  }  

  getNodeName(index: number): string {
    return `Node ${String(index + 1).padStart(2, '0')}`;
  }

  getVideoOutputs(node: any): any[] {
    if (!node.video || !Array.isArray(node.video)) return [];
    
    const outputs: any[] = [];
    node.video.forEach((videoGroup: any) => {
      if (videoGroup.outputs && Array.isArray(videoGroup.outputs)) {
        outputs.push(...videoGroup.outputs);
      }
    });
    return outputs;
  }

  getAudioOutputs(node: any): any[] {
    if (!node.audio || !Array.isArray(node.audio)) return [];
    
    const outputs: any[] = [];
    node.audio.forEach((audioGroup: any) => {
      if (audioGroup.outputs && Array.isArray(audioGroup.outputs)) {
        outputs.push(...audioGroup.outputs);
      }
    });
    return outputs;
  }

  getMappedName(output: any): string {
    return output.output?.name || 'Sin nombre';
  }

  formatNumber(num: number): string {
    return String(num + 1).padStart(2, '0');
  }

  openRemoveNodeConfirmation(nodeUuid: string) {
    this.isConfirmRemoveNodeOpen = true;
    this.selectedNodeUuidToRemove = nodeUuid;
  }

  openAddNodeConfirmation(nodeUuid: string) {
    this.isConfirmAddNodeOpen = true;
    this.selectedNodeUuidToAdd = nodeUuid;
  }

  closeRemoveNodeConfirmation() {
    this.isConfirmRemoveNodeOpen = false;
    this.selectedNodeUuidToRemove = null;
  }

  closeAddNodeConfirmation() {
    this.isConfirmAddNodeOpen = false;
    this.selectedNodeUuidToAdd = null;
  }

  confirmRemoveNode() {
    console.log('confirmRemoveNode', this.selectedNodeUuidToRemove);
    this.wsService.wsEmit({
      action: 'nodelist_modify',
      modify_action: 'REMOVE',
      value: this.selectedNodeUuidToRemove
    });
    this.isConfirmRemoveNodeOpen = false;
    this.selectedNodeUuidToRemove = null;
  }

  confirmAddNode() {
    console.log('confirmAddNode', this.selectedNodeUuidToAdd);
    this.wsService.wsEmit({
      action: 'nodelist_modify',
      modify_action: 'ADD',
      value: this.selectedNodeUuidToAdd
    });
    this.isConfirmAddNodeOpen = false;
    this.selectedNodeUuidToAdd = null;
  }
}
