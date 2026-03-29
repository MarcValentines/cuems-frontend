import { Injectable, DestroyRef, EventEmitter, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsocketService, WebSocketError } from '../websocket.service';
import { NotificationService } from '../ui/notification.service';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebsocketService);
  private notificationService = inject(NotificationService);

  public errorEvent = new EventEmitter<WebSocketError>();
  public fileListLoaded = new EventEmitter<any[]>();
  public operationSuccess = new EventEmitter<string>();

  public fileList = signal<any[]>([]);
  public fileTrashList = signal<any[]>([]);

  constructor() {
    this.wsService.messages
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => this.handleWebsocketResponse(response),
        error: (err) => {
          console.error('Error in media websocket:', err);
          this.errorEvent.emit({ 
            action: 'websocket_error', 
            message: 'Error de conexión',
            raw: err 
          });
        }
      });

    this.wsService.errors
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (error: WebSocketError) => {
          const mediaActions = [
            'file_list', 'file_trash_list', 'file_delete', 
            'file_restore', 'file_trash_delete', 'file_upload'
          ];
          
          if (error.action && mediaActions.includes(error.action)) {
            this.errorEvent.emit(error);
            this.notificationService.showError(error.message || 'Error en la operación de media');
          }
        }
      });
  }

  public thumbnailLoaded = new EventEmitter<{uuid: string, data: ArrayBuffer}>();
  public waveformLoaded = new EventEmitter<{uuid: string, data: ArrayBuffer}>();

  private handleWebsocketResponse(response: any): void {
    if (response && response.type === 'file_list' && response.value) {
      try {
        this.fileList.set(response.value);
        this.fileListLoaded.emit(response.value);
      } catch (e) {
        console.error('Error handling file list:', e);
      }
    }

    if (response && response.type === 'file_trash_list' && response.value) {
      try {
        this.fileTrashList.set(response.value);
      } catch (e) {
        console.error('Error handling file trash list:', e);
      }
    }

    if (response && response.type === 'file_delete' && response.value) {
      this.notificationService.showSuccess('File moved to trash successfully');
      this.getFileList();
      this.getFileTrashList();
      this.operationSuccess.emit('file_delete');
    }

    if (response && response.type === 'file_restore' && response.value) {
      this.notificationService.showSuccess('File restored successfully');
      this.getFileList();
      this.getFileTrashList();
      this.operationSuccess.emit('file_recover');
    }

    if (response && response.type === 'file_trash_delete' && response.value) {
      this.notificationService.showSuccess('File permanently deleted');
      this.getFileList();
      this.getFileTrashList();
      this.operationSuccess.emit('file_trash_delete');
    }

    if (response && response.type === 'file_load_thumbnail') {
      if (response.data && response.data instanceof ArrayBuffer && response.data.byteLength > 0) {
        try {
          this.thumbnailLoaded.emit({
            uuid: response.uuid || response.value || '',
            data: response.data
          });
        } catch (e) {
        }
      }
    }

    if (response && response.type === 'file_load_waveform') {
      if (response.data && response.data instanceof ArrayBuffer && response.data.byteLength > 0) {
        try {
          this.waveformLoaded.emit({
            uuid: response.uuid || response.value || '',
            data: response.data
          });
        } catch (e) {
        }
      }
    }

    if (response && response.type === 'error') {
      const error: WebSocketError = {
        action: response.action || 'unknown',
        message: response.value || 'Error desconocido',
        raw: response
      };
      
      this.errorEvent.emit(error);
      this.notificationService.showError(error.message || 'Error en la operación de media');
    }
  }

  getFileList(): void {
    this.wsService.ws.next({
      action: 'file_list'
    });
  }

  getFileTrashList(): void {
    this.wsService.ws.next({
      action: 'file_trash_list'
    });
  }

  deleteFile(fileUuid: string): void {
    this.wsService.ws.next({
      action: 'file_delete',
      value: fileUuid
    });
  }

  restoreFile(fileUuid: string): void {
    this.wsService.ws.next({
      action: 'file_restore',
      value: fileUuid
    });
  }

  permanentDeleteFile(fileUuid: string): void {
    this.wsService.ws.next({
      action: 'file_trash_delete',
      value: fileUuid
    });
  }

  loadThumbnail(fileUuid: string): void {
    this.wsService.ws.next({
      action: 'file_load_thumbnail',
      value: fileUuid
    });
  }

  loadWaveform(fileUuid: string): void {
    this.wsService.ws.next({
      action: 'file_load_waveform',
      value: fileUuid
    });
  }

  private isAudioFile(file: any): boolean {
    if (!file?.type) return false;
    const t = file.type.toUpperCase();
    return t.includes('AUDIO') || ['MP3', 'WAV', 'AAC', 'OGG', 'FLAC', 'M4A', 'WMA', 'OPUS', 'AIFF', 'APE', 'ALAC'].includes(t);
  }

  private isVideoFile(file: any): boolean {
    if (!file?.type) return false;
    const t = file.type.toUpperCase();
    return t.includes('VIDEO') || t.includes('MOVIE') || ['MP4', 'AVI', 'MOV', 'MKV', 'WMV', 'FLV', 'WEBM', 'M4V', 'OGV'].includes(t);
  }

  getFileByType(type: 'audio' | 'video'): any {
    const fileList = this.fileList();
    if (!fileList || fileList.length === 0) return null;
    const isTarget = type === 'audio'
      ? (f: any) => this.isAudioFile(f) || this.isVideoFile(f)
      : (f: any) => this.isVideoFile(f);
    for (const fileObj of fileList) {
      const fileKeys = Object.keys(fileObj);
      if (fileKeys.length > 0) {
        const uuid = fileKeys[0];
        const file = fileObj[uuid];
        if (file && isTarget(file)) return file;
      }
    }
    const randomFileObj = fileList[Math.floor(Math.random() * fileList.length)];
    const randomKeys = Object.keys(randomFileObj);
    if (randomKeys.length > 0) {
      return randomFileObj[randomKeys[0]];
    }
    return null;
  }

  getFilesByType(type: 'audio' | 'video'): Array<{uuid: string, file: any}> {
    const fileList = this.fileList();
    if (!fileList || fileList.length === 0) return [];
    const isTarget = type === 'audio'
      ? (f: any) => this.isAudioFile(f) || this.isVideoFile(f)
      : (f: any) => this.isVideoFile(f);
    const filteredFiles: Array<{uuid: string, file: any}> = [];
    for (const fileObj of fileList) {
      const fileKeys = Object.keys(fileObj);
      if (fileKeys.length > 0) {
        const uuid = fileKeys[0];
        const file = fileObj[uuid];
        if (file && isTarget(file)) filteredFiles.push({ uuid, file });
      }
    }
    return filteredFiles;
  }
} 