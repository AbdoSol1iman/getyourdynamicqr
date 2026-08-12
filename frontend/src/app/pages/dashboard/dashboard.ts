import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { QrCode, QrService } from '../../services/qr.service';
import { AuthService } from '../../services/auth.service';
import { BillingService } from '../../services/billing.service';
import { QrImageComponent } from '../../components/qr-image/qr-image';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, QrImageComponent, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private qrService = inject(QrService);
  private auth = inject(AuthService);
  private billing = inject(BillingService);
  private router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly qrs = signal<QrCode[]>([]);
  readonly planLabel = signal('');
  readonly email = this.auth.currentUser()?.email ?? '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.billing.state().subscribe({
      next: (state) => this.planLabel.set(state.current.label),
      error: () => this.planLabel.set(''),
    });
    this.qrService.list().subscribe({
      next: (list) => {
        this.qrs.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load QR codes');
        this.loading.set(false);
      },
    });
  }

  toggle(qr: QrCode): void {
    this.qrService.update(qr.id, { isActive: !qr.isActive }).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.message ?? 'Update failed'),
    });
  }

  remove(qr: QrCode): void {
    if (!confirm(`Delete "${qr.title}"? This is a soft delete and can be reversed by an admin.`)) return;
    this.qrService.remove(qr.id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.message ?? 'Delete failed'),
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
