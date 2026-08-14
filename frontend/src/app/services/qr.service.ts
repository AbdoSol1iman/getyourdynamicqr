import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from './api-url';

export interface QrHealthChecks {
  noLocalhost: boolean;
  qrImage: boolean;
  reachable: boolean;
  targetMatch: boolean;
}

export interface QrHealth {
  ok: boolean;
  redirectUrl: string;
  checks: QrHealthChecks;
}

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
  health?: QrHealth;
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

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class QrService {
  private http = inject(HttpClient);

  create(title: string, destinationUrl: string, domainId: string | null = null): Observable<QrCode> {
    return this.http
      .post<ApiResponse<QrCode>>(`${API_URL}/api/qr`, { title, destinationUrl, domainId })
      .pipe(map((res) => res.data));
  }

  list(): Observable<QrCode[]> {
    return this.http
      .get<ApiResponse<QrCode[]>>(`${API_URL}/api/qr`)
      .pipe(map((res) => res.data));
  }

  get(id: string): Observable<QrCode> {
    return this.http
      .get<ApiResponse<QrCode>>(`${API_URL}/api/qr/${id}`)
      .pipe(map((res) => res.data));
  }

  update(
    id: string,
    data: Partial<Pick<QrCode, 'title' | 'destinationUrl' | 'isActive'> & { domainId: string | null }>
  ): Observable<QrCode> {
    return this.http
      .patch<ApiResponse<QrCode>>(`${API_URL}/api/qr/${id}`, data)
      .pipe(map((res) => res.data));
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/api/qr/${id}`);
  }

  analytics(id: string): Observable<QrAnalytics> {
    return this.http
      .get<ApiResponse<QrAnalytics>>(`${API_URL}/api/qr/${id}/analytics`)
      .pipe(map((res) => res.data));
  }

  health(id: string): Observable<{ redirectUrl: string; qrImage: string | null; health: QrHealth }> {
    return this.http
      .get<ApiResponse<{ redirectUrl: string; qrImage: string | null; health: QrHealth }>>(
        `${API_URL}/api/qr/${id}/health`
      )
      .pipe(map((res) => res.data));
  }
}