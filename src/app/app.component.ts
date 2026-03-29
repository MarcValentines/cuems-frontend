import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, inject } from '@angular/core';
import { Router, RouterOutlet, RouteReuseStrategy } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppHeaderComponent } from './components/layout/app-header/app-header.component';
import { AppFooterComponent } from './components/layout/app-footer/app-footer.component';
import { LanguageService } from './services/language.service';
import { isPlatformBrowser } from '@angular/common';
import { WebsocketService } from './services/websocket.service';
import { Subscription } from 'rxjs';
import { NotificationsComponent } from './components/ui/notifications/notifications.component';
import { NotificationService } from './services/ui/notification.service';
import { ProjectWorkspaceService } from './services/project-workspace.service';
import { CustomRouteReuseStrategy } from './core/route-reuse.strategy';
import { ConfirmationDialogComponent } from './components/ui/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AppHeaderComponent,
    AppFooterComponent,
    NotificationsComponent,
    ConfirmationDialogComponent,
    TranslateModule,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'formitgo-tw';
  private errorSubscription = new Subscription();
  workspace = inject(ProjectWorkspaceService);
  private strategy = inject(RouteReuseStrategy) as CustomRouteReuseStrategy;
  private router = inject(Router);

  constructor(
    private translate: TranslateService,
    private languageService: LanguageService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private wsService: WebsocketService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.translate.addLangs(['es', 'en', 'ca']);
    this.translate.setDefaultLang('es');
    const savedLang = localStorage.getItem('userLanguage');
    if (savedLang && this.translate.getLangs().includes(savedLang)) {
      this.translate.use(savedLang);
    } else {
      const browserLang = this.translate.getBrowserLang();
      if (browserLang && this.translate.getLangs().includes(browserLang)) {
        this.translate.use(browserLang);
      } else {
        this.translate.use('es');
      }
    }
    this.languageService.initializeLanguage();
    if (isPlatformBrowser(this.platformId)) {
      this.updateHtmlLang(this.translate.currentLang);
      this.languageService.currentLang$.subscribe(lang => {
        this.updateHtmlLang(lang);
      });
    }
    this.errorSubscription = this.wsService.errors.subscribe(error => {
      this.handleWebSocketError(error);
    });
  }

  ngOnDestroy() {
    this.errorSubscription.unsubscribe();
  }

  onConfirmClose(): void {
    const uuid = this.workspace.pendingCloseUuid();
    if (uuid) {
      this.strategy.clearProjectRoutes(uuid);
      if (this.router.url.includes(`/projects/${uuid}/edit`)) {
        this.router.navigate(['/projects']);
      }
    }
    this.workspace.onConfirmClose();
  }

  private handleWebSocketError(error: any): void {
    if (error._handledByProjectShow) return;
    let errorMessage = 'Ha ocurrido un error';
    if (error.value && typeof error.value === 'string') {
      if (error.value.includes('cannot be lesser than 3')) {
        errorMessage = 'El nombre debe tener al menos 3 caracteres';
      } else if (error.value.includes('XMLSchemaValidationError')) {
        errorMessage = 'Error de validación: ' + error.action;
      } else {
        errorMessage = `Error en la acción "${error.action}"`;
      }
    }
    this.notificationService.showError(errorMessage);
  }

  private updateHtmlLang(lang: string): void {
    document.documentElement.lang = lang;
  }
}