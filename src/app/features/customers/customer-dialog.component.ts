import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { Division } from '../settings/settings.service';

@Component({
  selector: 'app-customer-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Customer Registration</h2>
    <mat-dialog-content>
      <form [formGroup]="customerForm" class="dialog-form pt-2">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Full Name</mat-label>
          <input matInput formControlName="name" required>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>NIC Number</mat-label>
          <input matInput formControlName="nic" required>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Address</mat-label>
          <input matInput formControlName="address" required>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Telephone No</mat-label>
          <input matInput formControlName="tpno" required>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Division</mat-label>
          <mat-select formControlName="division" required>
            <mat-option *ngFor="let div of data.divisions" [value]="div.name">{{ div.name }}</mat-option>
          </mat-select>
          <mat-error *ngIf="data.divisions.length === 0">No divisions available. Add them in Settings.</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="customerForm.invalid" (click)="onSave()">Save Customer</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 300px;
    }
    .full-width {
      width: 100%;
    }
  `]
})
export class CustomerDialogComponent {
  private fb = inject(FormBuilder);
  
  customerForm: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { customer?: any, divisions: Division[] },
    public dialogRef: MatDialogRef<CustomerDialogComponent>
  ) {
    this.customerForm = this.fb.group({
      name: [data.customer?.name || '', Validators.required],
      nic: [data.customer?.nic || '', Validators.required],
      address: [data.customer?.address || '', Validators.required],
      tpno: [data.customer?.tpno || '', Validators.required],
      division: [data.customer?.division || '', Validators.required]
    });
  }

  onSave() {
    if (this.customerForm.valid) {
      this.dialogRef.close(this.customerForm.value);
    }
  }
}
