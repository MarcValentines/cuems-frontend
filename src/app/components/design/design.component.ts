import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppPageHeaderComponent } from '../layout/app-page-header/app-page-header.component';
import { ButtonComponent } from '../ui/button/button.component';
import { IconComponent } from '../ui/icon/icon.component';
import { RouterLink } from '@angular/router';
import { ModalComponent, ModalSize } from '../ui/modal/modal.component';
import { ConfirmationDialogComponent } from '../ui/confirmation-dialog/confirmation-dialog.component';
import { TooltipDirective } from '../../core/directives/tooltip.directive';

@Component({
  selector: 'app-design',
  standalone: true,
  imports: [
    CommonModule, 
    AppPageHeaderComponent, 
    ButtonComponent, 
    IconComponent, 
    RouterLink,
    ModalComponent,
    ConfirmationDialogComponent,
    TooltipDirective
  ],
  templateUrl: './design.component.html'
})
export class DesignComponent {
  isLoading = false;

  isBaseModalOpen = false;
  isScrollModalOpen = false;
  isSizeModalOpen = false;
  isConfirmationModalOpen = false;

  selectedSize: ModalSize = 'md';

  confirmationConfig = {
    title: 'Eliminar elemento',
    message: '¿Estás seguro de que quieres eliminar este elemento? Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar'
  };

  constructor() {}

  toggleLoading() {
    this.isLoading = !this.isLoading;
  }

  action() {
    console.log('clicked')
  }

  openBaseModal() {
    this.isBaseModalOpen = true;
  }

  closeBaseModal() {
    this.isBaseModalOpen = false;
  }

  openScrollModal() {
    this.isScrollModalOpen = true;
  }

  closeScrollModal() {
    this.isScrollModalOpen = false;
  }

  openSizeModal(size: ModalSize) {
    this.selectedSize = size;
    this.isSizeModalOpen = true;
  }

  closeSizeModal() {
    this.isSizeModalOpen = false;
  }

  openConfirmationModal() {
    this.isConfirmationModalOpen = true;
  }

  closeConfirmationModal() {
    this.isConfirmationModalOpen = false;
  }

  onConfirm() {
    this.closeConfirmationModal();
  }
}
