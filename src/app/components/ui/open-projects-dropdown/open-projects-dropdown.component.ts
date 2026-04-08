import { Component, inject, signal, HostListener, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectWorkspaceService } from '../../../services/project-workspace.service';
import { IconComponent } from '../icon/icon.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-open-projects-dropdown',
  standalone: true,
  imports: [IconComponent, TranslateModule],
  templateUrl: './open-projects-dropdown.component.html',
})
export class OpenProjectsDropdownComponent {
  private router = inject(Router);
  workspace = inject(ProjectWorkspaceService);

  isOpen = signal(false);
  hasDirtyProjects = computed(() => this.workspace.editProjects().some(p => p.isDirty));
  showConfirmClose = signal(false);
  pendingCloseUuid = signal<string | null>(null);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const el = (event.target as HTMLElement).closest('app-open-projects-dropdown');
    if (!el) this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  navigateTo(uuid: string): void {
    this.isOpen.set(false);
    
    // force component recreation by navigating away first
    this.router.navigateByUrl('/projects', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/projects', uuid, 'edit']);
    });
  }

  close(uuid: string, event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.set(false);
    this.workspace.requestClose(uuid);
  }
}