import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';
import { inject } from '@angular/core';
import { ProjectWorkspaceService } from '../services/project-workspace.service';
import { ProjectEditStateService } from '../services/projects/project-edit-state.service';

export class CustomRouteReuseStrategy implements RouteReuseStrategy {
  private storedRoutes = new Map<string, DetachedRouteHandle>();
  private projectWorkspace = inject(ProjectWorkspaceService);
  private editStateService = inject(ProjectEditStateService);
  /**
   * Determine if a route should be detached (detached) to be reused later
   */
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    // Only keep state for the child routes of project-edit
    return this.isProjectEditChild(route);
  }

  /**
   * Store the detached component
   */
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
    if (this.shouldDetach(route)) {
      const key = this.getRouteKey(route);
  
      this.storedRoutes.set(key, handle);      
    }
  }

  /**
   * Determine if a route should be reattached from the store
   */
  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getRouteKey(route);
    const hasStoredRoute = this.storedRoutes.has(key);

    return hasStoredRoute;
  }

  /**
   * Retrieve the stored component
   */
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.getRouteKey(route);
    const storedRoute = this.storedRoutes.get(key);

    return storedRoute || null;
  }

  /**
   * Determine if a route should be reused
   */
  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    // Reuse if the route configuration is the same
    return future.routeConfig === curr.routeConfig;
  }

  /**
   * Verify if the route is a child of project-edit
   */
  private isProjectEditChild(route: ActivatedRouteSnapshot): boolean {
    // Verify if the route is a child of project-edit
    const parentPath = route.parent?.routeConfig?.path;
    const currentPath = route.routeConfig?.path;
    
    // Only for the specific routes we want to keep alive
    const projectEditChildRoutes = ['sequence', 'audio-mixer', 'video-mixer', 'dmx-mixer'];
    
    return parentPath === 'projects/:uuid/edit' && 
           currentPath !== undefined && 
           projectEditChildRoutes.includes(currentPath);
  }

  /**
   * Generate a unique key for the route including parameters
   */
  private getRouteKey(route: ActivatedRouteSnapshot): string {
    const segments: string[] = [];
    let current: ActivatedRouteSnapshot | null = route;
    
    // Build the key from the current route upwards
    while (current) {
      if (current.routeConfig?.path) {
        segments.unshift(current.routeConfig.path);
      }
      current = current.parent;
    }
    
    // Include the route parameters for differences between projects
    const projectUuid = route.parent?.params['uuid'];
    if (projectUuid) {
      return `${segments.join('/')}_${projectUuid}`;
    }
    
    return segments.join('/');
  }

  /**
   * Method to clear stored routes (useful when exiting the edit mode)
   */
  public clearStoredRoutes(): void {
    console.log('Clearing all stored routes');
    this.storedRoutes.clear();
  }

  /**
   * Method to clear routes for a specific project
   */
  public clearProjectRoutes(projectUuid: string): void {
    console.log(`Clearing routes for project: ${projectUuid}`);
    const keysToDelete: string[] = [];
    
    this.storedRoutes.forEach((value, key) => {
      if (key.endsWith(`_${projectUuid}`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.storedRoutes.delete(key);
    });

    // notify to workspace that the project is closed in edit mode
    this.projectWorkspace.closeEdit(projectUuid);

    this.editStateService.clearProjectData(projectUuid); // clear unsaved changes
  }
} 