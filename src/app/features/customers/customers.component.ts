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
import { LandService } from '../land/services/land.service';
import { LandJob, LandJobStatus } from '../land/models/land.model';
import { NotificationService } from '../../core/services/notification.service';
import { EventLogService } from '../../core/services/event-log.service';
import { CustomerDialogComponent } from './customer-dialog.component';
import { CustomerDetailDialogComponent } from './customer-detail-dialog.component';
import { LandJobDetailDialogComponent } from '../land/components/land-job-detail-dialog/land-job-detail-dialog.component';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatCardModule, 
    MatTableModule, 
    MatPaginatorModule,
    MatButtonModule, 
    MatIconModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatSelectModule, 
    MatDialogModule, 
    MatProgressSpinnerModule, 
    MatTooltipModule
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  private customerService = inject(CustomerService);
  private landService = inject(LandService);
  private settingsService = inject(SettingsService);
  private notif = inject(NotificationService);
  private eventLog = inject(EventLogService);
  private dialog = inject(MatDialog);
  private rbacService = inject(RbacService);

  // RBAC Permission Computations with robust Super Admin / Admin fallback
  canCreateCustomer = computed(() => 
    this.rbacService.isSuperAdmin() || this.rbacService.isAdmin() || this.rbacService.hasPermission('customers:create')
  );
  canEditCustomer = computed(() => 
    this.rbacService.isSuperAdmin() || this.rbacService.isAdmin() || this.rbacService.hasPermission('customers:edit')
  );
  canDeleteCustomer = computed(() => 
    this.rbacService.isSuperAdmin() || this.rbacService.isAdmin() || this.rbacService.hasPermission('customers:delete')
  );
  canExportCustomers = computed(() => 
    this.rbacService.isSuperAdmin() || this.rbacService.isAdmin() || this.rbacService.hasPermission('customers:export')
  );
  
  customers = signal<Customer[]>([]);
  divisions = signal<Division[]>([]);
  landJobs = signal<LandJob[]>([]);
  isLoading = signal<boolean>(true);
  expandedCustomerId = signal<string | null>(null);

  displayedColumns: string[] = ['name', 'contact', 'division', 'linkedJobs', 'status', 'actions'];

  // Filter and Pagination State
  searchTerm = signal<string>('');
  filterDSDivision = signal<string>('ALL');
  filterGNDivision = signal<string>('ALL');
  filterStatus = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  private cleanEn(s?: string): string {
    if (!s) return '';
    return s.replace(/[^\x20-\x7E]/g, '')
            .replace(/\//g, '')
            .replace(/(^[\s-]+|[\s-]+$)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
  }

  availableDSDivisions = computed(() => {
    const divs = this.divisions();
    const set = new Set<string>();

    for (const d of divs) {
      const ds = this.cleanEn(d.divisionalSecretariat);
      if (ds) set.add(ds);
    }

    for (const c of this.customers()) {
      if (c.division && c.division.trim()) {
        const clean = this.cleanEn(c.division);
        if (clean) set.add(clean);
      }
    }

    if (set.size === 0) {
      for (const d of divs) {
        const name = this.cleanEn(d.name);
        if (name) set.add(name);
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  availableGNDivisions = computed(() => {
    const divs = this.divisions();
    const selectedDs = this.filterDSDivision();
    const set = new Set<string>();

    // 1. Gather from master divisions
    for (const d of divs) {
      const ds = this.cleanEn(d.divisionalSecretariat);
      if (selectedDs === 'ALL' || !selectedDs || (ds && ds.toLowerCase() === selectedDs.toLowerCase())) {
        const val = d.gnCode ? `${d.gnCode} - ${d.name}` : d.name;
        if (val && val.trim()) {
          set.add(val.trim());
        }
      }
    }

    // 2. Gather from customer records matching selected DS
    for (const c of this.customers()) {
      if (c.gnDivision && c.gnDivision.trim()) {
        const custDs = this.cleanEn(c.division);
        if (selectedDs === 'ALL' || !selectedDs || (custDs && custDs.toLowerCase() === selectedDs.toLowerCase())) {
          set.add(c.gnDivision.trim());
        }
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  // Computed properties
  filteredCustomers = computed(() => {
    let filtered = this.customers();
    
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(search)) || 
        (c.nic && c.nic.toLowerCase().includes(search)) ||
        (c.tpno && c.tpno.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.address && c.address.toLowerCase().includes(search))
      );
    }
    
    const ds = this.filterDSDivision();
    if (ds && ds !== 'ALL') {
      const normDs = ds.toLowerCase();
      filtered = filtered.filter(c => 
        c.division && this.cleanEn(c.division).toLowerCase() === normDs
      );
    }

    const gn = this.filterGNDivision();
    if (gn && gn !== 'ALL') {
      const normGn = gn.toLowerCase();
      filtered = filtered.filter(c => {
        if (!c.gnDivision) return false;
        const custGn = c.gnDivision.toLowerCase().trim();
        return custGn === normGn || normGn.includes(custGn) || custGn.includes(normGn);
      });
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
  totalLinkedLandJobs = computed(() => this.landJobs().length);

  ngOnInit() {
    // Load Customers
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

    // Load Divisions
    this.settingsService.getDivisions().subscribe({
      next: (data) => this.divisions.set(data),
      error: (err) => console.error('Error fetching divisions', err)
    });

    // Load Land Management Jobs to link with customers
    this.landService.getLandJobs().subscribe({
      next: (jobs) => this.landJobs.set(jobs),
      error: (err) => console.error('Error fetching land jobs in customers component', err)
    });
  }

  onFilterChange() {
    this.currentPage.set(1);
  }

  onDSDivisionFilterChange(newDs: string) {
    this.filterDSDivision.set(newDs);
    this.filterGNDivision.set('ALL');
    this.onFilterChange();
  }

  onPageChange(event: PageEvent) {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  // --- Customer & Land Job Link Helper ---
  getLinkedJobs(customer: Customer): LandJob[] {
    if (!customer) return [];
    const allJobs = this.landJobs();
    const cId = customer.id?.trim();
    const cNic = customer.nic?.trim().toLowerCase();

    return allJobs.filter(j => {
      if (cId && j.customerId && j.customerId.trim() === cId) return true;
      if (cNic && j.customerNic && j.customerNic.trim().toLowerCase() === cNic) return true;
      return false;
    });
  }

  toggleRowExpand(customerId: string) {
    if (this.expandedCustomerId() === customerId) {
      this.expandedCustomerId.set(null);
    } else {
      this.expandedCustomerId.set(customerId);
    }
  }

  // --- Modal Openers ---
  viewCustomerDossier(customer: Customer) {
    const linked = this.getLinkedJobs(customer);
    const ref = this.dialog.open(CustomerDetailDialogComponent, {
      width: '940px',
      maxWidth: '96vw',
      data: {
        customer,
        linkedJobs: linked,
        divisions: this.divisions()
      }
    });

    ref.afterClosed().subscribe(() => {
      // Re-trigger if anything changed
    });
  }

  openCreateModal() {
    if (!this.canCreateCustomer()) {
      this.notif.error('You do not have permission to register new citizens.');
      return;
    }

    const dialogRef = this.dialog.open(CustomerDialogComponent, {
      width: '540px',
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
      width: '540px',
      data: { customer, divisions: this.divisions() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.saveCustomer(result, customer.id);
      }
    });
  }

  openJobDetail(job: LandJob) {
    this.dialog.open(LandJobDetailDialogComponent, {
      width: '900px',
      maxWidth: '96vw',
      data: { job }
    });
  }

  getStageIcon(status: LandJobStatus | string): string {
    switch (status) {
      case 'Initial': return 'app_registration';
      case 'Documentation': return 'attach_file';
      case 'Verification': return 'fact_check';
      case 'Completed': return 'check_circle';
      case 'Rejected': return 'cancel';
      case 'On Hold': return 'pause_circle';
      default: return 'folder';
    }
  }

  async deleteCustomer(id: string, nic?: string) {
    if (!this.canDeleteCustomer()) {
      this.notif.error('You do not have permission to delete customer records.');
      return;
    }

    const isLinked = await this.customerService.isCustomerLinked(id, nic);
    if (isLinked) {
      this.notif.showErrorBox(
        'Cannot Delete Customer',
        'This customer is linked to records in Land Management tasks. To preserve statutory audit trails and cadastral integrity, please reassign or resolve linked tasks first.'
      );
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
      ['Name', 'NIC', 'Phone', 'Email', 'Address', 'Division', 'GN Division', 'Linked Land Tasks', 'Status'].join(','),
      ...data.map(c => [
        `"${c.name}"`,
        `"${c.nic}"`,
        `"${c.tpno}"`,
        `"${c.email || ''}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${c.division}"`,
        `"${c.gnDivision || ''}"`,
        `"${this.getLinkedJobs(c).length}"`,
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
        // Update existing customer details
        const updated: Partial<Customer> = {
          name: formValue.name,
          address: formValue.address,
          tpno: formValue.tpno,
          email: formValue.email || '',
          division: formValue.division,
          gnDivision: formValue.gnDivision || '',
          nic: formValue.nic,
          status: formValue.status || 'active'
        };

        this.customerService.updateCustomer(editingId, updated).then(() => {
          this.eventLog.logAction('UPDATED', 'Customers', `Updated customer details for ${formValue.name} (${formValue.nic})`);
        }).catch(err => console.error('Background sync failed', err));
        
        this.notif.success('Customer details updated successfully');
      } else {
        // Create new customer
        const newCustomer: Omit<Customer, 'id'> = {
          name: formValue.name,
          address: formValue.address,
          tpno: formValue.tpno,
          email: formValue.email || '',
          division: formValue.division,
          gnDivision: formValue.gnDivision || '',
          nic: formValue.nic,
          status: formValue.status || 'active',
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
