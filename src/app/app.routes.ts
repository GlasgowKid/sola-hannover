import { Routes } from '@angular/router';
import { AnmeldungenComponent } from './components/anmeldungen/anmeldungen.component';
import { StammesManagementComponent } from './components/stammes-management/stammes-management.component';

export const routes: Routes = [
    { path: 'anmeldungen', component: AnmeldungenComponent },
    { path: 'management', component: StammesManagementComponent },
    { path: '', redirectTo: 'anmeldungen', pathMatch: 'full' },
    { path: '**', redirectTo: 'anmeldungen' }
];
