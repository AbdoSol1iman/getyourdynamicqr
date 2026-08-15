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
  payError = '';
  paidMessage = '';
  paying = false;

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
    this.payError = '';
    this.paidMessage = '';
    this.billing.createPayment(planType, method).subscribe({
      next: (payment) => {
        this.payment.set(payment);
        this.externalRef = '';
      },
      error: (err) => (this.payError = err?.error?.message ?? 'Could not start payment'),
    });
  }

  cancelPayment(): void {
    this.payment.set(null);
    this.payError = '';
  }

  confirmPayment(): void {
    const p = this.payment();
    if (!p || !this.externalRef.trim()) return;
    this.paying = true;
    this.payError = '';

    this.billing.confirm(p.paymentId, this.externalRef.trim()).subscribe({
      next: (result) => {
        this.paying = false;
        this.paidMessage = `Done! You're now on the ${result.plan.label} plan.`;
        this.payment.set(null);
        this.loadState();
      },
      error: (err) => {
        this.paying = false;
        this.payError = err?.error?.message ?? 'Confirmation failed';
      },
    });
  }
}