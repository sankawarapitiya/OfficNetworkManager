import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  success(title: string) {
    if (!navigator.onLine) {
      this.snackBar.open('Disconnected but data is protected (will sync later)', 'Close', {
        duration: 4000,
        panelClass: ['mat-toolbar', 'mat-accent']
      });
      return;
    }

    this.snackBar.open(title, 'Close', {
      duration: 3000,
    });
  }

  error(title: string) {
    this.snackBar.open(title, 'Close', {
      duration: 5000,
      panelClass: ['mat-toolbar', 'mat-warn']
    });
  }
  
  warning(title: string) {
    this.snackBar.open(title, 'Close', {
      duration: 4000
    });
  }

  async confirmDelete(itemName: string = 'this item', extraText: string = "You won't be able to revert this!"): Promise<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Are you sure?',
        message: `Do you want to delete ${itemName}? ${extraText}`,
        confirmText: 'Yes, delete it!'
      }
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return !!result;
  }

  showErrorBox(title: string, message: string) {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: title,
        message: message,
        confirmText: 'OK'
      }
    });
  }
}
