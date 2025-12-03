import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AppConfig } from '../../core/config/app.config';
import { Subject } from 'rxjs';
import * as CryptoJS from 'crypto-js';

export interface UploadParams {
  file: File;
  chunksize: number;
  onSuccess?: (fileUuid: string) => void;
  onError?: (error: any) => void;
}

@Injectable({
  providedIn: 'root'
})

export class UploadService {
  private destroyRef = inject(DestroyRef);

  private wsUploadUrl = `${AppConfig.websocketBaseUrl}/upload`;

  public isUploading = signal(false);

  public uploadComplete = new Subject<{ fileId: string; fileUuid: string }>();
  public uploadError = new Subject<{ fileId: string; error: string }>();
  public mediaListRefreshNeeded = new Subject<void>();

  /**
   * Upload an individual file
   */
  public uploadFile(params: UploadParams): void {
    console.log('ImportService: Starting project import ', params.file.name);

    //Marcar que se está subiendo un archivo
    this.isUploading.set(true);

    const performUploadWcallbacks = () => {
      const fileId = this.generateTempId(params.file);

      const enhancedParams: UploadParams = {
        ...params,
        onSuccess: (fileUuid) => {
          console.log('ImportService: File uploaded successfully, UUID: ', fileUuid);

          //notificar éxito a partir del subject
          this.uploadComplete.next({
            fileId, //ID temporal
            fileUuid
          });

          //Delay para tiempo del servidor
          setTimeout(() => {
            this.mediaListRefreshNeeded.next();
          }, 1000);

          //Dejar de subir
          this.isUploading.set(false);

          //llamar al callback original
          if (params.onSuccess) {
            params.onSuccess(fileUuid);
          }
        },
        onError: (error) => {
          const errorMessage = typeof error === 'string' ? error : 'Unknown error';

          //notificar error a través del subject
          this.uploadError.next({
            fileId,
            error: errorMessage
          });

          //dejar de subir
          this.isUploading.set(false);

          //llamar al callback original
          if (params.onError) {
            params.onError(error);
          }
        }
      };

      //ejecutar la subida
      this.performUpload(enhancedParams);
    };

    performUploadWcallbacks();
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

        const progress = Math.round((sliceStart * 100) / end);
        if (params.onProgress) {
          params.onProgress(progress);
        }

        sliceStart = sliceEnd;
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

  //método para generar un ID único
  private generateTempId(file: File): string {
    // Usar nombre + timestamp como ID único temporal
    return `${file.name}-${Date.now()}`;
  }
}
