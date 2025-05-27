// pricing-details.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

interface PricingRule {
  description: string;
  amount: number;
}

interface PricingModel {
  distance?: number;
  basePrice?: number;
  distanceCost?: number;
  weightCost?: number;
  urgencyFee?: number;
  peakSurcharge?: number;
  holidaySurcharge?: number;
  discountAmount?: number;
  totalAmount?: number;
  appliedRules?: PricingRule[];
}

@Component({
  selector: 'app-pricing-details',
  templateUrl: './pricing-details.component.html',
  styleUrls: ['./pricing-details.component.scss'],
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(20px)'
      })),
      transition('void <=> *', animate('300ms ease-in-out'))
    ]),
    trigger('slideIn', [
      state('void', style({
        opacity: 0,
        transform: 'translateX(-30px)'
      })),
      transition('void => *', animate('400ms 100ms ease-out'))
    ]),
    trigger('expandCollapse', [
      state('collapsed', style({
        height: '0',
        overflow: 'hidden',
        opacity: 0
      })),
      state('expanded', style({
        height: '*',
        opacity: 1
      })),
      transition('collapsed <=> expanded', animate('300ms ease-in-out'))
    ])
  ]
})
export class PricingDetailsComponent implements OnInit {
  @Input() pricing: PricingModel | null = null; // تغيير من PricingModel إلى PricingModel | null
  showRules = false;
  animationState = 'collapsed';
  
  ngOnInit(): void {
    if (this.pricing?.appliedRules && this.pricing.appliedRules.length > 0) {
      setTimeout(() => {
        this.animationState = 'expanded';
      }, 500);
    }
  }
  
  toggleRules(): void {
    this.showRules = !this.showRules;
    this.animationState = this.showRules ? 'expanded' : 'collapsed';
  }
  
  hasAdditionalFees(): boolean {
    if (!this.pricing) return false;
    return (this.pricing.urgencyFee || 0) > 0 ||
           (this.pricing.peakSurcharge || 0) > 0 ||
           (this.pricing.holidaySurcharge || 0) > 0;
  }
}