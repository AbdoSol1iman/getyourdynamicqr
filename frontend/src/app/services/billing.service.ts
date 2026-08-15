import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from './api-url';

export interface PlanInfo {
  planType: string;
  label: string;
  monthlyPriceEGP: number;
  maxQrs: number | 'unlimited';
  customDomains: boolean;
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
}

export interface ConfirmResult {
  planType: string;
  plan: PlanInfo;
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

  confirm(paymentId: string, externalRef: string): Observable<ConfirmResult> {
    return this.http
      .post<ApiResponse<ConfirmResult>>(`${API_URL}/api/billing/confirm`, { paymentId, externalRef })
      .pipe(map((res) => res.data));
  }
}