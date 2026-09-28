import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { LandService, LandRecord } from './services/land.service';
import { RbacService } from '../../auth/rbac.service';
import { NotificationService } from '../../core/services/notification.service';

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
  private notif = inject(NotificationService);

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
      this.notif.warning('Permission denied: You do not have permission to register deeds');
      return;
    }

    const mockRecord: Omit<LandRecord, 'id'> = {
      ownerCustomerId: 'CUST-MOCK',
      deedNumber: `DEED-${Math.floor(Math.random() * 10000)}`,
      division: 'West Division',
      sizeSqm: Math.floor(Math.random() * 5000) + 100
    };
    
    try {
      await this.landService.addLandRecord(mockRecord);
      this.notif.success(`Land deed parcel registered successfully (${mockRecord.deedNumber})`);
    } catch (err: any) {
      console.error('Failed to register land record:', err);
      this.notif.error(err?.message || 'Failed to register land record');
    }
  }
}
