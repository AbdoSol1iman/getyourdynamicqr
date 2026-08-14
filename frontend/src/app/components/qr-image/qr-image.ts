import { Component, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-qr-image',
  imports: [],
  templateUrl: './qr-image.html',
  styleUrl: './qr-image.css',
  host: {
    '[style.--qr-size.px]': 'size()',
  },
})
export class QrImageComponent {
  readonly text = input<string>();
  readonly src = input<string | null>(null);
  readonly size = input<number>(180);

  readonly imageUrl = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  private attempt = signal(0);

  constructor() {
    effect(async () => {
      const source = this.src();
      const value = this.text();
      void this.attempt();

      if (source) {
        this.loading.set(false);
        this.error.set('');
        this.imageUrl.set(source);
        return;
      }

      if (!value) {
        this.loading.set(false);
        this.error.set('No QR data available.');
        this.imageUrl.set(null);
        return;
      }

      this.loading.set(true);
      this.error.set('');
      try {
        // Dynamic import of the browser entry point avoids bundling the CJS
        // server build of `qrcode`, which breaks under Angular's bundling.
        const { toDataURL } = await import('qrcode/lib/browser');
        this.imageUrl.set(
          await toDataURL(value, {
            width: this.size(),
            margin: 1,
          })
        );
      } catch {
        this.imageUrl.set(null);
        this.error.set('Could not generate the QR image.');
      } finally {
        this.loading.set(false);
      }
    });
  }

  retry(): void {
    this.attempt.update((n) => n + 1);
  }
}
