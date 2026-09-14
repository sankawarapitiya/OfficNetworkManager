import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Customer, CustomerService } from './services/customer.service';
import { SettingsService, Division } from '../settings/settings.service';
import { NotificationService } from '../../core/services/notification.service';
import { EventLogService } from '../../core/services/event-log.service';
import { CustomerDialogComponent } from './customer-dialog.component';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule, MatPaginatorModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, 
    MatSelectModule, MatDialogModule, MatProgressSpinnerModule, MatTooltipModule
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  private customerService = inject(CustomerService);
  private settingsService = inject(SettingsService);
  private notif = inject(NotificationService);
  private eventLog = inject(EventLogService);
  private dialog = inject(MatDialog);
  private rbacService = inject(RbacService);

  // RBAC Permission Computations
  canCreateCustomer = computed(() => this.rbacService.hasPermission('customers:create'));
  canEditCustomer = computed(() => this.rbacService.hasPermission('customers:edit'));
  canDeleteCustomer = computed(() => this.rbacService.hasPermission('customers:delete'));
  canExportCustomers = computed(() => this.rbacService.hasPermission('customers:export'));
  
  customers = signal<Customer[]>([]);
  divisions = signal<Division[]>([]);
  isLoading = signal<boolean>(true);

  displayedColumns: string[] = ['name', 'contact', 'division', 'status', 'actions'];

  // Filter and Pagination State
  searchTerm = signal<string>('');
  filterDivision = signal<string>('');
  filterStatus = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Computed properties
  filteredCustomers = computed(() => {
    let filtered = this.customers();
    
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(search) || 
        c.nic.toLowerCase().includes(search) ||
        c.tpno.includes(search)
      );
    }
    
    const division = this.filterDivision();
    if (division) {
      filtered = filtered.filter(c => c.division === division);
    }

    const status = this.filterStatus();
    if (status) {
      filtered = filtered.filter(c => c.status === status);
    }
    
    return filtered;
  });

  paginatedCustomers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredCustomers().slice(start, start + this.pageSize());
  });

  // Computed Dashboard Stats
  totalClients = computed(() => this.customers().length);
  recentRegistrations = computed(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.customers().filter(c => c.createdAt > sevenDaysAgo).length;
  });

  ngOnInit() {
    this.customerService.getCustomers().subscribe({
      next: (data) => {
        this.customers.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching customers', err);
        this.isLoading.set(false);
      }
    });

    this.settingsService.getDivisions().subscribe({
      next: (data) => this.divisions.set(data),
      error: (err) => console.error('Error fetching divisions', err)
    });
  }

  onFilterChange() {
    this.currentPage.set(1);
  }

  onPageChange(event: PageEvent) {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  openCreateModal() {
    if (!this.canCreateCustomer()) {
      this.notif.error('You do not have permission to register new citizens.');
      return;
    }

    const dialogRef = this.dialog.open(CustomerDialogComponent, {
      width: '500px',
      data: { divisions: this.divisions() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.saveCustomer(result);
      }
    });
  }

  openEditModal(customer: Customer) {
    if (!this.canEditCustomer()) {
      this.notif.error('You do not have permission to edit customer records.');
      return;
    }

    const dialogRef = this.dialog.open(CustomerDialogComponent, {
      width: '500px',
      data: { customer, divisions: this.divisions() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.saveCustomer(result, customer.id);
      }
    });
  }

  async deleteCustomer(id: string) {
    if (!this.canDeleteCustomer()) {
      this.notif.error('You do not have permission to delete customer records.');
      return;
    }

    const isLinked = await this.customerService.isCustomerLinked(id);
    if (isLinked) {
      this.notif.showErrorBox('Cannot Delete', 'This customer is linked to records in Land or Work Plans modules. Please remove linked data first.');
      return;
    }

    const confirmed = await this.notif.confirmDelete('this customer');
    if (confirmed) {
      try {
        await this.customerService.deleteCustomer(id);
        this.eventLog.logAction('DELETED', 'Customers', `Deleted customer ID: ${id}`);
        this.notif.success('Customer deleted successfully');
      } catch (err) {
        console.error('Error deleting customer', err);
        this.notif.error('Failed to delete customer');
      }
    }
  }

  exportCustomers() {
    if (!this.canExportCustomers()) {
      this.notif.error('You do not have permission to export customer data.');
      return;
    }

    const data = this.filteredCustomers();
    if (data.length === 0) {
      this.notif.error('No customer records available to export.');
      return;
    }

    const csvRows = [
      ['Name', 'NIC', 'Phone', 'Address', 'Division', 'Status'].join(','),
      ...data.map(c => [
        `"${c.name}"`,
        `"${c.nic}"`,
        `"${c.tpno}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${c.division}"`,
        `"${c.status}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.eventLog.logAction('SYSTEM', 'Customers', `Exported ${data.length} customer records to CSV`);
    this.notif.success(`Exported ${data.length} customer records successfully`);
  }

  saveCustomer(formValue: any, editingId?: string) {
    try {
      if (editingId) {
        // Update existing optimistically
        this.customerService.updateCustomer(editingId, {
          name: formValue.name,
          address: formValue.address,
          tpno: formValue.tpno,
          division: formValue.division,
          nic: formValue.nic
        }).then(() => {
          this.eventLog.logAction('UPDATED', 'Customers', `Updated customer ${formValue.name} (${formValue.nic})`);
        }).catch(err => console.error('Background sync failed', err));
        
        this.notif.success('Customer updated successfully');
      } else {
        // Create new optimistically
        const newCustomer: Omit<Customer, 'id'> = {
          name: formValue.name,
          address: formValue.address,
          tpno: formValue.tpno,
          division: formValue.division,
          nic: formValue.nic,
          status: 'active',
          createdAt: Date.now()
        };
        
        this.customerService.addCustomer(newCustomer)
          .then(() => {
            this.eventLog.logAction('CREATED', 'Customers', `Created new customer ${formValue.name} (${formValue.nic})`);
          })
          .catch(err => console.error('Background sync failed', err));
          
        this.notif.success('Customer created successfully');
      }
    } catch (err) {
      console.error('Error saving customer', err);
      this.notif.error('Failed to save customer');
    }
  }
}
