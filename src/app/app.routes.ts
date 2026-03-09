import { Routes } from '@angular/router';
import { AnmeldungenComponent } from './components/anmeldungen/anmeldungen.component';

export const routes: Routes = [{
    path: "**",
    component: AnmeldungenComponent
}];
