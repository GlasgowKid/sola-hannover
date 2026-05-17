// unsaved-changes.guard.ts
import { CanDeactivateFn } from '@angular/router';
import { StammesManagementComponent } from '../components/stammes-management/stammes-management.component';

export const unsavedChangesGuard: CanDeactivateFn<StammesManagementComponent> = (component) => {
  // If the component exists and is marked dirty, show a confirmation dialog
  if (component?.isDirty()) {
    return confirm('Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?');
  }
  return true;
};