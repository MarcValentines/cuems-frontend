import { Injectable, signal, computed, inject } from '@angular/core';
import { RouteReuseStrategy } from '@angular/router';
import { Router } from '@angular/router';
import { CustomRouteReuseStrategy } from '../core/route-reuse.strategy';
import { ProjectEditStateService } from './projects/project-edit-state.service';

export interface OpenProject {
  uuid: string;
  name: string;
  mode: 'show' | 'edit';
  isDirty: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProjectWorkspaceService {
  private projects = signal<OpenProject[]>([]);
  private strategy = inject(RouteReuseStrategy) as CustomRouteReuseStrategy;
  private router = inject(Router);
  private editStateService = inject(ProjectEditStateService);

  editProjects = computed(() => this.projects().filter(p => p.mode === 'edit'));
  showProject = computed(() => this.projects().find(p => p.mode === 'show') ?? null);

  showConfirmClose = signal(false);
  pendingCloseUuid = signal<string | null>(null);

  isInShow(uuid: string): boolean {
    return this.showProject()?.uuid === uuid;
  }

  openInShow(uuid: string, name: string): void {
    this.projects.update(list => [
      ...list.filter(p => p.mode !== 'show'),
      { uuid, name, mode: 'show', isDirty: false }
    ]);
  }

  openInEdit(uuid: string, name: string): boolean {
    if (this.isInShow(uuid)) return false;
    const already = this.projects().find(p => p.uuid === uuid && p.mode === 'edit');
    if (!already) {
      this.projects.update(list => [...list, { uuid, name, mode: 'edit', isDirty: false }]);
    }
    return true;
  }

  updateName(uuid: string, name: string): void {
    this.projects.update(list =>
      list.map(p => p.uuid === uuid ? { ...p, name } : p)
    );
  }

  closeEdit(uuid: string): void {
    this.strategy.clearProjectRoutes(uuid);
    this.editStateService.clearProjectData(uuid);
    this.projects.update(list => list.filter(p => !(p.uuid === uuid && p.mode === 'edit')));
    if (this.router.url.includes(`/projects/${uuid}/edit`)) {
      this.router.navigate(['/projects']);
    }
  }

  closeShow(): void {
    this.projects.update(list => list.filter(p => p.mode !== 'show'));
  }

  markDirty(uuid: string): void {
    this.projects.update(list =>
      list.map(p => p.uuid === uuid && p.mode === 'edit' ? { ...p, isDirty: true } : p)
    );
  }

  markSaved(uuid: string): void {
    this.projects.update(list =>
      list.map(p => p.uuid === uuid && p.mode === 'edit' ? { ...p, isDirty: false } : p)
    );
  }

  requestClose(uuid: string): void {
    const project = this.projects().find(p => p.uuid === uuid && p.mode === 'edit');
    if (project?.isDirty) {
      this.pendingCloseUuid.set(uuid);
      this.showConfirmClose.set(true);
    } else {
      this.closeEdit(uuid);
    }
  }

  onConfirmClose(): void {
    const uuid = this.pendingCloseUuid();
    if (uuid) this.closeEdit(uuid);
    this.showConfirmClose.set(false);
    this.pendingCloseUuid.set(null);
  }

  onCancelClose(): void {
    this.showConfirmClose.set(false);
    this.pendingCloseUuid.set(null);
  }
}