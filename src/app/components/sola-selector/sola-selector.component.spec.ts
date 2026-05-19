import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SolaSelectorComponent } from './sola-selector.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('SolaSelectorComponent', () => {
  let spectator: Spectator<SolaSelectorComponent>;

  const createComponent = createComponentFactory({
    component: SolaSelectorComponent,
    imports: [ReactiveFormsModule],
    shallow: true,
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        jahre: [
          { id: 2024, name: '2024' },
          { id: 2025, name: '2025' }
        ],
        solawochen: [
          { id: 1, name: 'Woche 1' }
        ]
      }
    });
  });

  it('should create the component', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should emit yearSelected and reset selectedWeek when a year is selected', () => {
    let emittedYear: number | undefined;
    spectator.output('yearSelected').subscribe(year => emittedYear = year);

    // Zuerst eine Woche setzen, um zu prüfen, ob sie korrekt resettet wird
    spectator.component.formGroup.controls.selectedWeek.setValue(5, { emitEvent: false });
    expect(spectator.component.formGroup.controls.selectedWeek.value).toBe(5);

    // Jahr im Formular ändern (simuliert z.B. die UI-Auswahl)
    spectator.component.formGroup.controls.selectedYear.setValue(2024);

    // Output muss emittiert haben
    expect(emittedYear).toBe(2024);
    
    // Solawoche muss null sein
    expect(spectator.component.formGroup.controls.selectedWeek.value).toBeNull();
  });

  it('should emit weekSelected when a week is selected', () => {
    let emittedWeek: number | undefined;
    spectator.output('weekSelected').subscribe(week => emittedWeek = week);

    spectator.component.formGroup.controls.selectedWeek.setValue(1);

    expect(emittedWeek).toBe(1);
  });

  it('should render select options based on inputs', () => {
    const yearOptions = spectator.queryAll('select[formControlName="selectedYear"] option');
    // 1 default disabled option + 2 Jahre = 3 Optionen
    expect(yearOptions.length).toBe(3);
    expect(yearOptions[1]).toHaveText('2024');

    const weekOptions = spectator.queryAll('select[formControlName="selectedWeek"] option');
    // 1 default disabled option + 1 Solawoche = 2 Optionen
    expect(weekOptions.length).toBe(2);
    expect(weekOptions[1]).toHaveText('Woche 1');
  });
});
