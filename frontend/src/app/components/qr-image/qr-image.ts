import { Component, effect, input } from '@angular/core';

@Component({
  selector: 'app-qr-image',
  imports: [],
  templateUrl: './qr-image.html',
  styleUrl: './qr-image.css',
})
export class QrImageComponent {
  readonly text = input.required<string>();
  readonly size = input<number>(180);

  imageUrl: string | null = null;

  constructor() {
    effect(async () => {
      const value = this.text();
      if (!value) return;
      // Dynamic import of the browser entry point avoids bundling the CJS
      // server build of `qrcode`, which breaks under Angular's bundling.
      const { toDataURL } = await import('qrcode/lib/browser');
      this.imageUrl = await toDataURL(value, {
        width: this.size(),
        margin: 1,
      });
    });
  }
}