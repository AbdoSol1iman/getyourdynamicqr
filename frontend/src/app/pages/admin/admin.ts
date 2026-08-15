import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  BillingService,
  ReviewPayment,
  AdminUser,
  AdminUserPatch,
} from '../../services/billing.service';

@Component({
  selector: 'app-admin',
  imports: [DatePipe, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminPage implements OnInit {
  private billing = inject(BillingService);

  readonly tab = signal<'payments' | 'users'>('payments');

  // Payment review state.
  readonly paymentsLoading = signal(true);
  readonly paymentsError = signal('');
  readonly payments = signal<ReviewPayment[]>([]);
  readonly filter = signal('SUBMITTED');
  readonly actionError = signal('');
  readonly approveBusy = signal<string | null>(null);
  readonly savedFlash = signal('');

  // User management state.
  readonly usersLoading = signal(true);
  readonly usersError = signal('');
  readonly users = signal<AdminUser[]>([]);
  readonly plans = signal<{ planType: string; label: string }[]>([]);
  readonly updatingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPayments();
    this.loadPlans();
  }

  private loadPlans(): void {
    this.billing.state().subscribe({
      next: (state) =>
        this.plans.set(state.plans.map((p) => ({ planType: p.planType, label: p.label }))),
      error: () => this.plans.set([]),
    });
  }

  setTab(tab: 'payments' | 'users'): void {
    this.tab.set(tab);
    if (tab === 'users') this.loadUsers();
  }

  loadPayments(status = this.filter()): void {
    this.paymentsLoading.set(true);
    this.paymentsError.set('');
    this.billing.listPayments(status === 'ALL' ? undefined : status).subscribe({
      next: (list) => {
        this.payments.set(list);
        this.filter.set(status);
        this.paymentsLoading.set(false);
      },
      error: (err) => {
        this.paymentsError.set(err?.error?.message ?? 'Failed to load payments');
        this.paymentsLoading.set(false);
      },
    });
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set('');
    this.billing.listUsers().subscribe({
      next: (list) => {
        this.users.set(list);
        this.usersLoading.set(false);
      },
      error: (err) => {
        this.usersError.set(err?.error?.message ?? 'Failed to load users');
        this.usersLoading.set(false);
      },
    });
  }

approve(payment: ReviewPayment): void {
    this.actionError.set('');
    this.approveBusy.set(payment.id);
    this.billing.approve(payment.id).subscribe({
      next: () => {
        this.payments.update((list) =>
          list.map((p) =>
            p.id === payment.id
              ? { ...p, status: 'PAID', paidAt: new Date().toISOString() }
              : p
          )
        );
        this.approveBusy.set(null);
      },
      error: (err) => {
        this.actionError.set(err?.error?.message ?? 'Approval failed');
        this.approveBusy.set(null);
      },
    });
  }

  decline(payment: ReviewPayment): void {
    const reason = prompt(
      `Decline ${payment.email} (${payment.planType}, ${payment.reference})?\n\nOptional reason shown to the customer:`
    );
    if (reason === null) return;
    this.actionError.set('');
    this.approveBusy.set(payment.id);
    this.billing.decline(payment.id, reason.trim()).subscribe({
      next: () => {
        this.payments.update((list) =>
          list.map((p) =>
            p.id === payment.id
              ? { ...p, status: 'DECLINED', declineReason: reason.trim() || null }
              : p
          )
        );
        this.approveBusy.set(null);
      },
      error: (err) => {
        this.actionError.set(err?.error?.message ?? 'Decline failed');
        this.approveBusy.set(null);
      },
    });
  }

  private updateUser(id: string, patch: AdminUserPatch, flash: string): void {
    this.updatingId.set(id);
    this.usersError.set('');
    this.billing.updateUser(id, patch).subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
        );
        this.updatingId.set(null);
        this.savedFlash.set(flash);
        setTimeout(() => this.savedFlash.set(''), 2000);
      },
      error: (err) => {
        this.updatingId.set(null);
        this.usersError.set(err?.error?.message ?? 'Update failed');
      },
    });
  }

  setPlan(user: AdminUser, planType: string): void {
    this.updateUser(user.id, { planType }, `Plan set to ${planType}`);
  }

  toggleRole(user: AdminUser): void {
    const role = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    this.updateUser(user.id, { role }, `Role set to ${role}`);
  }

  toggleActive(user: AdminUser): void {
    this.updateUser(
      user.id,
      { isActive: !user.isActive },
      user.isActive ? 'Account disabled' : 'Account re-enabled',
    );
  }
}
