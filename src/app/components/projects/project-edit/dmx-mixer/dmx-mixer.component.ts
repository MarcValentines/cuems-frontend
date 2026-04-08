import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router, NavigationEnd } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProjectsService } from '../../../../services/projects';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, filter } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Node {
  uuid: string;
  nodeId: string;
  url: SafeResourceUrl;
}

@Component({
  selector: 'app-dmx-mixer',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './dmx-mixer.component.html'
})
export class ProjectEditDmxMixerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private projectService = inject(ProjectsService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private uuid: string = '';

  projectUuid: string | null = null;
  selectedNodeId: string | null = null;

  nodeIds: Node[] = [];
  isViewingNode: boolean = false;

  ngOnInit() {
    this.route.parent?.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.projectUuid = params['uuid'];

        if (!this.projectUuid) {
          return;
        }

        this.uuid = this.projectUuid;
        this.loadDmxMapping(this.uuid);
      });

    if (this.route.firstChild) {
      this.route.firstChild.params
        .pipe(takeUntil(this.destroy$))
        .subscribe(params => {
          const newNodeId = params['nodeId'] || null;

          if (newNodeId !== this.selectedNodeId) {
            this.selectedNodeId = newNodeId;
            this.updateSelectedNode();
            this.cdr.markForCheck();
          }
        });
    }

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {

        const match = event.url.match(/dmx-mixer\/([^\/]+)$/);
        const newNodeId = match ? match[1] : null;

        if (newNodeId !== this.selectedNodeId) {

          this.selectedNodeId = newNodeId;

          setTimeout(() => {
            this.updateSelectedNode();
            this.cdr.markForCheck();
          }, 50);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDmxMapping(projectUuid: string): void {

    const mappings = this.projectService.initialMappings();

    if (!mappings?.value) {
      return;
    }

    const mappingValue = mappings.value;
    const nodes = mappingValue.nodes ?? [];

    const nodeMap = new Map<string, Node>();

    nodes.forEach((nodeWrapper: any) => {
      const nodeData = nodeWrapper?.node;
      if (!nodeData) {
        return;
      }

      const nodeUuid = nodeData.uuid;
      const dmxOutputs = nodeData.dmx ?? [];

      if (dmxOutputs.length > 0) {
        const node = this.createNodeFromUuid(nodeUuid);
        if (node) {
          nodeMap.set(node.nodeId, node);
        }
      }
    });

    this.nodeIds = Array.from(nodeMap.values());

    if (this.nodeIds.length > 0 && !this.selectedNodeId) {
      this.selectedNodeId = this.nodeIds[0].nodeId;
    }

    this.cdr.markForCheck();

    if (this.selectedNodeId) {
      this.updateSelectedNode();
    }
  }

  private createNodeFromUuid(uuid: string): Node | null {
    if (!uuid) {
      return null;
    }

    const lastPart = uuid.split('-').pop() ?? '';

    if (/^[0-9a-fA-F]{12}$/.test(lastPart)) {
      const url = `http://${lastPart}.local:9090`;
      return {
        uuid,
        nodeId: lastPart,
        url: this.sanitizer.bypassSecurityTrustResourceUrl(url)
      };
    }

    return null;
  }

  private updateSelectedNode(): void {

    if (this.selectedNodeId) {

      const node = this.nodeIds.find(n => n.nodeId === this.selectedNodeId);

      if (node) {
        this.isViewingNode = true;
      } else {
        this.isViewingNode = false;
      }

    } else {

      this.isViewingNode = false;

    }
  }

  navigateToNode(nodeId: string): void {

    if (!this.projectUuid) {
      return;
    }

    const newPath = `/projects/${this.projectUuid}/edit/dmx-mixer/${nodeId}`;

    this.router.navigateByUrl(newPath)
      .then(success => {
        console.log('[DMX Mixer] Navegación exitosa:', success);
      })
      .catch(err => {
        console.error('[DMX Mixer] Error en navegación:', err);
      });
  }

  backToList(): void {

    if (!this.projectUuid) {
      return;
    }

    const newPath = `/projects/${this.projectUuid}/edit/dmx-mixer`;

    this.router.navigateByUrl(newPath)
      .then(success => {
        console.log('[DMX Mixer] Retorno exitoso:', success);
      })
      .catch(err => {
        console.error('[DMX Mixer] Error al volver:', err);
      });
  }
}