import { Routes } from '@angular/router';
import { AnmeldungenComponent } from './components/anmeldungen/anmeldungen.component';
import { StammesManagementComponent } from './components/stammes-management/stammes-management.component';
import { unsavedChangesGuard } from './guards/unsavedChanges.guard';

export const routes: Routes = [
    { 
        path: 'anmeldungen', 
        component: AnmeldungenComponent, 
        data: { title: 'Anmeldungen', icon: 'bi-people-fill' } 
    },
    { 
        path: 'management', 
        component: StammesManagementComponent, 
        canDeactivate: [unsavedChangesGuard], 
        data: { title: 'Management', icon: 'bi-gear-fill' } 
    },
    { path: '', redirectTo: 'anmeldungen', pathMatch: 'full' },
    { path: '**', redirectTo: 'anmeldungen' }
];
