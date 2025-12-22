import { Injectable, inject } from '@angular/core';
import { WebsocketService } from '../websocket.service';
import { Subject } from 'rxjs';

export interface ExportParams {
  projectUuid: string;
  format?: 'zip' | 'tar' | 'tar.gz';
  onSuccess?: (fileUrl: string) => void;
  onError?: (error: string) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private webSocketService = inject(WebsocketService);

  // Subjects para eventos de exportación
  public exportComplete = new Subject<{ projectUuid: string; fileUrl: string }>();
  public exportError = new Subject<{ projectUuid: string; error: string }>();

  /**
   * Exporta un proyecto - versión adaptativa
   */
  exportProject(params: ExportParams): void {
    console.log('ExportService: Exporting project:', params.projectUuid);

    const message = {
      action: 'project_export',
      value: params.projectUuid,
      format: params.format || 'zip'
    };

    // Intentar diferentes métodos para enviar mensajes
    this.sendMessageToWebSocket(message);
  }

  /**
   * Intenta enviar mensaje usando diferentes métodos del WebSocketService
   */
  private sendMessageToWebSocket(message: any): void {
    const messageStr = JSON.stringify(message);

    // Intentar diferentes métodos comunes
    if (typeof (this.webSocketService as any).send === 'function') {
      (this.webSocketService as any).send(messageStr);
    }
    else if (typeof (this.webSocketService as any).sendMessage === 'function') {
      (this.webSocketService as any).sendMessage(messageStr);
    }
    else if (typeof (this.webSocketService as any).next === 'function') {
      (this.webSocketService as any).next(messageStr);
    }
    else {
      console.error('ExportService: No se encontró método para enviar mensajes al WebSocket');
      throw new Error('WebSocketService no tiene método para enviar mensajes');
    }
  }

  /**
   * Procesa una respuesta del servidor (debe ser llamado desde donde se reciban las respuestas)
   */
  public processServerResponse(message: any): void {
    console.log('ExportService: Processing message:', message);

    // Verificar si es una respuesta de exportación
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'project_export') {
      const projectUuid = this.extractProjectUuid(message);

      if (!projectUuid) {
        console.warn('ExportService: Could not extract project UUID from message:', message);
        return;
      }

      if (message.error) {
        // Error del servidor
        console.error('ExportService: Server error:', message.error);
        this.exportError.next({
          projectUuid,
          error: message.error
        });
      }
      else if (message.value && (message.value.fileUrl || message.value.url || typeof message.value === 'string')) {
        // Éxito: URL del archivo
        const fileUrl = this.extractFileUrl(message);
        console.log('ExportService: Export successful, file URL:', fileUrl);

        this.exportComplete.next({
          projectUuid,
          fileUrl
        });
      }
    }
  }

  /**
   * Extrae el UUID del proyecto del mensaje
   */
  private extractProjectUuid(message: any): string {
    // Intentar diferentes ubicaciones posibles
    return message.projectUuid ||
           (message.value && (message.value.projectUuid || message.value.uuid)) ||
           (message.request && message.request.value) ||
           (message.originalMessage && message.originalMessage.value);
  }

  /**
   * Extrae la URL del archivo del mensaje
   */
  private extractFileUrl(message: any): string {
    if (typeof message.value === 'string') {
      return message.value; // Si value es directamente la URL
    }
    return message.value?.fileUrl || message.value?.url || message.fileUrl || message.url;
  }

  /**
   * Descarga el archivo exportado
   */
  downloadExportedFile(fileUrl: string, fileName: string = 'exported_project.zip'): void {
    console.log('ExportService: Downloading file from:', fileUrl);

    // Crear enlace temporal para descarga
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';

    // Simular click para iniciar descarga
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
