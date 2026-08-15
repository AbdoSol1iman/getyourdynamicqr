import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService, BillingState, Payment } from '../../services/billing.service';
import { QrImageComponent } from '../../components/qr-image/qr-image';

@Component({
  selector: 'app-plans',
  imports: [RouterLink, FormsModule, QrImageComponent],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
})
export class PlansPage implements OnInit {
  private billing = inject(BillingService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly state = signal<BillingState | null>(null);

  // Active payment being paid (shown as a panel).
  readonly payment = signal<Payment | null>(null);
  externalRef = '';
  readonly payError = signal('');
  readonly paidMessage = signal('');
  readonly submitMessage = signal('');
  readonly paying = signal(false);

  ngOnInit(): void {
    this.loadState();
  }

  private loadState(): void {
    this.loading.set(true);
    this.billing.state().subscribe({
      next: (state) => {
        this.state.set(state);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load plans');
        this.loading.set(false);
      },
    });
  }

  currentMethod(): string {
    return this.payment()?.method ?? '';
  }

  methodInfo(): { id: string; label: string; account: string } | null {
    const p = this.payment();
    const s = this.state();
    if (!p || !s) return null;
    const m = s.methods.find((m) => m.id === p.method);
    return m ?? { id: p.method, label: p.method, account: p.account };
  }

  startPayment(planType: string, method: string): void {
    this.payError.set('');
    this.paidMessage.set('');
    this.billing.createPayment(planType, method).subscribe({
      next: (payment) => {
        this.payment.set(payment);
        this.externalRef = '';
      },
      error: (err) => this.payError.set(err?.error?.message ?? 'Could not start payment'),
    });
  }

  cancelPayment(): void {
    this.payment.set(null);
    this.payError.set('');
  }

  submitPayment(): void {
    const p = this.payment();
    if (!p || !this.externalRef.trim()) return;
    this.paying.set(true);
    this.payError.set('');
    this.submitMessage.set('');

    this.billing.submit(p.paymentId, this.externalRef.trim()).subscribe({
      next: (result) => {
        this.paying.set(false);
        this.submitMessage.set(result.message);
        this.payment.set(null);
      },
      error: (err) => {
        this.paying.set(false);
        this.payError.set(err?.error?.message ?? 'Submission failed');
      },
    });
  }
}
