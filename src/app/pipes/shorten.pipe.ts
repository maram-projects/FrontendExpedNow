import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shorten',
  standalone: true
})
export class ShortenPipe implements PipeTransform {
  transform(value: string, length: number = 10): string {
    if (!value) return '';
    
    if (value.length <= length) {
      return value;
    }
    
    return value.substring(0, length) + '...';
  }
}