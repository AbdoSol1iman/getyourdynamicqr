import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class BillingService {
  private http = inject(HttpClient);

  state(): Observable<BillingState> {
    return this.http.get<BillingState>(`${API_URL}/api/billing/plan`);
  }

  createInstapay(planType: string): Observable<InstaPayPayment> {
    return this.http.post<InstaPayPayment>(`${API_URL}/api/billing/instapay`, { planType });
  }

  confirm(paymentId: string, instapayRef: string): Observable<ConfirmResult> {
    return this.http.post<ConfirmResult>(`${API_URL}/api/billing/confirm`, { paymentId, instapayRef });
  }
}