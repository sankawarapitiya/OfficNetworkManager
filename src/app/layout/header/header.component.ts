import { Component, inject, OnInit, OnDestroy, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { RbacService } from '../../auth/rbac.service';
import { EventLogService, EventLog } from '../../core/services/event-log.service';
import { LetterService } from '../../features/letters/services/letter.service';
import { Letter } from '../../features/letters/models/letter.model';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    MatToolbarModule, 
    MatIconModule, 
    MatButtonModule, 
    MatMenuModule, 
    MatDividerModule, 
    MatTooltipModule,
    MatBadgeModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() toggleSidenav = new EventEmitter<void>();

  authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private eventLogService = inject(EventLogService);
  private letterService = inject(LetterService);

  recentLogs = signal<EventLog[]>([]);
  isNotificationsOpen = signal<boolean>(false);
  hasUnread = signal<boolean>(false);
  isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  allLetters = signal<Letter[]>([]);

  userDepartment = computed(() => {
    return this.rbacService.userDepartment() || '';
  });

  // All letters belonging to user (assigned directly or to user's department)
  userLetters = computed(() => {
    const user = this.authService.currentUser();
    const dept = this.userDepartment();
    return this.letterService.filterLettersForUser(this.allLetters(), user, dept);
  });

  // Pending letters requiring officer turnaround
  userPendingLetters = computed(() => {
    return this.userLetters().filter(l => 
      l.status !== 'Completed' && l.status !== 'Archived' && l.status !== 'Dispatched'
    );
  });

  userPendingCount = computed(() => this.userPendingLetters().length);

  userUrgentCount = computed(() => {
    return this.userPendingLetters().filter(l => l.priority === 'Urgent' || l.priority === 'Immediate').length;
  });

  private onlineHandler = () => this.isOnline.set(true);
  private offlineHandler = () => this.isOnline.set(false);

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }

    this.eventLogService.getRecentLogs(10).subscribe({
      next: (logs) => {
        this.recentLogs.set(logs);
        if (!this.isNotificationsOpen() && logs.length > 0) {
          this.hasUnread.set(true);
        }
      }
    });

    this.letterService.getLetters().subscribe({
      next: (letters) => {
        this.allLetters.set(letters || []);
      },
      error: (err) => console.warn('Could not load letters for header notifications', err)
    });
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
  }

  getUserInitials(): string {
    const user = this.authService.currentUser();
    if (!user) return 'U';
    if (user.displayName) {
      const parts = user.displayName.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (user.email) return user.email.substring(0, 2).toUpperCase();
    return 'AD';
  }

  getUserDisplayName(): string {
    const user = this.authService.currentUser();
    return user?.displayName || user?.email?.split('@')[0] || 'Administrator';
  }

  markRead() {
    this.hasUnread.set(false);
  }

  async onLogout() {
    await this.authService.logout();
  }
}
