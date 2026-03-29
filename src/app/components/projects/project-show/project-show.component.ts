import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AppPageHeaderComponent } from '../../layout/app-page-header/app-page-header.component';
import { ProjectsService } from '../../../services/projects/projects.service';
import { OscService } from '../../../services/osc.service';
import { IconComponent } from '../../ui/icon/icon.component';
import { DrawerService } from '../../../services/ui/drawer.service';
import { WebsocketService } from '../../../services/websocket.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { PlayControlsFloatingComponent } from '../../ui/play-controls/play-controls-floating/play-controls-floating.component';
import { ProjectWorkspaceService } from '../../../services/project-workspace.service';
import { EngineStatusComponent } from '../../ui/engine-status/engine-status.component';

@Component({
  selector: 'app-project-show',
  standalone: true,
  imports: [CommonModule, RouterModule, AppPageHeaderComponent, TranslateModule, IconComponent, PlayControlsFloatingComponent, EngineStatusComponent],
  templateUrl: './project-show.component.html'
})
export class ProjectShowComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private projectsService = inject(ProjectsService);
  private websocketService = inject(WebsocketService);
  private oscService = inject(OscService);
  public drawerService = inject(DrawerService);
  private workspace = inject(ProjectWorkspaceService);
  
  readonly DRAWER_WIDTH = 500;
  
  public project: any;
  public projectUuid: string | null = null;
  public isProjectReady: boolean = false;
  public isCheckingEngine: boolean = false;
  public engineError: string | null = null;
  private projectLoadedSubscription?: Subscription;
  private websocketSubscription?: Subscription;
  private websocketErrorSubscription?: Subscription;
  private isWaitingForProjectReady: boolean = false;
  private router = inject(Router);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.projectUuid = params['uuid'];

      if (this.projectsService.projects().length === 0) {
        this.projectsService.getProjectList();
      }

      this.projectsService.loadProject(this.projectUuid);
      
      //this.checkProjectReady();
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

        if (this.projectUuid && this.project.name) {
          if (!this.oscService.running()) {
            this.workspace.openInShow(this.projectUuid, this.project.name);
            this.checkProjectReady();
          } else {
            this.isCheckingEngine = false;
            if (this.isSameProjectRunning) {
              this.isProjectReady = true;
            }            
          }
        }
      }
    });

    this.setupWebSocketSubscription();
  }

  ngOnDestroy(): void {
    if (this.projectLoadedSubscription) {
      this.projectLoadedSubscription.unsubscribe();
    }
    if (this.websocketSubscription) {
      this.websocketSubscription.unsubscribe();
    }
    if (this.websocketErrorSubscription) {
      this.websocketErrorSubscription.unsubscribe();
    }
  }

  /**
   * Toggle Activity/Warnings
   */
  toggleActivityDrawer(): void {
    this.drawerService.toggleActivityDrawer();
  }


  private setupWebSocketSubscription(): void {
    this.websocketSubscription = this.websocketService.messages.subscribe(response => {
      this.handleWebSocketMessage(response);
    });

    this.websocketErrorSubscription = this.websocketService.errors.subscribe(error => {
      this.handleWebSocketError(error);
    });
  }

  private checkProjectReady(): void {
    if (this.projectUuid) {
      if (this.oscService.running()) {
        this.isCheckingEngine = false;
        return;
      }

      this.isCheckingEngine = true;
      this.engineError = null;
      this.isProjectReady = false;
      this.isWaitingForProjectReady = true;

      const message = {
        action: 'project_ready',
        value: this.projectUuid
      };
      this.websocketService.wsEmit(message);
    }
  }

  private handleWebSocketMessage(response: any): void {
    if (response.type === 'project_ready' && response.value === this.projectUuid && this.isWaitingForProjectReady) {
      this.isCheckingEngine = false;
      this.engineError = null;
      this.isProjectReady = true;
      this.isWaitingForProjectReady = false;
    }
  }

  private handleWebSocketError(error: any): void {  
    if (error.action === 'project_ready' && this.isWaitingForProjectReady) {
      this.isCheckingEngine = false;
      this.engineError = error.message || error.value || 'Error desconocido';
      this.isProjectReady = false;
      this.isWaitingForProjectReady = false;
      
      error._handledByProjectShow = true;
    }
  }

  public get isShowActiveSequence(): boolean {
    return this.router.url.includes('/sequence');
  }

  public go(): void {
    console.log('GO!!!!');
    this.oscService.go();
  }

  public stop(): void {
    console.log('STOP!!!!');
    this.oscService.stop();
  }

  public pause(): void {
    console.log('PAUSE!!!!');
    this.oscService.pause();
  }

  get isEngineRunning(): boolean {
    return this.oscService.running();
  }
  
  get runningProject() {
    return this.projectsService.projects().find(
      p => p.unix_name?.toLowerCase() === this.oscService.loadedProject().toLowerCase()
    ) ?? null;
  }
  
  get isSameProjectRunning(): boolean {
    if (!this.project?.unix_name) return false;
    return this.oscService.loadedProject().toLowerCase() === this.project.unix_name.toLowerCase();
  }
  
  get isDifferentProjectRunning(): boolean {
    return this.isEngineRunning &&
           this.oscService.loadedProject() !== '' &&
           !this.isSameProjectRunning;
  }
  
  get engineStatus() {
    if (this.isCheckingEngine) return 'checking';
    if (this.isEngineRunning && !this.project) return 'checking';
    if (this.isDifferentProjectRunning) return 'different-project';
    if (this.isEngineRunning) return 'running';
    if (this.engineError) return 'error';
    if (this.isProjectReady) return 'ready';
    return 'idle';
  }
} 