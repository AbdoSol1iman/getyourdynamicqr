import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QrCode, QrService } from '../../services/qr.service';
import { DomainService } from '../../services/domain.service';
import { QrImageComponent } from '../../components/qr-image/qr-image';

@Component({
  selector: 'app-qr-create',
  imports: [ReactiveFormsModule, RouterLink, QrImageComponent],
  templateUrl: './qr-create.html',
  styleUrl: './qr-create.css',
})
export class QrCreate implements OnInit {
  private fb = inject(FormBuilder);
  private qrService = inject(QrService);
  private domainService = inject(DomainService);

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    destinationUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    domainId: [''],
  });

  readonly domains = signal<{ id: string; domain: string }[]>([]);
  readonly error = signal('');
  readonly created = signal<QrCode | null>(null);
  readonly submitting = signal(false);

  ngOnInit(): void {
    this.domainService.list().subscribe({
      next: (domains) => this.domains.set(domains),
      error: () => this.domains.set([]),
    });
  }

  onSubmit(): void {
    // Guard against double-clicks / duplicate submits: one QR per click.
    if (this.form.invalid || this.submitting()) return;
    this.error.set('');
    this.submitting.set(true);

    const { title, destinationUrl, domainId } = this.form.getRawValue();
    this.qrService.create(title, destinationUrl, domainId || null).subscribe({
      next: (qr) => {
        this.submitting.set(false);
        this.created.set(qr);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Failed to create QR code');
      },
    });
  }

  createAnother(): void {
    this.created.set(null);
    this.form.reset();
  }
}
