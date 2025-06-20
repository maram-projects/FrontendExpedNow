import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shorten',
  standalone: true
})
export class ShortenPipe implements PipeTransform {
  transform(value: string | null | undefined, maxLength: number = 10): string {
    if (!value) return '';
    return value.length > maxLength 
      ? `${value.substring(0, maxLength)}...` 
      : value;
  }
}