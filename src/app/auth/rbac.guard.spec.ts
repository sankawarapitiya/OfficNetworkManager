import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { rbacGuard } from './rbac.guard';

describe('rbacGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => rbacGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
