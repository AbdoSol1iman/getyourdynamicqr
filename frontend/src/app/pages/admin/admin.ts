import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BillingService, ReviewPayment } from '../../services/billing.service';

@Component({
  selector: 'app-admin',
  imports: [DatePipe, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminPage implements OnInit {
  private billing = inject(BillingService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly payments = signal<ReviewPayment[]>([]);
  readonly filter = signal('SUBMITTED');
  readonly actionError = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(status = this.filter()): void {
    this.loading.set(true);
    this.error.set('');
    this.actionError.set('');
    this.billing.listPayments(status === 'ALL' ? undefined : status).subscribe({
      next: (list) => {
        this.payments.set(list);
        this.filter.set(status);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load payments');
        this.loading.set(false);
      },
    });
  }

  approve(payment: ReviewPayment): void {
    this.actionError.set('');
    this.billing.approve(payment.id).subscribe({
      next: () => {
        this.payments.update((list) =>
          list.map((p) =>
            p.id === payment.id ? { ...p, status: 'PAID', paidAt: new Date().toISOString() } : p
          )
        );
      },
      error: (err) => (this.actionError.set(err?.error?.message ?? 'Approval failed')),
    });
  }
}