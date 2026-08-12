import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService, BillingState, InstaPayPayment } from '../../services/billing.service';
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

  // Active InstaPay payment being paid (shown as a panel).
  readonly payment = signal<InstaPayPayment | null>(null);
  instapayRef = '';
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

  selectPlan(planType: string): void {
    this.payError = '';
    this.paidMessage = '';
    this.billing.createInstapay(planType).subscribe({
      next: (payment) => {
        this.payment.set(payment);
        this.instapayRef = '';
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
    if (!p || !this.instapayRef.trim()) return;
    this.paying = true;
    this.payError = '';

    this.billing.confirm(p.paymentId, this.instapayRef.trim()).subscribe({
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