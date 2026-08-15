import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from './api-url';

export interface PlanInfo {
  planType: string;
  label: string;
  monthlyPriceEGP: number;
  monthlyPriceUSD?: number;
  maxQrs: number | 'unlimited';
  customDomains: boolean;
  popular?: boolean;
  features: string[];
}

export interface PaymentMethod {
  id: string;
  label: string;
  account: string;
  kind: string;
}

export interface BillingState {
  current: PlanInfo;
  plans: PlanInfo[];
  methods: PaymentMethod[];
}

export interface Payment {
  paymentId: string;
  reference: string;
  amountEGP: number;
  planType: string;
  planLabel: string;
  method: string;
  account: string;
  payText: string;
  qrImage: string | null;
}

export interface SubmitResult {
  status: string;
  message: string;
}

export interface ReviewPayment {
  id: string;
  email: string;
  planType: string;
  amountEGP: number;
  reference: string;
  method: string;
  externalRef: string | null;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  planType: string;
  role: string;
  isActive: boolean;
  qrCount: number;
  createdAt: string;
}

export interface AdminUserPatch {
  planType?: string;
  role?: string;
  isActive?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private http = inject(HttpClient);

  state(): Observable<BillingState> {
    return this.http
      .get<ApiResponse<BillingState>>(`${API_URL}/api/billing/plan`)
      .pipe(map((res) => res.data));
  }

  createPayment(planType: string, method: string): Observable<Payment> {
    return this.http
      .post<ApiResponse<Payment>>(`${API_URL}/api/billing/pay`, { planType, method })
      .pipe(map((res) => res.data));
  }

  submit(paymentId: string, externalRef: string): Observable<SubmitResult> {
    return this.http
      .post<ApiResponse<SubmitResult>>(`${API_URL}/api/billing/submit`, { paymentId, externalRef })
      .pipe(map((res) => res.data));
  }

  listPayments(status?: string): Observable<ReviewPayment[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.http
      .get<ApiResponse<ReviewPayment[]>>(`${API_URL}/api/billing/payments${q}`)
      .pipe(map((res) => res.data));
  }

  approve(paymentId: string): Observable<{ planType: string }> {
    return this.http
      .post<ApiResponse<{ planType: string }>>(
        `${API_URL}/api/billing/payments/${paymentId}/approve`,
        {},
      )
      .pipe(map((res) => res.data));
  }

  listUsers(): Observable<AdminUser[]> {
    return this.http
      .get<ApiResponse<AdminUser[]>>(`${API_URL}/api/admin/users`)
      .pipe(map((res) => res.data));
  }

  updateUser(id: string, patch: AdminUserPatch): Observable<AdminUser> {
    return this.http
      .patch<ApiResponse<AdminUser>>(`${API_URL}/api/admin/users/${id}`, patch)
      .pipe(map((res) => res.data));
  }
}
