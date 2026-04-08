import { Injectable, inject } from '@angular/core';
import { WebsocketService } from '../websocket.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private webSocketService = inject(WebsocketService);
  public exportComplete = new Subject<string>(); // fileUrl
  public exportError = new Subject<string>();

  private exportInProgress = false;

  exportProject(projectUuid: string): void {
    if (this.exportInProgress) {
      console.warn('Ya hay un export en curso');
      return;
    }

    this.exportInProgress = true;

    const message = {
      action: 'project_export',
      value: projectUuid,
    };

    this.sendMessageToWebSocket(message);
  }

  private sendMessageToWebSocket(message: any): void {
    if (typeof (this.webSocketService as any).wsEmit === 'function') {
      (this.webSocketService as any).wsEmit(message);
    } else {
      throw new Error('WebSocketService no tiene método para enviar mensajes');
    }
  }

  processServerResponse(message: any): void {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'project_export') {
      const fileUrl = this.extractFileUrl(message);

      if (!fileUrl) {
        this.exportError.next('No se recibió URL');
        this.exportInProgress = false;
        return;
      }

      // emitir evento
      this.exportComplete.next(fileUrl);

      // descargar
      this.downloadFile(fileUrl);

      this.exportInProgress = false;
    }
  }

  private extractFileUrl(message: any): string {
    if (typeof message.value === 'string') return message.value;
    return message.value?.fileUrl || message.value?.url;
  }

  private downloadFile(fileUrl: string): void {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'project.zip';
    link.target = '_blank';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}