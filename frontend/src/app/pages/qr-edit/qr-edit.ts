import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QrCode, QrService } from '../../services/qr.service';
import { DomainService } from '../../services/domain.service';
import { QrImageComponent } from '../../components/qr-image/qr-image';

@Component({
  selector: 'app-qr-edit',
  imports: [ReactiveFormsModule, RouterLink, QrImageComponent],
  templateUrl: './qr-edit.html',
  styleUrl: './qr-edit.css',
})
export class QrEdit implements OnInit {
  private fb = inject(FormBuilder);
  private qrService = inject(QrService);
  private domainService = inject(DomainService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly domains = signal<{ id: string; domain: string }[]>([]);
  original: QrCode | null = null;

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    destinationUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    isActive: [true],
    domainId: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.domainService.list().subscribe({
      next: (domains) => this.domains.set(domains),
      error: () => this.domains.set([]),
    });
    this.qrService.get(id).subscribe({
      next: (qr) => {
        this.original = qr;
        this.form.patchValue({
          title: qr.title,
          destinationUrl: qr.destinationUrl,
          isActive: qr.isActive,
          domainId: qr.domainId ?? '',
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load QR code');
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || !this.original) return;
    this.error.set('');

    const { title, destinationUrl, isActive, domainId } = this.form.getRawValue();
    this.qrService.update(this.original.id, { title, destinationUrl, isActive, domainId: domainId || null }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => this.error.set(err?.error?.message ?? 'Update failed'),
    });
  }
}
