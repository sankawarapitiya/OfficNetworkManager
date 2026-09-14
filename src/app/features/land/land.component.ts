import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { LandService, LandRecord } from './services/land.service';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-land',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './land.component.html',
  styleUrl: './land.component.scss'
})
export class LandComponent implements OnInit {
  private landService = inject(LandService);
  private rbacService = inject(RbacService);

  canRegisterDeed = computed(() => this.rbacService.hasPermission('land:register_deed'));
  
  landRecords = signal<LandRecord[]>([]);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    this.landService.getLandRecords().subscribe({
      next: (data) => {
        this.landRecords.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching land records', err);
        this.isLoading.set(false);
      }
    });
  }

  async registerNewParcel() {
    if (!this.canRegisterDeed()) {
      return;
    }

    const mockRecord: Omit<LandRecord, 'id'> = {
      ownerCustomerId: 'CUST-MOCK',
      deedNumber: `DEED-${Math.floor(Math.random() * 10000)}`,
      division: 'West Division',
      sizeSqm: Math.floor(Math.random() * 5000) + 100
    };
    
    await this.landService.addLandRecord(mockRecord);
  }
}
