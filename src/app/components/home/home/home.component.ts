  import { Component, OnInit } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { RouterModule } from '@angular/router';

  @Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: true,
    imports: [CommonModule, RouterModule]
  })
  export class HomeComponent implements OnInit {
    
    constructor() { }

    ngOnInit(): void {
      // Any initialization logic for the home page
    }
  }