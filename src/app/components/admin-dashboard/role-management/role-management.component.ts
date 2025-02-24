import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container-fluid">
      <h2>Role Management</h2>
      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">Available Roles</h5>
            </div>
            <div class="card-body">
              <ul class="list-group">
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ROLE_ADMIN
                  <span class="badge bg-primary rounded-pill">System Role</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ROLE_CLIENT
                  <span class="badge bg-primary rounded-pill">Base Role</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ROLE_INDIVIDUAL
                  <span class="badge bg-secondary rounded-pill">Client Type</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ROLE_ENTERPRISE
                  <span class="badge bg-secondary rounded-pill">Client Type</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ROLE_DELIVERY_PERSON
                  <span class="badge bg-info rounded-pill">Base Role</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ROLE_PROFESSIONAL
                  <span class="badge bg-info rounded-pill">Delivery Type</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ROLE_TEMPORARY
                  <span class="badge bg-info rounded-pill">Delivery Type</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RoleManagementComponent {}