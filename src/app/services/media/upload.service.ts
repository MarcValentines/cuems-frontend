import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AppConfig } from '../../core/config/app.config';
import { Subject } from 'rxjs';
import * as CryptoJS from 'crypto-js';

export interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface UploadParams {
  file: File;
  chunksize: number;
  onProgress?: (progress: number) => void;
  onSuccess?: (fileUuid: string) => void;
  onError?: (error: any) => void;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private destroyRef = inject(DestroyRef);
  
  private wsUploadUrl = `${AppConfig.websocketBaseUrl}/upload`;
  
  public uploadQueue = signal<FileUploadItem[]>([]);
  public isUploading = signal(false);
  
  public uploadProgress = new Subject<{ fileId: string; progress: number }>();
  public uploadComplete = new Subject<{ fileId: string; fileUuid: string }>();
  public uploadError = new Subject<{ fileId: string; error: string }>();
  public mediaListRefreshNeeded = new Subject<void>();


  /**
   * Add files to the upload queue
   */
  addFiles(files: FileList | File[]): void {
    const fileArray = Array.from(files);
    const newItems: FileUploadItem[] = fileArray.map(file => ({
      id: this.generateId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending'
    }));

    const currentQueue = this.uploadQueue();
    this.uploadQueue.set([...currentQueue, ...newItems]);
  }

  /**
   * Start uploading all pending files
   */
  uploadAll(): void {
    const queue = this.uploadQueue();
    const pendingFiles = queue.filter(item => item.status === 'pending');
    
    if (pendingFiles.length === 0) {
      return;
    }

    this.isUploading.set(true);
    
    this.uploadNextFile();
  }

  /**
   * Upload the next file in the queue
   */
  private uploadNextFile(): void {
    const queue = this.uploadQueue();
    const nextFile = queue.find(item => item.status === 'pending');
    
    console.log('UploadService: Looking for next file to upload. Found:', nextFile?.name || 'none');
    
    if (!nextFile) {
      console.log('UploadService: No more files to upload, stopping');
      this.isUploading.set(false);
      return;
    }

    console.log('UploadService: Starting upload for file:', nextFile.name);
    this.uploadFile(nextFile);
  }

  /**
   * Upload an individual file
   */
  private uploadFile(item: FileUploadItem): void {
    const params: UploadParams = {
      file: item.file,
      chunksize: 500000,
      onProgress: (progress) => {
        this.updateFileProgress(item.id, progress);
        this.uploadProgress.next({ fileId: item.id, progress });
      },
      onSuccess: (fileUuid) => {
        console.log('UploadService: File upload successful, UUID:', fileUuid, 'for file:', item.name);
        this.updateFileStatus(item.id, 'completed');
        this.uploadComplete.next({ fileId: item.id, fileUuid });
        
        // Delay to give the server time to process the file
        setTimeout(() => {
          this.mediaListRefreshNeeded.next();
        }, 1000);
        
        this.uploadNextFile();
      },
      onError: (error) => {
        const errorMessage = typeof error === 'string' ? error : 'Error desconocido durante la subida';
        this.updateFileStatus(item.id, 'error', errorMessage);
        this.uploadError.next({ fileId: item.id, error: errorMessage });
        this.uploadNextFile(); 
      }
    };

    this.updateFileStatus(item.id, 'uploading');
    this.performUpload(params);
  }

  private performUpload(params: UploadParams): void {
    console.log('UploadService: Connecting to WebSocket:', this.wsUploadUrl);
    
    const wsSubject: WebSocketSubject<any> = webSocket({
      url: this.wsUploadUrl,
      serializer: (msg: any) => msg,
      openObserver: {
        next: () => {
          console.log('UploadService: WebSocket connection opened');
        }
      },
      closeObserver: {
        next: () => {
          console.log('UploadService: WebSocket connection closed');
        }
      }
    });

    let status: any;
    const md5 = CryptoJS.algo.MD5.create();
    const file = params.file;
    
    const reader = new FileReader();
    const chunksize = params.chunksize;
    let sliceStart = 0;
    const end = file.size;
    let finished = false;
    const errorMessages: any[] = [];

    const filedata = { 
      action: 'upload', 
      value: { 
        name: file.name, 
        size: file.size 
      }
    };

    reader.onload = (event) => {
      if (event.target?.result) {
        console.log('UploadService: Sending chunk, size:', (event.target.result as ArrayBuffer).byteLength);
        wsSubject.next(event.target.result);
        md5.update(CryptoJS.lib.WordArray.create(event.target.result as ArrayBuffer));
      }
    };

    wsSubject.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (msg) => {
        console.log('UploadService: Received message from server:', msg);
        status = msg;

        if (status.type === 'file_save') {
          console.log('UploadService: file_save response received on upload websocket (should not happen)');
          return;
        }

        if (finished && (status.success || status.complete)) {
          console.log('UploadService: Upload websocket confirmed finished signal');
          wsSubject.complete();
          return;
        }

        if (status.close) {
          console.log('UploadService: Server sent close signal');
          wsSubject.complete();
          return;
        }

        if (status.error || status.type === 'error') {
          const errorMsg = status.error || status.value || 'Error durante la subida';
          console.error('UploadService: Server error:', errorMsg);
          if (params.onError) {
            params.onError(errorMsg);
          }
          errorMessages.push(status);
          if (status.fatal) {
            wsSubject.complete();
          }
          return;
        }

        if (!status.ready) {
          console.log('UploadService: Server not ready, message type:', status.type || 'unknown', 'content:', status);
          return;
        }

        console.log('UploadService: Server ready for next chunk');

        // Upload finished, send 'finished' to the upload websocket
        if (finished) {
          if (params.onProgress) {
            params.onProgress(100);
          }
          const hash = md5.finalize();
          const hashHex = hash.toString(CryptoJS.enc.Hex);
          
          console.log('UploadService: Upload finished, sending finished signal with hash:', hashHex);
          
          // Send action 'finished' to the upload websocket
          wsSubject.next(JSON.stringify({ action: 'finished', value: hashHex }));
          console.log('UploadService: Sent finished signal to upload websocket');
          console.log('UploadService: Archivo cargado correctamente');
          
          if (params.onSuccess) {
            params.onSuccess('file-uploaded-' + hashHex);
          }
          
          wsSubject.complete();
          return;
        }

        //The server is ready for the next chunk
        let sliceEnd = sliceStart + (status.chunksize || chunksize);
        if (sliceEnd >= end) {
          sliceEnd = end;
          finished = true;
        }

        console.log(`UploadService: Reading chunk ${sliceStart}-${sliceEnd} of ${end}`);
        const chunk = file.slice(sliceStart, sliceEnd);
        reader.readAsArrayBuffer(chunk);

        sliceStart = sliceEnd;
        const progress = Math.min(100, Math.round((sliceStart * 100) / end));
        if (params.onProgress) {
          params.onProgress(progress);
        }
      },
      error: (err) => {
        console.error('Upload WebSocket error:', err);
        
        if (errorMessages.length === 0) {
          errorMessages[0] = {
            error: 'Error de conexión durante la subida'
          };
        }

        if (params.onError) {
          params.onError(errorMessages[0].error);
        }
      }
    });

    // Start uploading sending the file data
    console.log('UploadService: Sending initial file data');
    wsSubject.next(JSON.stringify(filedata));
  }

  private getFileTypeFromExtension(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'];
    const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    
    if (audioExtensions.includes(extension)) {
      return 'AUDIO';
    } else if (videoExtensions.includes(extension)) {
      return 'VIDEO';
    } else if (imageExtensions.includes(extension)) {
      return 'IMAGE';
    } else {
      return 'FILE';
    }
  }

  private updateFileProgress(fileId: string, progress: number): void {
    const queue = this.uploadQueue();
    const updatedQueue = queue.map(item => 
      item.id === fileId ? { ...item, progress } : item
    );
    this.uploadQueue.set(updatedQueue);
  }

  private updateFileStatus(fileId: string, status: FileUploadItem['status'], error?: string): void {
    const queue = this.uploadQueue();
    const updatedQueue = queue.map(item => 
      item.id === fileId ? { ...item, status, error } : item
    );
    this.uploadQueue.set(updatedQueue);
  }

  clearQueue(): void {
    this.uploadQueue.set([]);
  }

  removeFile(fileId: string): void {
    const queue = this.uploadQueue();
    const updatedQueue = queue.filter(item => item.id !== fileId);
    this.uploadQueue.set(updatedQueue);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 