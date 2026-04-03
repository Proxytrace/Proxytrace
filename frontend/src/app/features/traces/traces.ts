import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-traces',
  imports: [],
  templateUrl: './traces.html',
  styles: ``,
})
export class Traces {
  readonly searchQuery = signal('');

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }
}
