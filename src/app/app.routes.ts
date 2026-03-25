import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ProjectListComponent } from './components/projects/project-list/project-list.component';
import { ProjectShowComponent } from './components/projects/project-show/project-show.component';
import { ProjectEditComponent } from './components/projects/project-edit/project-edit.component';
import { ProjectTrashComponent } from './components/projects/project-trash/project-trash.component';
import { ProjectNewComponent } from './components/projects/project-new/project-new.component';
import { MediaListComponent } from './components/media/media-list/media-list.component';
import { MediaTrashComponent } from './components/media/media-trash/media-trash.component';
import { ProjectEditSequenceComponent } from './components/projects/project-edit/sequence/sequence.component';
import { ProjectEditAudioMixerComponent } from './components/projects/project-edit/audio-mixer/audio-mixer.component';
import { ProjectEditVideoMixerComponent } from './components/projects/project-edit/video-mixer/video-mixer.component';
import { ProjectEditDmxMixerComponent } from './components/projects/project-edit/dmx-mixer/dmx-mixer.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ProjectShowSequenceComponent } from './components/projects/project-show/sequence/sequence.component';
import { ProjectShowAudioMixerComponent } from './components/projects/project-show/audio-mixer/audio-mixer.component';
import { ProjectShowVideoMixerComponent } from './components/projects/project-show/video-mixer/video-mixer.component';
import { ProjectShowDmxMixerComponent } from './components/projects/project-show/dmx-mixer/dmx-mixer.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'projects', component: ProjectListComponent },
  { path: 'projects/new', component: ProjectNewComponent },
  { path: 'projects/trash', component: ProjectTrashComponent },
  {
    path: 'projects/:uuid',
    component: ProjectShowComponent,
    children: [
      { path: '', redirectTo: 'sequence', pathMatch: 'full' },
      { path: 'sequence', component: ProjectShowSequenceComponent },
      { path: 'audio-mixer', component: ProjectShowAudioMixerComponent },
      { path: 'video-mixer', component: ProjectShowVideoMixerComponent },
      {
        path: 'dmx-mixer',
        component: ProjectShowDmxMixerComponent,
      },
    ]
  },
  {
    path: 'projects/:uuid/edit',
    component: ProjectEditComponent,
    children: [
      { path: '', redirectTo: 'sequence', pathMatch: 'full' },
      { path: 'sequence', component: ProjectEditSequenceComponent },
      { path: 'audio-mixer', component: ProjectEditAudioMixerComponent },
      { path: 'video-mixer', component: ProjectEditVideoMixerComponent },
      {
        path: 'dmx-mixer',
        component: ProjectEditDmxMixerComponent,
        children: [
          { path: ':nodeId', component: ProjectEditDmxMixerComponent }
        ]
      },
    ]
  },
  { path: 'media', component: MediaListComponent },
  { path: 'media/trash', component: MediaTrashComponent },
  { path: 'design', loadComponent: () => import('./components/design/design.component').then(m => m.DesignComponent) },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '' }
];
