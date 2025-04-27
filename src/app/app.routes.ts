import { Routes } from '@angular/router';
import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { AdminDashboardComponentComponent } from './components/admin-dashboard/admin-dashboard-component/admin-dashboard-component.component';
import { AdminLayoutComponent } from './components/admin-dashboard/admin-layout/admin-layout.component';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { EditProfileComponent } from './components/profile/edit-profile/edit-profile.component';
import { VehicleListComponent } from './components/admin-dashboard/vehicle-list/vehicle-list.component';
import { VehicleFormComponent } from './components/admin-dashboard/vehicle-form/vehicle-form.component';
import { UserManagementComponent } from './components/admin-dashboard/user-management/user-management.component';
import { RoleManagementComponent } from './components/admin-dashboard/role-management/role-management.component';
import { SettingsComponent } from './components/admin-dashboard/settings/settings.component';

export const routes: Routes = [
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  
  // Admin routes
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard], // Ensure only admins can access
    component: AdminLayoutComponent, // Use AdminLayoutComponent as the parent container
    children: [
      {
        path: 'dashboard',
        component: AdminDashboardComponentComponent
      },
      {
        path: 'users',
        component: UserManagementComponent 
      },
      {
        path: 'roles',
        component: RoleManagementComponent
      },
      {
        path: 'settings',
        component: SettingsComponent
      },
      {
        path: 'vehicles',
        component: VehicleListComponent
      },
      {
        path: 'vehicles/new',
        component: VehicleFormComponent
      },
      {
        path: 'vehicles/:id/edit',
        component: VehicleFormComponent
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' } // Redirect empty admin path to dashboard
    ]
  },
  
  // Client routes
  {
    path: 'client',
    canActivate: [authGuard, roleGuard],
    data: { role: 'client' },
    loadChildren: () => import('./components/client/client.routes').then(m => m.CLIENT_ROUTES)
  },
  
  
  // Delivery routes
  {
    path: 'delivery',
    canActivate: [authGuard, roleGuard],
    data: { role: 'delivery' }, // Ensure only delivery users can access
    loadChildren: () => import('./components/delivery/delivery-dashboard/delivery.routes').then(m => m.DELIVERY_ROUTES)
  },
 

  // Profile routes
  {
    path: 'profile',
    canActivate: [authGuard], // Ensure only authenticated users can access
    children: [
      {
        path: 'edit',
        component: EditProfileComponent // Add the EditProfileComponent route
      },
      { path: '', redirectTo: 'edit', pathMatch: 'full' } // Redirect empty profile path to edit profile
    ]
  },
  
  // Default routes
  { path: '', redirectTo: '/login', pathMatch: 'full' }, // Redirect to login by default
  { path: '**', redirectTo: '/login' } // Redirect to login for unknown routes
];