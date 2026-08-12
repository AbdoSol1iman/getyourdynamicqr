import { Component, effect, input } from '@angular/core';
import QRCode from 'qrcode';

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
      this.imageUrl = await QRCode.toDataURL(value, {
        width: this.size(),
        margin: 1,
      });
    });
  }
}
