import { Injectable, DestroyRef, EventEmitter, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsocketService, WebSocketError } from '../websocket.service';
import { NotificationService } from '../ui/notification.service';
import { Router } from '@angular/router';
import { generateSlug } from '../../core/utils';

import {
  createProject,
  CreateProjectParams
} from './handlers/project-create.handler';
import {
  handleProjectListResponse,
  requestProjectList,
  transformProjectsResponse
} from './handlers/project-list.handler';

export interface ProjectList {
  uuid: string;
  name: string;
  unix_name: string;
  created: string;
  modified: string;
}

export type ProjectTemplate = Record<string, any>;

export interface InitialMapping {
  uuid: string;
  name: string;
  type: 'audio' | 'video';
}

export interface InitialMappingsResponse {
  type: string;
  value: {
    number_of_nodes: number;
    default_audio_input: string;
    default_audio_output: string;
    default_video_input: string | null;
    default_video_output: string;
    default_dmx_input: string | null;
    default_dmx_output: string | null;
    nodes: Array<{
      node: {
        uuid: string;
        mac: string;
        audio: Array<{
          outputs: Array<{
            output: {
              id?: number;
              name: string;
              mappings: Array<{
                mapped_to: string;
              }>;
            };
          }>;
          inputs: Array<{
            input: {
              id?: number;
              name: string;
              mappings: Array<{
                mapped_to: string;
              }>;
            };
          }>;
        }>;
        video: Array<{
          outputs: Array<{
            output: {
              id?: number;
              name: string;
              mappings: Array<{
                mapped_to: string;
              }>;
            };
          }>;
        }>;
        dmx: any;
      };
    }>;
    new_nodes: Array<{
      node: {
        uuid: string;
        mac: string;
        audio: Array<{
          outputs: Array<{
            output: {
              id?: number;
              name: string;
              mappings: Array<{
                mapped_to: string;
              }>;
            };
          }>;
          inputs: Array<{
            input: {
              id?: number;
              name: string;
              mappings: Array<{
                mapped_to: string;
              }>;
            };
          }>;
        }>;
        video: Array<{
          outputs: Array<{
            output: {
              id?: number;
              name: string;
              mappings: Array<{
                mapped_to: string;
              }>;
            };
          }>;
        }>;
        dmx: any;
      };
    }>;
    schemaLocation: string;
  };
}

export interface WebSocketResponse {
  type: string;
  value: any;
  action?: string;
}


