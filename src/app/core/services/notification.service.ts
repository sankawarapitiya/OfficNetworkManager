import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private readonly defaultConfig: MatSnackBarConfig = {
    horizontalPosition: 'end',
    verticalPosition: 'top'
  };

  success(title: string, action = 'OK', duration = 3500) {
    if (!navigator.onLine) {
      this.snackBar.open('Disconnected but data is protected (will sync later)', 'Close', {
        ...this.defaultConfig,
        duration: 4000,
        panelClass: ['app-snackbar-offline']
      });
      return;
    }

    this.snackBar.open(title, action, {
      ...this.defaultConfig,
      duration,
      panelClass: ['app-snackbar-success']
    });
  }

  error(title: string, action = 'Dismiss', duration = 5000) {
    this.snackBar.open(title, action, {
      ...this.defaultConfig,
      duration,
      panelClass: ['app-snackbar-error']
    });
  }
  
  warning(title: string, action = 'OK', duration = 4000) {
    this.snackBar.open(title, action, {
      ...this.defaultConfig,
      duration,
      panelClass: ['app-snackbar-warning']
    });
  }

  info(title: string, action = 'OK', duration = 3500) {
    this.snackBar.open(title, action, {
      ...this.defaultConfig,
      duration,
      panelClass: ['app-snackbar-info']
    });
  }

  async confirmDelete(itemName: string = 'this item', extraText: string = "You won't be able to revert this!"): Promise<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Confirm Deletion',
        message: `Do you want to permanently delete ${itemName}? ${extraText}`,
        confirmText: 'Yes, delete it!'
      }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return !!result;
  }

  showErrorBox(title: string, message: string) {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: title,
        message: message,
        confirmText: 'OK'
      }
    });
  }
}
