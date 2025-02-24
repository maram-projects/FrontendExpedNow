import { Routes } from '@angular/router';
import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { AdminDashboardComponentComponent } from './components/admin-dashboard/admin-dashboard-component/admin-dashboard-component.component';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { 
    path: 'admin', 
    canActivate: [adminGuard],
    children: [
      { 
        path: 'dashboard',  // This is the missing route
        component: AdminDashboardComponentComponent 
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },  // Redirect empty admin path to dashboard
      { path: 'users', loadComponent: () => import('./components/admin-dashboard/user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'roles', loadComponent: () => import('./components/admin-dashboard/role-management/role-management.component').then(m => m.RoleManagementComponent) },
      { path: 'settings', loadComponent: () => import('./components/admin-dashboard/settings/settings.component').then(m => m.SettingsComponent) }
    ]
  },

  {
    path: 'client',
    canActivate: [authGuard, roleGuard],
    data: { role: 'client' },
    loadChildren: () => import('./components/client/client.routes').then(m => m.CLIENT_ROUTES)
  },
  {
    path: 'delivery',
    canActivate: [authGuard, roleGuard],
    data: { role: 'delivery' },
    loadChildren: () => import('./components/delivery/delivery-dashboard/delivery.routes').then(m => m.DELIVERY_ROUTES)
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },

];