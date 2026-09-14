import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { HrService, Employee } from './services/hr.service';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-hr',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './hr.component.html',
  styleUrl: './hr.component.scss'
})
export class HrComponent implements OnInit {
  private hrService = inject(HrService);
  private rbacService = inject(RbacService);

  canManageEmployees = computed(() => this.rbacService.hasPermission('hr:manage_employees'));
  
  employees = signal<Employee[]>([]);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    this.hrService.getEmployees().subscribe({
      next: (data) => {
        this.employees.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching employees', err);
        this.isLoading.set(false);
      }
    });
  }

  async onboardEmployee() {
    if (!this.canManageEmployees()) {
      return;
    }

    const mockEmployee: Omit<Employee, 'id'> = {
      employeeId: `EMP-${Math.floor(Math.random() * 10000)}`,
      firstName: 'John',
      lastName: 'Smith',
      department: 'Field Operations',
      role: 'Surveyor',
      locationId: 'LOC-North',
      status: 'Active',
      joinedAt: Date.now()
    };
    
    await this.hrService.addEmployee(mockEmployee);
  }
}
