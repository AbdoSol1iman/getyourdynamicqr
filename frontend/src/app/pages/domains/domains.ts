import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomDomain, DomainService } from '../../services/domain.service';

@Component({
  selector: 'app-domains',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './domains.html',
  styleUrl: './domains.css',
})
export class DomainsPage implements OnInit {
  private domainService = inject(DomainService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly domains = signal<CustomDomain[]>([]);

  newDomain = '';
  readonly addError = signal('');

  ngOnInit(): void {
    this.domainService.list().subscribe({
      next: (domains) => {
        this.domains.set(domains);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load your domains');
        this.loading.set(false);
      },
    });
  }

  addDomain(): void {
    const domain = this.newDomain.trim();
    if (!domain) return;
    this.addError.set('');

    this.domainService.create(domain).subscribe({
      next: (created) => {
        this.domains.update((list) => [created, ...list]);
        this.newDomain = '';
      },
      error: (err) => this.addError.set(err?.error?.message ?? 'Failed to add domain'),
    });
  }

  remove(domain: CustomDomain): void {
    this.domainService.remove(domain.id).subscribe({
      next: () => this.domains.update((list) => list.filter((d) => d.id !== domain.id)),
      error: (err) => this.error.set(err?.error?.message ?? 'Failed to remove domain'),
    });
  }
}
