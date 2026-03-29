import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ProjectWorkspaceService } from '../../../services/project-workspace.service';

@Component({
  selector: 'app-show-project-loaded-indicator',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './show-project-loaded-indicator.component.html',
})
export class ShowProjectLoadedIndicatorComponent {
  workspace = inject(ProjectWorkspaceService);
  router = inject(Router);
  
  navigateToProject(uuid: string): void {
    this.router.navigateByUrl('/projects', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/projects', uuid, 'sequence']);
    });
  }  
}