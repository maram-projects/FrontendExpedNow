import { Time } from '@angular/common';

export interface DaySchedule {
  working: boolean;
  startTime: string | null;  // Using string for time in ISO format
  endTime: string | null;    // Using string for time in ISO format
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY'
}

export interface AvailabilitySchedule {
  id?: string;
  userId: string;
  weeklySchedule: Record<DayOfWeek, DaySchedule>;
  monthlySchedule: Record<string, DaySchedule>; // Key is ISO date string
}

export interface TimeRange {
  startTime: string;
  endTime: string;
}