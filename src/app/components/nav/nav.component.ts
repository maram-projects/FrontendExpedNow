import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container">
        <a class="navbar-brand" href="#">ExpedNow</a>
        
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <ng-container *ngIf="authService.getCurrentUser() as user">
              <!-- Admin Navigation -->
              <ng-container *ngIf="user.userType === 'admin'">
                <li class="nav-item">
                  <a class="nav-link" routerLink="/admin/dashboard">Dashboard</a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" routerLink="/admin/users">Users</a>
                </li>
              </ng-container>

              <!-- Client Navigation -->
              <ng-container *ngIf="user.userType === 'individual' || user.userType === 'enterprise'">
                <li class="nav-item">
                  <a class="nav-link" routerLink="/client/dashboard">Dashboard</a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" routerLink="/client/orders">Orders</a>
                </li>
              </ng-container>

              <!-- Delivery Navigation -->
              <ng-container *ngIf="user.userType === 'temporary' || user.userType === 'professional'">
                <li class="nav-item">
                  <a class="nav-link" routerLink="/delivery/dashboard">Dashboard</a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" routerLink="/delivery/deliveries">Deliveries</a>
                </li>
              </ng-container>
            </ng-container>
          </ul>

          <ul class="navbar-nav">
            <ng-container *ngIf="authService.getCurrentUser(); else loginRegister">
              <li class="nav-item">
                <button class="btn btn-outline-light" (click)="logout()">Logout</button>
              </li>
            </ng-container>
            <ng-template #loginRegister>
              <li class="nav-item">
                <a class="nav-link" routerLink="/login">Login</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" routerLink="/register">Register</a>
              </li>
            </ng-template>
          </ul>
        </div>
      </div>
    </nav>
  `
})
export class NavComponent {
  constructor(public authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}