@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebsocketService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  public errorEvent = new EventEmitter<WebSocketError>();
  public newProjectCreated = new EventEmitter<string>();

  public projectRestored = new EventEmitter<string>();
  public projectPermanentlyDeleted = new EventEmitter<string>();
  
  public projectSaved = new EventEmitter<string>();

  public projects = signal<ProjectList[]>([]);
  public projectsInTrash = signal<ProjectList[]>([]);
  public projectTemplate = signal<ProjectTemplate | null>(null);
  public initialMappings = signal<InitialMappingsResponse | null>(null);
  public mappingOptions = signal<InitialMapping[]>([]);

  public projectLoaded = new EventEmitter<any>();

  constructor() {    
    const savedTemplate = localStorage.getItem('initial_template');
    if (savedTemplate) {
      try {
        this.projectTemplate.set(JSON.parse(savedTemplate));
      } catch (e) {
      }
    }

    const savedMappings = localStorage.getItem('initial_mappings');
    if (savedMappings) {
      try {
        const parsedMappings = JSON.parse(savedMappings);
        
        let mappingsToSet: InitialMappingsResponse;
        if (parsedMappings.type === 'initial_mappings') {
          mappingsToSet = parsedMappings;
        } else {
          mappingsToSet = {
            type: 'initial_mappings',
            value: parsedMappings
          };
        }
        
        this.initialMappings.set(mappingsToSet);
        
        this.extractMappingOptions(mappingsToSet.value);        
      } catch (e) {
        console.error('ProjectsService constructor - error parsing mappings:', e);
      }
    }

    this.wsService.messages
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          this.handleWebsocketResponse(response);
        },
        error: (err) => {
          console.error('ProjectsService - websocket error:', err);
          this.errorEvent.emit({ 
            action: 'websocket_error', 
            message: 'Error de conexión',
            raw: err 
          });
        }
      });

    this.wsService.errors
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (error: WebSocketError) => {
          const projectActions = [
            'project_new', 'project_save', 'project_delete', 'project_restore', 
            'project_trash_delete', 'project_list', 'project_trash_list', 
            'project_load', 'initial_template', 'initial_mappings'
          ];
          
          if (error.action && projectActions.includes(error.action)) {
            this.errorEvent.emit(error);
            
            if (error.action === 'project_new') {
              this.notificationService.showError(error.message || 'Error al crear el proyecto');
              this.newProjectCreated.emit('');
            } else if (error.action === 'project_save') {
              this.notificationService.showError(error.message || 'Error al guardar el proyecto');
            } else {
              this.notificationService.showError(error.message || 'Error en la operación de proyecto');
            }
          }
        }
      });
    
  }

  public handleWebsocketResponse(response: any): void {
    if (response && response.type === 'initial_template' && response.value) {
      try {
        this.projectTemplate.set(response.value);
        localStorage.setItem('initial_template', JSON.stringify(response.value));
      } catch (e) {
      }
    }

    if (response && response.type === 'initial_mappings' && (response.value || response)) {
      try {
        const mappingsData = response.value || response;
        
        const completeResponse: InitialMappingsResponse = {
          type: 'initial_mappings',
          value: mappingsData
        };
        
        this.initialMappings.set(completeResponse);
        
        // Extract mapping options for the multiselect
        this.extractMappingOptions(mappingsData);
        
        localStorage.setItem('initial_mappings', JSON.stringify(completeResponse));
      } catch (e) {
        console.error('Error processing initial mappings:', e);
      }
    }

    if (response && response.type === 'project_list' && Array.isArray(response.value)) {
      handleProjectListResponse(response.value, projects => this.projects.set(projects));
    }

    if (response && response.type === 'project_trash_list' && Array.isArray(response.value)) {
      const trashProjects = transformProjectsResponse(response.value);
      this.projectsInTrash.set(trashProjects);
    }

    if (response && response.type === 'project_new' && response.value) {
      const projectUuid = response.value;
      
      this.notificationService.showSuccess('Proyecto creado exitosamente');
      
      this.newProjectCreated.emit(projectUuid);
      
      this.router.navigate(['/projects', projectUuid, 'edit']).then(() => {
      }).catch(err => {

      });
      
      this.getProjectList();
    }

    if (response && response.type === 'project_save' && response.value) {
      const projectUuid = response.value;
      
      this.notificationService.showSuccess('Proyecto actualizado exitosamente');
      
      this.projectSaved.emit(projectUuid);
      
      this.getProjectList();
    }

    if (response && response.type === 'project_delete' && response.value) {
      const projectUuid = response.value;
      
      this.notificationService.showSuccess('Proyecto movido a la papelera');
      
      this.getProjectList();
      this.getProjectTrashList();
    }

    if (response && response.type === 'project_recover' && response.value) {
      const projectUuid = response.value;
      
      this.notificationService.showSuccess('Proyecto restaurado exitosamente');
      
      this.projectRestored.emit(projectUuid);
      
      this.getProjectList();
      this.getProjectTrashList();
    }

    if (response && response.type === 'project_trash_delete' && response.value) {
      const projectUuid = response.value;
      
      this.notificationService.showSuccess('Proyecto eliminado permanentemente');
      
      this.projectPermanentlyDeleted.emit(projectUuid);
      
      this.getProjectTrashList();
    }

    if (response && response.type === 'project' && response.value) {
      this.projectLoaded.emit(response.value);
    }

    if (response && response.type === 'error') {
      const error: WebSocketError = {
        action: response.action || 'unknown',
        message: response.value || 'Error desconocido',
        raw: response
      };
      
      this.errorEvent.emit(error);
      
      if (error.action === 'project_new') {
        this.notificationService.showError(error.message || 'Error al crear el proyecto');
        this.newProjectCreated.emit('');
      } else if (error.action === 'project_delete') {
        this.notificationService.showError(error.message || 'Error al mover el proyecto a la papelera');
      } else if (error.action === 'project_restore') {
        this.notificationService.showError(error.message || 'Error al restaurar el proyecto');
      } else if (error.action === 'project_trash_delete') {
        this.notificationService.showError(error.message || 'Error al eliminar permanentemente el proyecto');
      } else {
        this.notificationService.showError(error.message || 'Error en la operación');
      }
    }
  }

  getProjectList(): void {
    requestProjectList(message => this.wsService.ws.next(message));
  }

  getProjectTrashList(): void {
    this.wsService.ws.next({
      action: 'project_trash_list'
    });
  }

  createProject(projectData: CreateProjectParams): void {    
    if (!this.projectTemplate()) {
      this.notificationService.showError('Error: No hay template disponible');
      this.errorEvent.emit({ 
        action: 'project_new', 
        message: 'No hay template disponible',
        raw: null 
      });
      this.newProjectCreated.emit('');
      return;
    }

    if (!this.initialMappings() || !this.mappingOptions() || this.mappingOptions().length === 0) {
      this.notificationService.showError('Error: No hay mappings disponibles');
      this.errorEvent.emit({ 
        action: 'project_new', 
        message: 'No hay mappings disponibles',
        raw: null 
      });
      this.newProjectCreated.emit('');
      return;
    }

    const unix_name = generateSlug(projectData.name);
    createProject(
      projectData,
      this.projectTemplate(),
      this.mappingOptions(),
      (message: any) => {
        const messageWithUnixName = {
          ...message,
          unix_name
        };
        this.wsService.ws.next(messageWithUnixName);
      }
    );
  }

  deleteProject(uuid: string) {
    this.wsService.ws.next({
      action: 'project_delete',
      value: uuid
    });
  }

  restoreProject(uuid: string) {
    this.wsService.ws.next({
      action: 'project_restore',
      value: uuid
    });
  }

  permanentDeleteProject(uuid: string) {
    this.wsService.ws.next({
      action: 'project_trash_delete',
      value: uuid
    });
  }

  updateProjects(projects: ProjectList[]) {
    this.projects.set(projects);
  }

  loadProject(uuid: string | null) {
    if (uuid) {
      this.wsService.ws.next({
        action: 'project_load',
        value: uuid
      });
    } else {
      console.error('ProjectsService.loadProject() called with null/undefined UUID');
    }
  }

  updateProject(projectData: any): void {    
    this.wsService.ws.next({
      action: 'project_save',
      value: projectData
    });
  }

  getInitialMappings(): InitialMapping[] {
    const mappings = this.mappingOptions();

    return mappings;
  }


  getMappingByUuid(uuid: string): InitialMapping | undefined {
    return this.mappingOptions().find(mapping => mapping.uuid === uuid);
  }

  /**
   * Extract mapping options for the multiselect
   */
  private extractMappingOptions(mappingsData: any): void {
    const mappingOptions: InitialMapping[] = [];
    
    if (mappingsData.nodes && Array.isArray(mappingsData.nodes)) {
      mappingsData.nodes.forEach((nodeData: any, index: number) => {
        const nodeUuid = nodeData.node.uuid;
        const nodeNumber = index + 1;

        if (nodeData.node.audio && Array.isArray(nodeData.node.audio)) {
          nodeData.node.audio.forEach((audioGroup: any) => {
            if (audioGroup.outputs && Array.isArray(audioGroup.outputs)) {
              audioGroup.outputs.forEach((outputData: any) => {
                const displayName = this.getOutputDisplayName(outputData, nodeNumber);
                const outputRef = outputData.output.id ?? outputData.output.name;
                const mapping: InitialMapping = {
                  uuid: `${nodeUuid}_${outputRef}`,
                  name: displayName,
                  type: 'audio'
                };
                mappingOptions.push(mapping);
              });
            }
          });
        }
        
        if (nodeData.node.video && Array.isArray(nodeData.node.video)) {
          nodeData.node.video.forEach((videoGroup: any) => {
            if (videoGroup.outputs && Array.isArray(videoGroup.outputs)) {
              videoGroup.outputs.forEach((outputData: any) => {
                const displayName = this.getOutputDisplayName(outputData, nodeNumber);
                const outputRef = outputData.output.id ?? outputData.output.name;
                const mapping: InitialMapping = {
                  uuid: `${nodeUuid}_${outputRef}`,
                  name: displayName,
                  type: 'video'
                };
                mappingOptions.push(mapping);
              });
            }
          });
        }
      });
    }
    
    this.mappingOptions.set(mappingOptions);
  }

  private getOutputDisplayName(outputData: any, nodeNumber: number): string {
    return outputData.output?.name || `node${nodeNumber}:unknown`;
  }

  /**
   * Extract UUID and name from an output string f.e. "89ddc6fa-e1e6-4c5b-80a8-ae87d3e87a26_system:playback_1"
   */
  public parseOutputString(outputString: string): { uuid: string; name: string } | null {
    if (!outputString || typeof outputString !== 'string') {
      return null;
    }
    
    // Search for the pattern: 36 characters (uuidv4) + "_" + rest
    const uuidPattern = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})_(.+)$/;
    const match = outputString.match(uuidPattern);
    
    if (match) {
      return {
        uuid: match[1],
        name: match[2]
      };
    }
    
    console.warn('Could not parse output string:', outputString);
    return null;
  }

  /**
   * Get the node number (1, 2, 3...) based on the node UUID
   */
  public getNodeNumberByUuid(nodeUuid: string): number | null {
    const mappingsResponse = this.initialMappings();
    if (!mappingsResponse?.value?.nodes) {
      return null;
    }
    
    const nodeIndex = mappingsResponse.value.nodes.findIndex((nodeData: any) => nodeData.node.uuid === nodeUuid);
    return nodeIndex !== -1 ? nodeIndex + 1 : null; // +1 to start from node1
  }

  /**
   * Convert a complete output_name to a readable format (node1:output_name)
   */
  public formatOutputNameForDisplay(outputString: string): string {
    const parsedOutput = this.parseOutputString(outputString);
    if (!parsedOutput) {
      return outputString; // Fallback to the original string
    }
    
    const nodeNumber = this.getNodeNumberByUuid(parsedOutput.uuid);
    if (nodeNumber) {
      return `node${nodeNumber}:${parsedOutput.name}`;
    }
    
    return outputString; // Fallback to the original string
  }

  /**
   * Find a specific output in the mappings by UUID and name
   */
  public findOutputInMappings(uuid: string, name: string): any | null {
    const mappingsResponse = this.initialMappings();
    if (!mappingsResponse?.value?.nodes) {
      return null;
    }
    
    const node = mappingsResponse.value.nodes.find((nodeData: any) => nodeData.node.uuid === uuid);
    if (!node) {
      console.warn('Node not found for UUID:', uuid);
      return null;
    }
    
    if (node.node.audio && Array.isArray(node.node.audio)) {
      for (const audioGroup of node.node.audio) {
        if (audioGroup.outputs && Array.isArray(audioGroup.outputs)) {
          const output = audioGroup.outputs.find((outputData: any) =>
            outputData.output.name === name || String(outputData.output.id) === name);
          if (output) {
            return { type: 'audio', output, node: node.node };
          }
        }
      }
    }
    
    if (node.node.video && Array.isArray(node.node.video)) {
      for (const videoGroup of node.node.video) {
        if (videoGroup.outputs && Array.isArray(videoGroup.outputs)) {
          const output = videoGroup.outputs.find((outputData: any) =>
            outputData.output.name === name || String(outputData.output.id) === name);
          if (output) {
            return { type: 'video', output, node: node.node };
          }
        }
      }
    }
    
    console.warn('Output not found for UUID:', uuid, 'and name:', name);
    return null;
  }
}
