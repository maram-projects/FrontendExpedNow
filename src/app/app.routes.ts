import { Routes } from '@angular/router';
import { RegisterLandingComponent } from './components/registers/register-landing/register-landing.component';
import { LoginComponent } from './components/login/login.component';
import { AdminLayoutComponent } from './components/admin-dashboard/admin-layout/admin-layout.component';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { EditProfileComponent } from './components/profile/edit-profile/edit-profile.component';
import { VehicleListComponent } from './components/vehicles/vehicle-list/vehicle-list.component';
import { VehicleFormComponent } from './components/vehicles/vehicle-form/vehicle-form.component';
import { VehicleDetailComponent } from './components/vehicles/vehicle-detail/vehicle-detail.component';
import { UserManagementComponent } from './components/admin-dashboard/user-management/user-management.component';
import { RoleManagementComponent } from './components/admin-dashboard/role-management/role-management.component';
import { SettingsComponent } from './components/admin-dashboard/settings/settings.component';
import { IndividualRegisterComponent } from './components/registers/individual-register/individual-register.component';
import { EnterpriseRegisterComponent } from './components/registers/enterprise-register/enterprise-register.component';
import { TemporaryRegisterComponent } from './components/registers/temporary-register/temporary-register.component';
import { HomeComponent } from './components/home/home/home.component';
import { homeGuard } from './guards/home.guard';
import { AdminDashboardComponentComponent } from './components/admin-dashboard/admin-dashboard-component/admin-dashboard-component.component';
import { ScheduleComponent } from './components/admin-dashboard/schedule/schedule.component';
import { DeliveryPersonnelManagementComponent } from './components/admin-dashboard/delivery-personnel-management/delivery-personnel-management.component';
import { ProfessionalRegisterComponent } from './components/registers/professional-register/professional-register.component';
import { ForgetPasswordComponent } from './components/forget-password/forget-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { UserDetailsComponent } from './components/profile/user-details/user-details.component';

export const routes: Routes = [
  // Public routes
  {
    path: '',
    component: HomeComponent,
    canActivate: [homeGuard]
  },
  {
    path: 'register',
    component: RegisterLandingComponent,
    children: [
      { path: 'individual', component: IndividualRegisterComponent },
      { path: 'enterprise', component: EnterpriseRegisterComponent },
      { path: 'temporary', component: TemporaryRegisterComponent },
      { path: 'professional', component: ProfessionalRegisterComponent },
      { path: '', redirectTo: 'individual', pathMatch: 'full' }
    ]
  },
  { 
    path: 'login', 
    component: LoginComponent 
  },
  { 
    path: 'forgot-password', 
    component: ForgetPasswordComponent 
  },
  { 
    path: 'reset-password', 
    component: ResetPasswordComponent 
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
    data: { role: 'delivery' },
    loadChildren: () => import('./components/delivery/delivery-dashboard/delivery.routes').then(m => m.DELIVERY_ROUTES)
  },

  // Admin routes
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    component: AdminLayoutComponent,
    children: [
      { path: 'dashboard', component: AdminDashboardComponentComponent },
      { path: 'users', component: UserManagementComponent },
      { path: 'roles', component: RoleManagementComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'users/edit/:id', component: EditProfileComponent },
      { path: 'availability', component: ScheduleComponent },
      { path: 'DeliveryPersonnel', component: DeliveryPersonnelManagementComponent },
      { path: 'vehicles', component: VehicleListComponent },
      { path: 'vehicles/create', component: VehicleFormComponent },
      { path: 'vehicles/edit/:id', component: VehicleFormComponent },
      { path: 'vehicles/:id', component: VehicleDetailComponent },
      { path: 'users/view/:id', component: UserDetailsComponent },
      { 
        path: 'discounts', 
        loadComponent: () => import('./components/admin-dashboard/admin-discount/admin-discount.component').then(m => m.AdminDiscountComponent) 
      },
      { 
        path: 'payments', 
        loadComponent: () => import('./components/admin-dashboard/admin-payment/admin-payment.component').then(m => m.AdminPaymentComponent) 
      },
      { 
        path: 'payments/:id', 
        loadComponent: () => import('./components/admin-dashboard/payment-details/payment-details.component').then(m => m.PaymentDetailsComponent) 
      },
      { 
        path: 'bonuses', 
        loadComponent: () => import('./components/admin-dashboard/admin-bonuses/admin-bonuses.component').then(m => m.AdminBonusesComponent) 
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // Profile routes
  {
    path: 'profile',
    canActivate: [authGuard],
    children: [
      { path: 'edit', component: EditProfileComponent },
      { path: '', redirectTo: 'edit', pathMatch: 'full' }
    ]
  },

  // Redirects
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: '', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];