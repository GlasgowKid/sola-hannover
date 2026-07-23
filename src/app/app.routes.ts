import { Routes } from '@angular/router';
import { AnmeldungenComponent } from './components/anmeldungen/anmeldungen.component';
import { unsavedChangesGuard } from './guards/unsavedChanges.guard';
import { AdvancedStammesEinteilungComponent } from './components/advanced-stammes-einteilung/advanced-stammes-einteilung.component';

export const routes: Routes = [
    {
        path: 'anmeldungen',
        component: AnmeldungenComponent,
        canDeactivate: [unsavedChangesGuard],
        data: { title: 'Anmeldungen' }
    },
    {
        path: 'advancedeinteilung',
        component: AdvancedStammesEinteilungComponent,
        canDeactivate: [unsavedChangesGuard],
        data: { title: 'Stammeseinteilung' }
    },
    { path: '', redirectTo: 'anmeldungen', pathMatch: 'full' },
    { path: '**', redirectTo: 'anmeldungen' }
];
