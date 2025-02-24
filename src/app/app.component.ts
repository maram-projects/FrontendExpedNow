import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavComponent } from './components/nav/nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent],
  template: `
  <app-nav></app-nav>
  <router-outlet></router-outlet>
`
  //templateUrl: './app.component.html',
  //styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'expednow';

  constructor(private router: Router) {
    console.log('Routes:', this.router.config);
  }
}