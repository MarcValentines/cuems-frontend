import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AppConfig } from '../../core/config/app.config';
import { Subject } from 'rxjs';
import * as CryptoJS from 'crypto-js';

export class ExportService {

}
