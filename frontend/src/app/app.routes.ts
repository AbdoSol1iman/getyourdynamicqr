import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Dashboard } from './pages/dashboard/dashboard';
import { QrCreate } from './pages/qr-create/qr-create';
import { QrEdit } from './pages/qr-edit/qr-edit';
import { QrAnalyticsPage } from './pages/qr-analytics/qr-analytics';
import { DomainsPage } from './pages/domains/domains';
import { PlansPage } from './pages/plans/plans';
import { AdminPage } from './pages/admin/admin';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'qr/create', component: QrCreate, canActivate: [authGuard] },
  { path: 'qr/:id/edit', component: QrEdit, canActivate: [authGuard] },
  { path: 'qr/:id/analytics', component: QrAnalyticsPage, canActivate: [authGuard] },
  { path: 'domains', component: DomainsPage, canActivate: [authGuard] },
  { path: 'plans', component: PlansPage, canActivate: [authGuard] },
  { path: 'admin', component: AdminPage, canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: '/dashboard' },
];
