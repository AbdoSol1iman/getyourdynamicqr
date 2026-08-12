import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from './api-url';

export interface QrCode {
  id: string;
  userId: string;
  title: string;
  shortCode: string;
  destinationUrl: string;
  redirectUrl: string;
  qrType: string;
  isActive: boolean;
  designConfig: unknown;
  domainId: string | null;
  domain: { id: string; domain: string; isVerified: boolean } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  scanCount?: number;
  qrImage?: string;
}

export interface ScanEvent {
  id: string;
  qrCodeId: string;
  ipAddress: string | null;
  countryCode: string | null;
  city: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  userAgent: string | null;
  scannedAt: string;
}

export interface AnalyticsBreakdownItem {
  name: string;
  count: number;
}

export interface AnalyticsDay {
  date: string;
  count: number;
}

export interface QrAnalytics {
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  scansByDate: AnalyticsDay[];
  devices: AnalyticsBreakdownItem[];
  operatingSystems: AnalyticsBreakdownItem[];
  browsers: AnalyticsBreakdownItem[];
  recentScans: ScanEvent[];
}

@Injectable({ providedIn: 'root' })
export class QrService {
  private http = inject(HttpClient);

  create(title: string, destinationUrl: string, domainId: string | null = null): Observable<QrCode> {
    return this.http.post<QrCode>(`${API_URL}/api/qr`, { title, destinationUrl, domainId });
  }

  list(): Observable<QrCode[]> {
    return this.http.get<QrCode[]>(`${API_URL}/api/qr`);
  }

  get(id: string): Observable<QrCode> {
    return this.http.get<QrCode>(`${API_URL}/api/qr/${id}`);
  }

  update(
    id: string,
    data: Partial<Pick<QrCode, 'title' | 'destinationUrl' | 'isActive'> & { domainId: string | null }>
  ): Observable<QrCode> {
    return this.http.patch<QrCode>(`${API_URL}/api/qr/${id}`, data);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/api/qr/${id}`);
  }

  analytics(id: string): Observable<QrAnalytics> {
    return this.http.get<QrAnalytics>(`${API_URL}/api/qr/${id}/analytics`);
  }
}
