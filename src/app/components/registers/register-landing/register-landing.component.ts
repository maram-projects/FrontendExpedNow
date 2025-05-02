import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-register-landing',
  templateUrl: './register-landing.component.html',
  styleUrls: ['./register-landing.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class RegisterLandingComponent {
  constructor(private router: Router, private route: ActivatedRoute) {}

  isNestedRoute(): boolean {
    return this.router.url !== '/register';
  }
}