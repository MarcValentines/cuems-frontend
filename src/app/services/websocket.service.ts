import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AppConfig } from '../core/config/app.config';
import { Subject } from 'rxjs';

export interface WebSocketError {
  action: string | null;
  message: string;
  raw: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private destroyRef = inject(DestroyRef);
  private host = `${AppConfig.websocketBaseUrl}/ws`;

  public isConnected = signal(false);

  public ws: WebSocketSubject<any>;

  public messages = new Subject<any>();
  public errors = new Subject<WebSocketError>();

  public hasRecentError = false;

  constructor() {
    this.ws = webSocket({
      url: this.host,
      openObserver: {
        next: () => this.isConnected.set(true)
      },
      closeObserver: {
        next: () => this.isConnected.set(false)
      }
    });

    this.ws
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.handleServerMessage(response),
        error: (error) => {
          this.reconnect();
        }
      });
  }

  private handleServerMessage(response: any): void {

    if (response && response.type === 'error') {
      const experimentalActions = ['file_load_thumbnail', 'file_load_waveform'];
      const isExperimentalError = experimentalActions.includes(response.action);
      
      if (!isExperimentalError) {
        this.hasRecentError = true;

        const errorPayload: WebSocketError = {
          action: response.action || null,
          message: this.parseErrorMessage(response.value),
          raw: response
        };

        this.errors.next(errorPayload);

        setTimeout(() => {
          this.hasRecentError = false;
        }, 3000);
      }
    } else {
      this.messages.next(response);
    }
  }

  private parseErrorMessage(value: any): string {
    if (typeof value === 'string') {
      // Try to extract the main message if it's a long string
      const match = value.match(/Reason: (.+?)\n/);
      if (match) {
        return match[1];
      }
      return value;
    }
    return 'Ocurrió un error desconocido / Unknown error occurred';
  }

  wsEmit(msg: any): void {
    this.ws.next(msg);
  }


  private reconnect(): void {
    setTimeout(() => {
      this.ws = webSocket({
        url: this.host,
        openObserver: {
          next: () => this.isConnected.set(true)
        },
        closeObserver: {
          next: () => this.isConnected.set(false)
        }
      });

      this.ws
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => this.handleServerMessage(response),
          error: () => this.reconnect()
        });
    }, 10000);
  }
}
