import { Component, inject, OnInit, OnDestroy, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, ChildrenOutletContexts } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter, Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { fadeAnimation } from '../../core/animations/route.animations';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, MatSidenavModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  animations: [fadeAnimation]
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav?: MatSidenav;

  private contexts = inject(ChildrenOutletContexts);
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);

  isMobile = signal<boolean>(false);
  private sub = new Subscription();

  ngOnInit() {
    // Observe screen size changes (under 960px is mobile/tablet drawer mode)
    this.sub.add(
      this.breakpointObserver.observe(['(max-width: 960px)']).subscribe(result => {
        this.isMobile.set(result.matches);
      })
    );

    // Auto-close drawer on route change when on mobile screens
    this.sub.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        if (this.isMobile() && this.sidenav) {
          this.sidenav.close();
        }
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.routeConfig?.path || 'none';
  }
}
