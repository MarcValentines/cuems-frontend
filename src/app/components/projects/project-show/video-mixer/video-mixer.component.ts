import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../ui/icon/icon.component';
import { OscService } from '../../../../services/osc.service';

interface VideoOutputRaw {
  parentId: string;
  id: string;
  name: string;
  index: number;
}

interface VideoNode {
  index: number;
  uuid: string;
  outputs: VideoOutputRaw[];
}

interface VideoOutput {
  parentId: string;
  id: string;
  name: string;
  index: number;
  scale: number;
  settingsExpanded?: boolean;
  corners?: Corners;
}

interface VideoNodeWithUI {
  nodeUuid: string;
  nodeIndex: number;
  outputs: VideoOutput[];
}

interface Point {
  x: number;
  y: number;
}

interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}

@Component({
  selector: 'app-project-show-video-mixer',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './video-mixer.component.html',
  styleUrls: ['./video-mixer.component.css']
})
export class ProjectShowVideoMixerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private oscService = inject(OscService);
  
  projectUuid: string | null = null;
  Math = Math;
  
  public project: any;
  public videoNodes: VideoNode[] = [];
  
  videoNodesWithUI = signal<VideoNodeWithUI[]>([]);
  
  draggedCorner = signal<string | null>(null);
  activeLayerId = signal<string | null>(null);

  private readonly INITIAL_CORNERS = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 2, y: 0 },
    bottomLeft: { x: 0, y: 2 },
    bottomRight: { x: 2, y: 2 }
  };
  
  ngOnInit() {
    this.route.parent?.params.subscribe(params => {
      this.projectUuid = params['uuid'];
      this.loadVideoNodesWithRetry();
    });
    
    window.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
  }
  
  ngOnDestroy() {
    window.removeEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    window.removeEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
  }
  
  private getVideoNodesFromLocalStorage(): VideoNode[] {
    const mappingsData = localStorage.getItem('initial_mappings');
    if (!mappingsData) return [];
    
    try {
      const data = JSON.parse(mappingsData);
      const mappings = data.value;
      
      if (!mappings || !mappings.nodes || !Array.isArray(mappings.nodes)) {
        console.error('Invalid mappings structure');
        return [];
      }
      
      return mappings.nodes
        .filter((nodeWrapper: any) => nodeWrapper?.node?.video !== null)
        .map((nodeWrapper: any, nodeIndex: number) => {
          const node = nodeWrapper.node;
          const outputs: VideoOutputRaw[] = [];
          
          node.video.forEach((videoSection: any) => {
            if (videoSection.outputs) {
              videoSection.outputs.forEach((outputWrapper: any, outputIndex: number) => {
                outputs.push({
                  parentId: node.uuid,
                  id: `${node.uuid}_${outputWrapper.output.id ?? outputWrapper.output.name}`,
                  name: outputWrapper.output.name,
                  index: outputIndex
                });
              });
            }
          });
          
          return {
            index: nodeIndex,
            uuid: node.uuid,
            outputs: outputs
          };
        });
        
    } catch (error) {
      console.error('Error parsing mappings JSON:', error);
      return [];
    }
  }
  
  private loadVideoNodesWithRetry(): void {
    this.tryLoadVideoNodes();
  }
  
  private tryLoadVideoNodes(attempt: number = 1, maxAttempts: number = 5): void {
    this.videoNodes = this.getVideoNodesFromLocalStorage();
    
    if (this.videoNodes.length > 0) {
      console.log('Video nodes loaded successfully:', this.videoNodes);
      this.initializeVideoLayers();
    } else if (attempt < maxAttempts) {
      console.log(`Attempt ${attempt} failed, retrying in ${attempt * 500}ms...`);
      setTimeout(() => this.tryLoadVideoNodes(attempt + 1, maxAttempts), attempt * 500);
    } else {
      console.warn('Failed to load video nodes after', maxAttempts, 'attempts');
    }
  }
  
  private initializeVideoLayers(): void {
    const nodesWithUI: VideoNodeWithUI[] = [];
    
    this.videoNodes.forEach(node => {
      const outputsWithUI: VideoOutput[] = node.outputs.map(output => ({
        parentId: output.parentId,
        id: output.id,
        name: output.name,
        index: output.index,
        scale: 1,
        settingsExpanded: false,
        corners: this.INITIAL_CORNERS
      }));
      
      nodesWithUI.push({
        nodeUuid: node.uuid,
        nodeIndex: node.index,
        outputs: outputsWithUI
      });
    });
    
    this.videoNodesWithUI.set(nodesWithUI);
  }
  
  getOutputDisplayName(outputName: string): string {
    const parts = outputName.split('_');
    if (parts.length > 1) {
      return parts.slice(1).join('_');
    }
    return outputName;
  }
  
  toggleSettings(outputId: string) {
    this.videoNodesWithUI.update(nodes => 
      nodes.map(node => ({
        ...node,
        outputs: node.outputs.map(output =>
          output.id === outputId
            ? { ...output, settingsExpanded: !output.settingsExpanded }
            : output
        )
      }))
    );
  }
  
  getLayerCorners(outputId: string): Corners {
    for (const node of this.videoNodesWithUI()) {
      const output = node.outputs.find(o => o.id === outputId);
      if (output?.corners) return output.corners;
    }
    return this.INITIAL_CORNERS;
  }
  
  // Convert screen coordinates to OSC movement
  public getMovementFromVisual(corner: string, visualX: number, visualY: number): {x: number, y: number} {
    switch (corner) {
      case 'topLeft':
        return { x: visualX, y: visualY };
      case 'topRight':
        return { x: 2 - visualX, y: visualY };
      case 'bottomLeft':
        return { x: visualX, y: 2 - visualY };
      case 'bottomRight':
        return { x: 2 - visualX, y: 2 - visualY };
      default:
        return { x: 0, y: 0 };
    }
  }
  
  updateScale(outputId: string, event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    let outputIndex = 0;
    let updatedOutput: any = null;
    let nodeUuid = '';
    for (const node of this.videoNodesWithUI()) {
      for (const output of node.outputs) {
        if (output.id === outputId) {
          updatedOutput = {...output, scale: value};
          outputIndex = output.index;
          nodeUuid = node.nodeUuid;
          break;
        }
      }
    }
    this.videoNodesWithUI.update(nodes => 
      nodes.map(node => ({
        ...node,
        outputs: node.outputs.map(output =>
          output.id === outputId
            ? { ...output, scale: value }
            : output
        )
      }))
    );

    this.syncScale(nodeUuid, updatedOutput, value);
  }
  
  startDrag(layerId: string, corner: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.draggedCorner.set(corner);
    this.activeLayerId.set(layerId);
  }
  
  handleGlobalMouseMove(event: MouseEvent) {
    if (!this.draggedCorner() || !this.activeLayerId()) return;
    
    const layerId = this.activeLayerId()!;
    const escapedLayerId = CSS.escape(layerId);
    const container = document.querySelector(`#layer-${escapedLayerId}-transform .video-preview-area`);
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    
    // Mouse position in coordinates, allowing to go out 0.6 in all directions
    const xPercent = Math.max(-0.6, Math.min(2.6, 
      ((event.clientX - rect.left) / rect.width) * 2
    ));
    const yPercent = Math.max(-0.6, Math.min(2.6, 
      ((event.clientY - rect.top) / rect.height) * 2
    ));
    
    const corner = this.draggedCorner() as keyof Corners;
    
    // Update visualization
    this.videoNodesWithUI.update(nodes => 
      nodes.map(node => ({
        ...node,
        outputs: node.outputs.map(output =>
          output.id === layerId && output.corners
            ? {
                ...output,
                corners: {
                  ...output.corners,
                  [corner]: { x: xPercent, y: yPercent }
                }
              }
            : output
        )
      }))
    );
    
    this.updateCornerInputs(layerId, corner, xPercent, yPercent);
    
    // Calculate movement OSC from visual position
    const movement = this.getMovementFromVisual(corner, xPercent, yPercent);
    this.syncCornerMovement(layerId, corner, movement.x, movement.y);
  }
  
  handleGlobalMouseUp() {
    if (this.draggedCorner() && this.activeLayerId()) {
      this.draggedCorner.set(null);
      this.activeLayerId.set(null);
    }
  }
  
  updateCornerInputs(layerId: string, corner: string, x: number, y: number) {
    const xFormatted = x.toFixed(3);
    const yFormatted = y.toFixed(3);
    
    const position = 
      corner === 'topLeft' ? 'top-left' : 
      corner === 'topRight' ? 'top-right' : 
      corner === 'bottomLeft' ? 'bottom-left' : 
      'bottom-right';
    
    const escapedLayerId = CSS.escape(layerId);
    const transformArea = document.querySelector(`#layer-${escapedLayerId}-transform`);
    if (!transformArea) return;
    
    const xInput = transformArea.querySelector(`.${position}-inputs .x-input`) as HTMLInputElement;
    const yInput = transformArea.querySelector(`.${position}-inputs .y-input`) as HTMLInputElement;
    
    if (xInput) xInput.value = xFormatted;
    if (yInput) yInput.value = yFormatted;
  }
  
  startDragForLayer(outputId: string, corner: string, event: MouseEvent) {
    let outputFound = false;
    for (const node of this.videoNodesWithUI()) {
      const output = node.outputs.find(o => o.id === outputId);
      if (output?.settingsExpanded) {
        outputFound = true;
        break;
      }
    }
    
    if (!outputFound) return;
    
    this.startDrag(outputId, corner, event);
  }

  private syncScale(nodeUuid: string, updatedOutput: VideoOutput, scale: number) {
    const xScale = scale;
    const yScale = scale;
    this.oscService.sendVideoMixerScaleUpdate(nodeUuid, updatedOutput.index, xScale, yScale);
  }
  
  private syncCornerMovement(layerId: string, corner: string, movementX: number, movementY: number) {
    for (const node of this.videoNodesWithUI()) {
      const output = node.outputs.find(o => o.id === layerId);
      if (output) {
        let outputIndex = output.index;
        let cornerPosition: number = 0;
        
        switch (corner) {
          case 'topLeft':
            cornerPosition = 4;
            break;
          case 'topRight':
            cornerPosition = 3;
            break;
          case 'bottomLeft':
            cornerPosition = 1;
            break;
          case 'bottomRight':
            cornerPosition = 2;
            break;
        }

        this.oscService.sendVideoMixerCornerUpdate(node.nodeUuid, outputIndex, cornerPosition, Number(movementX.toFixed(3)), Number(movementY.toFixed(3)));
        break;
      }
    }
  }

  resetCorner(outputId: string, corner: string) {
    const cornerKey = corner as keyof Corners;
    const { x, y } = this.INITIAL_CORNERS[cornerKey];
    
    // Update the corner values
    this.videoNodesWithUI.update(nodes => 
      nodes.map(node => ({
        ...node,
        outputs: node.outputs.map(output =>
          output.id === outputId && output.corners
            ? {
                ...output,
                corners: {
                  ...output.corners,
                  [cornerKey]: { x, y }
                }
              }
            : output
        )
      }))
    );
    
    // Send the values to OSC
    for (const node of this.videoNodesWithUI()) {
      const output = node.outputs.find(o => o.id === outputId);
      if (output) {
        const movement = this.getMovementFromVisual(corner, x, y);
        this.syncCornerMovement(outputId, corner, Number(movement.x.toFixed(3)), Number(movement.y.toFixed(3)));
        break;
      }
    }
  }
}