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

export interface BillingState {
  current: PlanInfo;
  plans: PlanInfo[];
  wallet: string;
}

export interface InstaPayPayment {
  paymentId: string;
  reference: string;
  amountEGP: number;
  planType: string;
  planLabel: string;
  wallet: string;
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

  createInstapay(planType: string): Observable<InstaPayPayment> {
    return this.http
      .post<ApiResponse<InstaPayPayment>>(`${API_URL}/api/billing/instapay`, { planType })
      .pipe(map((res) => res.data));
  }

  confirm(paymentId: string, instapayRef: string): Observable<ConfirmResult> {
    return this.http
      .post<ApiResponse<ConfirmResult>>(`${API_URL}/api/billing/confirm`, { paymentId, instapayRef })
      .pipe(map((res) => res.data));
  }
}