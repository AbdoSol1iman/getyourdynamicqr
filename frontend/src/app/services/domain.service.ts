import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from './api-url';

export interface CustomDomain {
  id: string;
  userId: string;
  domain: string;
  isVerified: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class DomainService {
  private http = inject(HttpClient);

  list(): Observable<CustomDomain[]> {
    return this.http.get<CustomDomain[]>(`${API_URL}/api/domains`);
  }

  create(domain: string): Observable<CustomDomain> {
    return this.http.post<CustomDomain>(`${API_URL}/api/domains`, { domain });
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/api/domains/${id}`);
  }
}