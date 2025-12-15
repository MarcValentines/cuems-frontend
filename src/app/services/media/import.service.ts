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

export class ImportService {
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

    //determinar el tipo de archivo
    const fileType = this.getFileTypeFromExtension(params.file.name);
    console.log('Import Service: File type detected:', fileType);


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
    console.log('ImportService: Connecting to WebSocket:', this.wsUploadUrl);

    const wsSubject: WebSocketSubject<any> = webSocket({
      url: this.wsUploadUrl,
      serializer: (msg: any) => msg,
      openObserver: {
        next: () => {
          console.log('Import service: Websocket connection opened');
        }
      },
      closeObserver: {
        next: () => {
          console.log('Import service: WebSocket connection closed');
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

    //obtener tipo de archivo para logging
    const fileType = this.getFileTypeFromExtension(file.name);
    console.log('Import service: Uploading file type: ', fileType);

    const fileData = {
      action: 'upload',
      value: {
        name: file.name,
        size: file.size,
        type: fileType
      }
    };

    reader.onload = (event) => {
      if (event.target?.result){
        console.log('Import Service: Sending chunk, size: ', (event.target.result as ArrayBuffer).byteLength);
        wsSubject.next(event.target.result);
        md5.update(CryptoJS.lib.WordArray.create(event.target.result as ArrayBuffer));
      }
    };

    wsSubject.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (msg) => {
        console.log('Import service: Received message from  server: ', msg);
        status = msg;

        if (status.type === 'file_save') { //modificar 'file_save' para el status.type
          console.log('Import Service: file_save response received on upload webSocket (should not happen)');
          return;
        }

        if (finished && (status.success || status.complete)) {
          console.log('Import Service: Upload websocket confirmed finished signal');
          wsSubject.complete();
          return;
        }

        if (status.close) {
          console.log('Import Service: Server sent close signal');
          wsSubject.complete();
          return;
        }

        if (status.error || status.type === 'error') {
          const errorMsg = status.error || status.value || 'Error durante la subida';
          console.error('Import Service: Server error:', errorMsg);
          if (params.onError) {
            params.onError(errorMsg);
          }
          wsSubject.complete();
          return;
        }

        if (!status.ready) {
          console.log('Import Service: Server not ready, message type:', status.type || 'unknown');
          return;
        }

        console.log('ImportService: Server ready for next chunk');

        //el upload ha terminado, enviar 'finished' al websocket upload
        if (finished) {
          const hash = md5.finalize();
          const hashHex = hash.toString(CryptoJS.enc.Hex);

          console.log('Import Service: Upload finished, sending finished signal with hash:', hashHex);
          console.log('Import Service: File type completed:', fileType);

          //enviar action 'finished' al websocket upload
          wsSubject.next(JSON.stringify({ action: 'finished', value: hashHex }));
          console.log('Import Service: Sent finished signal to upload websocket');
          console.log('Import Service: Archivo cargado correctamente');

          if (params.onSuccess) {
            params.onSuccess('file-uploaded-' + hashHex);
          }

          wsSubject.complete();
          return;
        }

        //el servidor está listo para el sigiente chunk
        let sliceEnd = sliceStart + (status.chunksize || chunksize);
        if (sliceEnd >= end) {
          sliceEnd = end;
          finished = true;
        }

        console.log(`Import Service: Reading chunk ${sliceStart}-${sliceEnd} of ${end}`);
        const chunk = file.slice(sliceStart, sliceEnd);
        reader.readAsArrayBuffer(chunk);

        sliceStart = sliceEnd;
      },
      error: (err) => {
        console.error('Import Service: WebSocket error:', err);
        if (params.onError) {
          params.onError('Conexion error during the upload');
        }
      },
      complete: () => {
        console.log('Import Service: WebSocket subscription completed');
      }
    });
    // Empezar el upload con la información del archivo
    console.log('Import Service: Sending initial file data');
    wsSubject.next(JSON.stringify(fileData));
  }

  private getFileTypeFromExtension(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'];
    const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const zipExtension = ['zip'];

    if (audioExtensions.includes(extension)) {
      return 'AUDIO';
    } else if (videoExtensions.includes(extension)) {
      return 'VIDEO';
    } else if (imageExtensions.includes(extension)) {
      return 'IMAGE';
    } else if (zipExtension.includes(extension)) {
      return 'PROJECT';
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
