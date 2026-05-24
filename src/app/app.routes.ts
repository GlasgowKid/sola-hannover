import { Routes } from '@angular/router';
import { AnmeldungenComponent } from './components/anmeldungen/anmeldungen.component';
import { StammesEinteilungComponent } from './components/stammes-einteilung/stammes-einteilung.component';
import { unsavedChangesGuard } from './guards/unsavedChanges.guard';

export const routes: Routes = [
    {
        path: 'anmeldungen',
        component: AnmeldungenComponent,
        canDeactivate: [unsavedChangesGuard],
        data: { title: 'Anmeldungen', icon: 'bi-people-fill' }
    },
    {
        path: 'einteilung',
        component: StammesEinteilungComponent,
        canDeactivate: [unsavedChangesGuard],
        data: { title: 'Stammeseinteilung', icon: 'bi-gear-fill' }
    },
    { path: '', redirectTo: 'anmeldungen', pathMatch: 'full' },
    { path: '**', redirectTo: 'anmeldungen' }
];
