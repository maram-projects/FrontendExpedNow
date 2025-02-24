import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container-fluid">
      <h2>System Settings</h2>
      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">General Settings</h5>
            </div>
            <div class="card-body">
              <form [formGroup]="settingsForm" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label class="form-label">System Name</label>
                  <input type="text" class="form-control" formControlName="systemName">
                </div>
                <div class="mb-3">
                  <label class="form-label">Support Email</label>
                  <input type="email" class="form-control" formControlName="supportEmail">
                </div>
                <div class="mb-3">
                  <label class="form-label">Default User Role</label>
                  <select class="form-control" formControlName="defaultRole">
                    <option value="ROLE_CLIENT">Client</option>
                    <option value="ROLE_DELIVERY_PERSON">Delivery Person</option>
                  </select>
                </div>
                <button type="submit" class="btn btn-primary" [disabled]="!settingsForm.valid">
                  Save Settings
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  settingsForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.settingsForm = this.fb.group({
      systemName: ['ExpedNow', Validators.required],
      supportEmail: ['support@expednow.com', [Validators.required, Validators.email]],
      defaultRole: ['ROLE_CLIENT', Validators.required]
    });
  }

  onSubmit() {
    if (this.settingsForm.valid) {
      console.log('Settings updated:', this.settingsForm.value);
      // Implement settings update logic here
    }
  }
}