import { Component, inject, DestroyRef, effect, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AppPageHeaderComponent } from '../../layout/app-page-header/app-page-header.component';
import { ProjectsService, ProjectList } from '../../../services/projects/projects.service';
import { ConfirmationDialogComponent } from '../../ui/confirmation-dialog/confirmation-dialog.component';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ImportService, UploadParams } from '../../../services/media/import.service';
import { ExportService, ExportParams } from '../../../services/media/export.service';


@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, AppPageHeaderComponent, ConfirmationDialogComponent, TranslateModule],
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private importService = inject(ImportService); //import service
  private exportService = inject(ExportService);
  exportMessages = new Map<string, string>(); //trackear exportaciones
  exportingProjects = new Set<string>(); // Para trackear qué proyectos se están exportando

  isUploadingToProject: string | null = null;

  public projectsService = inject(ProjectsService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private subscription = new Subscription();

  selectedProjects: string[] = [];

  protected isLoading = true;
  projectToDeleteUuid: string | null = null;
  isConfirmDeleteOpen = false;
  isConfirmBulkDeleteOpen = false;
  isBulkDeleting = false;

  private deletingProjects = new Map<string, boolean>();

  @ViewChild('importFileInput') importFileInput!: ElementRef<HTMLInputElement>;


  constructor() {
    this.refreshProjects();

    effect(() => {
      const projects = this.projectsService.projects();
      this.isLoading = false;

      this.cleanupProjectMaps(projects);
    });
  }

  ngOnInit() {
    this.subscription.add(
      this.projectsService.errorEvent.subscribe(error => {
        console.log('Error event received:', error);

        if (error.action === 'project_delete') {
          if (this.projectToDeleteUuid) {
            this.deletingProjects.delete(this.projectToDeleteUuid);
            this.projectToDeleteUuid = null;
          }

          this.isBulkDeleting = false;
        }
      })
    );
    this.setupExportSubscriptions();

  }

  private setupExportSubscriptions(): void {
  // Suscribirse a eventos del ExportService
  this.subscription.add(
    this.exportService.exportComplete.subscribe(event => {
      // Manejar exportación completada
    })
  );

  this.subscription.add(
    this.exportService.exportError.subscribe(event => {
      // Manejar error de exportación
    })
  );
}

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  cleanupProjectMaps(projects: ProjectList[]) {
    const existingUuids = projects.map(p => p.uuid);

    if (this.selectedProjects.length > 0) {
      const previousLength = this.selectedProjects.length;
      this.selectedProjects = this.selectedProjects.filter(uuid => existingUuids.includes(uuid));

      if (previousLength !== this.selectedProjects.length) {
        console.log(`Removed ${previousLength - this.selectedProjects.length} non-existent projects from selection`);
      }
    }

    if (this.deletingProjects.size > 0) {
      let removed = 0;
      this.deletingProjects.forEach((value, uuid) => {
        if (!existingUuids.includes(uuid)) {
          this.deletingProjects.delete(uuid);
          removed++;
        }
      });

      if (this.deletingProjects.size === 0) {
        this.isBulkDeleting = false;
      }
    }
  }

  isProjectBeingDeleted(uuid: string): boolean {
    return this.deletingProjects.has(uuid);
  }

  refreshProjects(): void {
    this.isLoading = true;
    this.projectsService.getProjectList();
    this.projectsService.getProjectTrashList();
  }

  createNewProject(): void {
    this.router.navigate(['/projects/new']);
  }

  openDeleteConfirmation(uuid: string) {
    this.projectToDeleteUuid = uuid;
    this.isConfirmDeleteOpen = true;
  }

  closeDeleteConfirmation() {
    this.isConfirmDeleteOpen = false;
    this.projectToDeleteUuid = null;
  }

  confirmDelete() {
    if (this.projectToDeleteUuid) {
      this.deletingProjects.set(this.projectToDeleteUuid, true);

      if (this.selectedProjects.includes(this.projectToDeleteUuid)) {
        this.selectedProjects = this.selectedProjects.filter(uuid => uuid !== this.projectToDeleteUuid);
  }

      this.executeProjectDeletion(this.projectToDeleteUuid);
      this.closeDeleteConfirmation();

      const uuidToCleanup = this.projectToDeleteUuid;
      setTimeout(() => {
        if (this.deletingProjects.has(uuidToCleanup)) {
          console.log(`Timeout cleanup for project ${uuidToCleanup}`);
          this.deletingProjects.delete(uuidToCleanup);
        }
      }, 3000);
    }
  }

  executeProjectDeletion(uuid: string) {
    this.projectsService.deleteProject(uuid);
  }

  deleteProject(uuid: string) {
    if (this.isProjectBeingDeleted(uuid)) {
      return;
    }

    this.openDeleteConfirmation(uuid);
  }

  editProject(uuid: string): void {
    console.log(`Editing project ${uuid} - functionality to be implemented`);
  }

  selectProject(uuid: string): void {
    if (this.isProjectBeingDeleted(uuid)) {
      return;
    }

    if (this.selectedProjects.includes(uuid)) {
      this.selectedProjects = this.selectedProjects.filter(id => id !== uuid);
    } else {
      this.selectedProjects.push(uuid);
    }
  }

  selectAllProjects(): void {
    if (this.selectedProjects.length === this.getSelectableProjects().length) {
      this.selectedProjects = [];
    } else {
      this.selectedProjects = this.getSelectableProjects();
    }
  }

  getSelectableProjects(): string[] {
    return this.projectsService.projects()
      .filter(project => !this.isProjectBeingDeleted(project.uuid))
      .map(project => project.uuid);
  }

  deselectAllProjects(): void {
    this.selectedProjects = [];
  }

  deleteSelectedProjects(): void {
    if (this.selectedProjects.length === 0) return;

    const validSelectedProjects = this.selectedProjects.filter(uuid =>
      !this.isProjectBeingDeleted(uuid) &&
      this.projectsService.projects().some(p => p.uuid === uuid)
    );

    this.selectedProjects = validSelectedProjects;

    if (this.selectedProjects.length === 0) return;

    this.isConfirmBulkDeleteOpen = true;
  }

  closeBulkDeleteConfirmation(): void {
    this.isConfirmBulkDeleteOpen = false;
  }

  confirmBulkDelete(): void {
    const validSelectedProjects = this.selectedProjects.filter(uuid =>
      !this.isProjectBeingDeleted(uuid) &&
      this.projectsService.projects().some(p => p.uuid === uuid)
    );

    if (validSelectedProjects.length > 0) {
      this.executeDeleteProjects([...validSelectedProjects]);
    }

    this.closeBulkDeleteConfirmation();
  }

  executeDeleteProjects(uuids: string[]): void {
    if (uuids.length === 0) return;

    this.isBulkDeleting = true;

    uuids.forEach(uuid => {
      this.deletingProjects.set(uuid, true);
    });

    uuids.forEach(uuid =>
      this.projectsService.deleteProject(uuid)
    );

    this.selectedProjects = [];

    setTimeout(() => {
      uuids.forEach(uuid => {
        this.deletingProjects.delete(uuid);
      });

      this.isBulkDeleting = false;
    }, 5000);
  }

  //métodos para el import
  // Método para abrir el selector de archivos
openImportDialog(): void {
  this.importFileInput.nativeElement.click();
}

// Método para manejar la selección de archivo
onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];

    // Verificar que sea un archivo .zip
    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Solo se pueden importar archivos .zip');
      return;
    }

    // Confirmar antes de importar
    if (confirm(`¿Importar proyecto "${file.name}"?`)) {
      this.importProject(file);
    }

    // Limpiar el input
    input.value = '';
  }
}

