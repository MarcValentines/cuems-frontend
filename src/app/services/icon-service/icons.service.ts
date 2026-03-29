import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { dashboardIcon } from './icons/dashboard';
import { SettingsIcon } from './icons/settings';
import { UserProfileIcon } from './icons/user-profile';
import { FormitIcon } from './icons/formit';
import { FaqIcon } from './icons/faq';
import { ContactIcon } from './icons/contact';
import { LibraryIcon } from './icons/library';
import { ProjectIcon } from './icons/project';
import { UploadIcon } from './icons/upload';
import { SearchIcon } from './icons/search';
import { CloseCircleIcon } from './icons/close-circle';
import { CloseAltIcon } from './icons/close-alt';
import { XMarkIcon } from './icons/x-mark';
import { TrashIcon } from './icons/trash';
import { TrashAltIcon } from './icons/trash-alt';
import { DownIcon } from './icons/down';
import { SortIcon } from './icons/sort';
import { SortAscIcon } from './icons/sort-asc';
import { SortDescIcon } from './icons/sort-desc';
import { PointsIcon } from './icons/points';
import { cloudIcon } from './icons/cloud';
import { EyeIcon } from './icons/eye';
import { WarningIcon } from './icons/warning';
import { StarIcon } from './icons/star';
import { GroupIcon } from './icons/group';
import { AudioIcon } from './icons/audio';
import { VideoIcon } from './icons/video';
import { NodeIcon } from './icons/node';
import { LightIcon } from './icons/light';
import { FadeIcon } from './icons/fade';
import { WaitIcon } from './icons/wait';
import { ActionIcon } from './icons/action';
import { NoContinueIcon } from './icons/no-continue';
import { AutoContinueIcon } from './icons/auto-continue';
import { AutoFollowIcon } from './icons/auto-follow';
import { ActivityIcon } from './icons/activity';
import { save } from './icons/save';
import { PostGoPauseIcon } from './icons/post_go-pause';
import { PostGoGoIcon } from './icons/post_go-go';
import { PostGoGoAtEndIcon } from './icons/post_go-go_at_end';
import { PlayIcon } from './icons/play';
import { PauseIcon } from './icons/pause';
import { PencilIcon } from './icons/pencil';
import { RadioIcon } from './icons/radio';
import { StopIcon } from './icons/stop';
import { ChevronUpIcon } from './icons/chevron-up';
import { ChevronDownIcon } from './icons/chevron-down';

@Injectable({
  providedIn: 'root'
})
export class IconService {
  private icons: Record<string, string> = {
    'design': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="9"></rect>
      <rect x="14" y="3" width="7" height="5"></rect>
      <rect x="14" y="12" width="7" height="9"></rect>
      <rect x="3" y="16" width="7" height="5"></rect>
    </svg>`,

    'profile': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>`,

    'dashboard': dashboardIcon,
    'settings': SettingsIcon,
    'userProfile': UserProfileIcon,
    'formit': FormitIcon,
    'faq': FaqIcon,
    'contact': ContactIcon,
    'library': LibraryIcon,
    'project': ProjectIcon,
    'upload': UploadIcon,
    'search': SearchIcon,
    'closeCircle': CloseCircleIcon,
    'closeAlt': CloseAltIcon,
    'chevronDown': ChevronDownIcon,
    'chevronUp': ChevronUpIcon,
    'xMark': XMarkIcon,
    'trash': TrashIcon,
    'trashAlt': TrashAltIcon,
    'down': DownIcon,
    'sort': SortIcon,
    'sortAsc': SortAscIcon,
    'sortDesc': SortDescIcon,
    'points': PointsIcon,
    'cloud': cloudIcon,
    'eye': EyeIcon,
    'warning': WarningIcon,
    'star': StarIcon,
    'group': GroupIcon,
    'audio': AudioIcon,
    'video': VideoIcon,
    'node': NodeIcon,
    'light': LightIcon,
    'dmx': LightIcon,
    'fade': FadeIcon,
    'wait': WaitIcon,
    'action': ActionIcon,
    'noContinue': NoContinueIcon,
    'autoContinue': AutoContinueIcon,
    'autoFollow': AutoFollowIcon,
    'activity': ActivityIcon,
    'save': save,
    'post_go_pause': PostGoPauseIcon,
    'post_go_go': PostGoGoIcon,
    'post_go_go_at_end': PostGoGoAtEndIcon,
    'play': PlayIcon,
    'pause': PauseIcon,
    'stop': StopIcon,
    'pencil': PencilIcon,
    'radio': RadioIcon
  };

  private cache = new Map<string, SafeHtml>();

  constructor(private sanitizer: DomSanitizer) {}

  getIcon(name: string): SafeHtml | null {
    if (!this.icons[name]) {
      return null;
    }

    if (!this.cache.has(name)) {
      this.cache.set(name, this.sanitizer.bypassSecurityTrustHtml(this.icons[name]));
    }

    return this.cache.get(name) || null;
  }
}
