import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { QrAnalytics, QrService } from '../../services/qr.service';

@Component({
  selector: 'app-qr-analytics',
  imports: [RouterLink, DatePipe],
  templateUrl: './qr-analytics.html',
  styleUrl: './qr-analytics.css',
})
export class QrAnalyticsPage implements OnInit {
  private qrService = inject(QrService);
  private route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly data = signal<QrAnalytics | null>(null);

  // Largest per-day count, used to scale the bars (avoids a 0/empty chart).
  readonly maxDayCount = computed(
    () => Math.max(1, ...(this.data()?.scansByDate.map((d) => d.count) ?? [1]))
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.qrService.analytics(id).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load analytics');
        this.loading.set(false);
      },
    });
  }
}