// Método para importar el proyecto
importProject(file: File): void {
  console.log('Importando proyecto:', file.name);

  const uploadParams: UploadParams = {
    file: file,
    chunksize: 1024 * 1024, // 1MB chunks
    onSuccess: (fileUuid: string) => {
      console.log('Proyecto importado con UUID:', fileUuid);
      // Recargar la lista después de un tiempo
      setTimeout(() => {
        this.refreshProjects();
      }, 2000);
    },
    onError: (error: any) => {
      console.error('Error al importar:', error);
      alert('Error al importar proyecto: ' + error);
    }
  };

  this.importService.uploadFile(uploadParams);
}

importToProject(projectUuid: string): void {
  if (this.isProjectBeingDeleted(projectUuid)) {
    return;
  }

  this.isUploadingToProject = projectUuid;
  this.importFileInput.nativeElement.click();
}

// Métodos para exportar
exportProject(projectUuid: string): void {
  // Lógica de exportación usando ExportService
  const params: ExportParams = {
    projectUuid: projectUuid,
    format: 'zip',
    onSuccess: (fileUrl) => { /* callback éxito */ },
    onError: (error) => { /* callback error */ }
  };

  this.exportService.exportProject(params); // <-- OBLIGATORIO
}

private getProjectByUuid(uuid: string): ProjectList | undefined {
  return this.projectsService.projects().find(p => p.uuid === uuid);
}

isProjectExporting(uuid: string): boolean {
  return this.exportingProjects.has(uuid);
}

getExportMessage(uuid: string): string {
  return this.exportMessages.get(uuid) || '';
}
  //mostrar descripción de proyecto
  truncateText(text: string, maxLength: number = 17): string {
    if (!text) return '';
    return text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;
  }
}
