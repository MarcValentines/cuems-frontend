// src/app/services/projects/handlers/project-list.handler.ts
import { ProjectList } from '../projects.service';

/**
 * Transform the projects response format
 */
export function transformProjectsResponse(projectsData: any[]): ProjectList[] {
  return projectsData.map(projectItem => {
    // Each item is an object with a single key (the UUID)
    const uuid = Object.keys(projectItem)[0];
    const projectData = projectItem[uuid];

    //debug
    /*
    console.log('RAW projectData:', projectData);
    console.log('RAW description:', projectData.description);
    console.log('RAW CuemsScript.description:', projectData.CuemsScript?.description);
    */

    return {
      uuid,
      name: projectData.name,
      description: projectData.description ?? projectData.CuemsScript?.description, //añadir descripción normal o mapeada
      unix_name: projectData.unix_name,
      created: projectData.created,
      modified: projectData.modified,
    };
  });
}

/**
 * Request the list of projects from the server
 */
export function requestProjectList(sendMessage: (message: any) => void): void {
  sendMessage({ action: 'project_list' });
}

/**
 * Handle project list response
 */
export function handleProjectListResponse(
  projectsData: any[],
  updateProjects: (projects: ProjectList[]) => void
): void {
  const projectsArray = transformProjectsResponse(projectsData);

  updateProjects(projectsArray);
}
