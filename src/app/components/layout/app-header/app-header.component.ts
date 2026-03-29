import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../ui/icon/icon.component';
import { OpenProjectsDropdownComponent } from '../../ui/open-projects-dropdown/open-projects-dropdown.component';
import { ShowProjectLoadedIndicatorComponent } from '../../ui/show-project-loaded-indicator/show-project-loaded-indicator.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterModule,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    OpenProjectsDropdownComponent,
    ShowProjectLoadedIndicatorComponent
  ],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
  styles: [`
    .active-route {
      border-color: var(--color-primary) !important;
    }
    
    .active-mobile-route {
      background-color: var(--color-indigo-50) !important;
      border-color: var(--color-indigo-500) !important;
      color: var(--color-indigo-700) !important;
    }
  `]
})
export class AppHeaderComponent {
  isMobileMenuOpen = false;
  isProfileDropdownOpen = false;
  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target) && this.isProfileDropdownOpen) {
      this.isProfileDropdownOpen = false;
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  toggleProfileDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }
}
