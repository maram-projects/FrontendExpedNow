import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container-fluid">
      <div class="row">
        <!-- Sidebar -->
        <nav class="col-md-2 d-md-block sidebar">
          <div class="sidebar-header">
            <h3>Admin Panel</h3>
          </div>
          <ul class="nav flex-column">
            <li class="nav-item">
              <a class="nav-link" routerLink="/admin/dashboard" routerLinkActive="active">
                <i class="fas fa-tachometer-alt"></i>
                <span>Dashboard Overview</span>
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/admin/users" routerLinkActive="active">
                <i class="fas fa-users"></i>
                <span>User Management</span>
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/admin/DeliveryPersonnel" routerLinkActive="active">
                <i class="fas fa-users"></i>
                <span>Delivery Personnel Management</span>
              </a>
            </li>
           
      
            <li class="nav-item">
              <a class="nav-link" routerLink="/admin/vehicles" routerLinkActive="active">
                <i class="fas fa-car"></i>
                <span>Vehicle Management</span>
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/admin/availability" routerLinkActive="active">
                <i class="fas fa-calendar-alt"></i>
                <span>Availability Schedule</span>
              </a>
            </li>
            <!-- New Navigation Items -->
            <li class="nav-item">
              <a class="nav-link" routerLink="/admin/discounts" routerLinkActive="active">
                <i class="fas fa-tag"></i>
                <span>Discount Management</span>
              </a>
            </li>
          <li class="nav-item">
  <a class="nav-link" routerLink="/admin/payments" routerLinkActive="active">
    <i class="fas fa-credit-card"></i>
    <span>Payment Management</span>
  </a>
</li>

            <li class="nav-item">
              <a class="nav-link" routerLink="/admin/bonuses" routerLinkActive="active">
                <i class="fas fa-gift"></i>
                <span>Bonus Management</span>
              </a>
            </li>
             <li class="nav-item">
              <a class="nav-link" routerLink="/admin/roles" routerLinkActive="active">
                <i class="fas fa-user-tag"></i>
                <span>Role Management</span>
              </a>
            </li>
             <li class="nav-item">
              <a class="nav-link" routerLink="/admin/settings" routerLinkActive="active">
                <i class="fas fa-cog"></i>
                <span>System Settings</span>
              </a>
            </li>
          </ul>
        </nav>
        
        <!-- Main content -->
        <main class="col-md-10 ms-sm-auto px-md-4">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .sidebar {
      min-height: 100vh;
      background: linear-gradient(135deg, #f8f9fa 0%, #e2e6ea 100%);
      padding-top: 1rem;
      border-right: 1px solid rgb(188, 213, 237);
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
      box-shadow: 2px 0 10px rgba(0, 0, 0, 0.05);
    }

    /* Colorful gradient background */
    .sidebar::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        45deg,
        rgba(255, 105, 180, 0.1) 0%,
        rgba(111, 128, 255, 0.1) 33%,
        rgba(32, 201, 151, 0.1) 66%,
        rgba(255, 187, 85, 0.1) 100%
      );
      z-index: 0;
      opacity: 0.6;
    }

    .sidebar-header {
      padding: 0.8rem 1.2rem;
      margin-bottom: 1.2rem;
      position: relative;
      z-index: 2;
      text-align: center;
    }

    .sidebar-header h3 {
      font-weight: 700;
      background: linear-gradient(90deg, #4a6dff, #9c42ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0;
    }

    .sidebar .nav-link {
      color: #333;
      padding: 0.8rem 1.2rem;
      margin: 0.4rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 12px;
      position: relative;
      z-index: 2;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      font-weight: 500;
    }

    .sidebar .nav-link:hover {
      transform: translateX(5px);
      background-color: rgba(255, 255, 255, 0.7);
    }

    .sidebar .nav-link.active {
      color: #4a6dff;
      background: rgba(255, 255, 255, 0.8);
      box-shadow: 0 4px 12px rgba(74, 109, 255, 0.15);
      font-weight: 600;
    }

    .sidebar .nav-link i {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .sidebar .nav-link:hover i {
      transform: scale(1.2) rotate(5deg);
      color: #4a6dff;
    }

    /* Fun animation for active link */
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }

    .sidebar .nav-link.active i {
      color: #4a6dff;
      animation: pulse 1.5s infinite ease-in-out;
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .sidebar {
        min-height: auto;
        border-right: none;
        border-bottom: 1px solid rgb(188, 213, 237);
      }
      
      .sidebar .nav-link {
        padding: 0.6rem 1rem;
        margin: 0.3rem 0.6rem;
      }
    }
  `]
})
export class AdminLayoutComponent {}