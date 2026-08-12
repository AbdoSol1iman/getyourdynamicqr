import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from './api-url';

export interface CustomDomain {
  id: string;
  userId: string;
  domain: string;
  isVerified: boolean;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DomainService {
  private http = inject(HttpClient);

  list(): Observable<CustomDomain[]> {
    return this.http
      .get<ApiResponse<CustomDomain[]>>(`${API_URL}/api/domains`)
      .pipe(map((res) => res.data));
  }

  create(domain: string): Observable<CustomDomain> {
    return this.http
      .post<ApiResponse<CustomDomain>>(`${API_URL}/api/domains`, { domain })
      .pipe(map((res) => res.data));
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/api/domains/${id}`);
  }
}