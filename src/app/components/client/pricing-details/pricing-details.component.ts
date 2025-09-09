// pricing-details.component.ts
import { Component, Input, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

interface PricingRule {
  description: string;
  amount: number;
  type?: 'fee' | 'discount' | 'surcharge';
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
  currency?: string;
  calculatedAt?: string;
}

@Component({
  selector: 'app-pricing-details',
  templateUrl: './pricing-details.component.html',
  styleUrls: ['./pricing-details.component.css'],
    encapsulation: ViewEncapsulation.None, // Add this line

  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(20px)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateY(0)'
      })),
      transition('void <=> *', animate('300ms ease-in-out'))
    ]),
    trigger('slideIn', [
      state('void', style({
        opacity: 0,
        transform: 'translateX(-30px)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateX(0)'
      })),
      transition('void => *', animate('400ms ease-out'))
    ]),
    trigger('expandCollapse', [
      state('collapsed', style({
        height: '0',
        overflow: 'hidden',
        opacity: 0,
        transform: 'translateY(-10px)'
      })),
      state('expanded', style({
        height: '*',
        opacity: 1,
        transform: 'translateY(0)'
      })),
      transition('collapsed <=> expanded', animate('300ms ease-in-out'))
    ])
  ]
})
export class PricingDetailsComponent implements OnInit, OnDestroy {
  @Input() pricing: PricingModel | null = null;
  @Input() currency: string = 'TND';
  @Input() showAnimations: boolean = true;
  
  showRules = false;
  animationState: 'collapsed' | 'expanded' = 'collapsed';
  private animationTimeout?: ReturnType<typeof setTimeout>;
  
  // Make Math available in template
  Math = Math;
  
  ngOnInit(): void {
    this.initializeAnimations();
  }
  
  ngOnDestroy(): void {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }
  
  private initializeAnimations(): void {
    if (this.showAnimations && this.pricing?.appliedRules?.length) {
      this.animationTimeout = setTimeout(() => {
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
  
  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return `0 ${this.currency}`;
    return `${this.formatNumber(amount)} ${this.currency}`;
  }
  
  formatDistance(distance: number | undefined): string {
    if (distance === undefined || distance === null) return '0 km';
    return `${this.formatNumber(distance)} km`;
  }
  
  private formatNumber(value: number): string {
    try {
      return new Intl.NumberFormat('ar-TN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
    } catch (error) {
      // Fallback if Intl is not supported or locale is not available
      return value.toFixed(2).replace(/\.?0+$/, '');
    }
  }
  
  getSubtotal(): number {
    if (!this.pricing) return 0;
    
    const baseAmount = (this.pricing.basePrice || 0) +
                      (this.pricing.distanceCost || 0) +
                      (this.pricing.weightCost || 0);
    
    const fees = (this.pricing.urgencyFee || 0) +
                (this.pricing.peakSurcharge || 0) +
                (this.pricing.holidaySurcharge || 0);
    
    return baseAmount + fees;
  }
  
  getTotalDiscount(): number {
    return this.pricing?.discountAmount || 0;
  }
  
  getRulesByType(type: 'fee' | 'discount' | 'surcharge'): PricingRule[] {
    if (!this.pricing?.appliedRules) return [];
    return this.pricing.appliedRules.filter(rule => rule.type === type);
  }
  
  isPricingValid(): boolean {
    return !!(this.pricing && 
             typeof this.pricing.totalAmount === 'number' &&
             this.pricing.totalAmount >= 0);
  }

  hasValue(value: number | undefined): boolean {
    return value !== undefined && value !== null && value > 0;
  }

  getAnimationDelay(index: number): string {
    return `${index * 100}ms`;
  }

  trackByRule(index: number, rule: PricingRule): string {
    return rule.description + rule.amount;
  }

  getAppliedRules(): PricingRule[] {
    return this.pricing?.appliedRules || [];
  }
}