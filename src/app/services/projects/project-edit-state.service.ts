import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface ComponentData {
  hasChanges: boolean;
  data: any;
}

interface TemporaryCuesData {
  cues: any[];
  hasUnsavedChanges: boolean;
}

@Injectable({
  providedIn: 'root'
})

export class ProjectEditStateService {
  public hasUnsavedChanges = signal(false);

  private changesSubject = new BehaviorSubject<boolean>(false);
  public changes$ = this.changesSubject.asObservable();

  private componentStates = new Map<string, ComponentData>();

  private temporaryCues = new Map<string, TemporaryCuesData>();

  markComponentAsChanged(componentName: string, projectUuid: string, data?: any): void {
    const key = `${projectUuid}-${componentName}`;

    this.componentStates.set(key, {
      hasChanges: true,
      data: data || null
    });

    this.updateGlobalState();
  }

  updateComponentData(componentName: string, projectUuid: string, data: any): void {
    const key = `${projectUuid}-${componentName}`;
    const currentState = this.componentStates.get(key);
    this.componentStates.set(key, {
      hasChanges: currentState?.hasChanges || false,
      data: data
    });
  }

  markComponentAsSaved(componentName: string, projectUuid: string): void {
    const key = `${projectUuid}-${componentName}`;
    const currentState = this.componentStates.get(key);
    if (currentState) {
      this.componentStates.set(key, {
        hasChanges: false,
        data: currentState.data
      });
    }
    this.updateGlobalState();
  }

  getComponentData(componentName: string, projectUuid: string): any {
    const key = `${projectUuid}-${componentName}`;
    const state = this.componentStates.get(key);
    return state?.data || null;
  }

  getProjectModifiedData(projectUuid: string): any {
    const modifiedData: any = {};

    this.componentStates.forEach((state, key) => {
      if (key.startsWith(`${projectUuid}-`) && state.hasChanges) {
        const componentName = key.substring(`${projectUuid}-`.length);
        modifiedData[componentName] = state.data;
      }
    });

    console.log('getProjectModifiedData', projectUuid, modifiedData); //debug

    return modifiedData;
  }

  markProjectAsSaved(projectUuid: string): void {
    this.componentStates.forEach((state, key) => {
      if (key.startsWith(projectUuid)) {
        this.componentStates.set(key, {
          hasChanges: false,
          data: state.data
        });
      }
    });

    this.clearTemporaryCues(projectUuid);

    this.updateGlobalState();
  }

  hasProjectChanges(projectUuid: string): boolean {
    for (const [key, state] of this.componentStates) {
      if (key.startsWith(projectUuid) && state.hasChanges) {
        return true;
      }
    }
    return false;
  }

  private updateGlobalState(): void {
    let hasChanges = false;
    for (const state of this.componentStates.values()) {
      if (state.hasChanges) {
        hasChanges = true;
        break;
      }
    }

    this.hasUnsavedChanges.set(hasChanges);
    this.changesSubject.next(hasChanges);
  }

  clearAllChanges(): void {
    this.componentStates.clear();
    this.temporaryCues.clear();
    this.updateGlobalState();
  }

  clearProjectData(projectUuid: string): void {
    const keysToDelete: string[] = [];
    this.componentStates.forEach((_, key) => {
      if (key.startsWith(projectUuid)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.componentStates.delete(key);
    });

    this.clearTemporaryCues(projectUuid);

    this.updateGlobalState();
  }

  saveTemporaryCues(projectUuid: string, cues: any[], hasUnsavedChanges: boolean): void {
    this.temporaryCues.set(projectUuid, {
      cues: JSON.parse(JSON.stringify(cues)),
      hasUnsavedChanges
    });
  }

  getTemporaryCues(projectUuid: string): TemporaryCuesData | null {
    return this.temporaryCues.get(projectUuid) || null;
  }

  hasTemporaryCues(projectUuid: string): boolean {
    return this.temporaryCues.has(projectUuid);
  }

  clearTemporaryCues(projectUuid: string): void {
    this.temporaryCues.delete(projectUuid);
  }

  updateTemporaryCuesOnly(projectUuid: string, cues: any[]): void {
    const currentData = this.temporaryCues.get(projectUuid);
    if (currentData) {
      this.temporaryCues.set(projectUuid, {
        cues: JSON.parse(JSON.stringify(cues)),
        hasUnsavedChanges: currentData.hasUnsavedChanges
      });
    }
  }

  //método para project-edit.component.ts (guardar cambios de modificación de nombre y descripción)
  setProjectMetadata(
    projectUuid: string,
    metadata: { name?: string; description?: string }
  ): void {
    const key = `${projectUuid}-metadata`;

    this.componentStates.set(key, {
      hasChanges: true,
      data: {
        ...(this.componentStates.get(key)?.data || {}),
        ...metadata
      }
    });

    console.log('setProjectMetadata', key, this.componentStates.get(key)); //debug

    this.updateGlobalState();
  }
}
