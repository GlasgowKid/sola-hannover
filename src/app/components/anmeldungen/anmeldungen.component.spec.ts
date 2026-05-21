import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { of } from 'rxjs';
import { startOfYear } from 'date-fns';
import { AnmeldungenComponent } from './anmeldungen.component';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { SolaTeilnehmerAnmeldungenComponent } from '../sola-teilnehmer-anmeldungen/sola-teilnehmer-anmeldungen.component';

describe('AnmeldungenComponent', () => {
  let spectator: Spectator<AnmeldungenComponent>;

  const mockChurchtoolsService = {
    getJahre: jest.fn().mockReturnValue(of([{ id: 2024, name: '2024' }])),
    getSolawochen: jest.fn().mockReturnValue(of([
      { id: 1, information: { dateOfFoundation: '2024-07-01T00:00:00Z' } },
      { id: 2, information: { dateOfFoundation: null } }
    ])),
    getAnmeldungen: jest.fn().mockReturnValue(of([{ id: 100, personId: 1000, fields: [] }])),
    getGroupMemberFields: jest.fn().mockReturnValue(of([{ id: 10, name: 'Wunsch 1', sortKey: 1 }])),
    updateGroupMember: jest.fn().mockReturnValue(of({ fields: [{ id: 10, name: 'Wunsch 1', value: 'Test', sortKey: 1 }] }))
  };

  const createComponent = createComponentFactory({
    component: AnmeldungenComponent,
    shallow: true, // Verhindert das Rendern von Kind-Komponenten, testet isoliert die Logik!
    providers: [
      { provide: ChurchtoolsService, useValue: mockChurchtoolsService }
    ]
  });

  beforeEach(() => {
    jest.clearAllMocks();
    spectator = createComponent();
  });

  it('should create and load jahre on init', () => {
    expect(spectator.component).toBeTruthy();
    expect(mockChurchtoolsService.getJahre).toHaveBeenCalled();
    expect(spectator.component.$jahre()).toEqual([{ id: 2024, name: '2024' }]);
  });

  it('should load solawochen and reset anmeldungen when a year is selected', () => {
    spectator.component.onYearSelected(2024);
    
    expect(mockChurchtoolsService.getSolawochen).toHaveBeenCalledWith(2024);
    expect(spectator.component.$solawochen()?.length).toBe(2);
    expect(spectator.component.$anmeldungen()).toEqual([]);
  });

  it('should load anmeldungen and update selectedWeek when a week is selected', () => {
    spectator.component.onWeekSelected(1);
    
    expect(spectator.component.$selectedWeek()).toBe(1);
    expect(mockChurchtoolsService.getAnmeldungen).toHaveBeenCalledWith(1);
    expect(spectator.component.$anmeldungen()?.length).toBe(1);
  });

  it('should compute $priceRefDate correctly based on the selected week', () => {
    spectator.component.onYearSelected(2024);
    
    // Woche mit Datum
    spectator.component.onWeekSelected(1);
    expect(spectator.component.$priceRefDate().toISOString()).toBe('2024-07-01T00:00:00.000Z');

    // Woche ohne Datum -> Fallback auf Jahresanfang
    spectator.component.onWeekSelected(2);
    const expectedFallback = startOfYear(new Date()).toISOString();
    expect(spectator.component.$priceRefDate().toISOString()).toBe(expectedFallback);
  });

  it('should update $displayData when sofa data is processed', () => {
    const mockData: any[] = [{ id: 1, name: 'Test' }];
    spectator.component.onSofaDataProcessed(mockData as any);
    
    expect(spectator.component.$displayData()).toEqual(mockData);
  });

  it('should pass the detailTemplate to SolaTeilnehmerAnmeldungenComponent', () => {
    const solaTeilnehmer = spectator.query(SolaTeilnehmerAnmeldungenComponent);
    expect(solaTeilnehmer).toBeTruthy();
    expect(solaTeilnehmer?.detailTemplate).toBeDefined();
  });

  describe('performCentralUpdate', () => {
    it('should abort early if no group is selected or progress is running', async () => {
      await spectator.component.performCentralUpdate([{ member: {} as any, updates: [] }]);
      expect(mockChurchtoolsService.getGroupMemberFields).not.toHaveBeenCalled();

      spectator.component.onWeekSelected(1);
      spectator.component.$updateProgress.set(0.5); // Fortschritt läuft bereits
      await spectator.component.performCentralUpdate([{ member: {} as any, updates: [] }]);
      expect(mockChurchtoolsService.getGroupMemberFields).not.toHaveBeenCalled();
    });

    it('should process payloads, update members, handle rate limit and reset progress', async () => {
      spectator.component.onWeekSelected(1);
      
      const payload = [{
        member: { id: 100, personId: 1000, fields: [], groupMemberStatus: 'active' } as any,
        updates: [{ fieldName: 'Wunsch 1', value: 'Neuer Wunsch' }]
      }];

      // Update triggern und warten, bis die Methode durchgelaufen ist (inkl. API-Aufrufe und 100ms Rate Limit)
      const updatePromise = spectator.component.performCentralUpdate(payload);
      await updatePromise;

      expect(mockChurchtoolsService.getGroupMemberFields).toHaveBeenCalledWith(1);
      expect(mockChurchtoolsService.updateGroupMember).toHaveBeenCalledWith(1, 1000, expect.objectContaining({
        groupMemberStatus: 'active',
        fields: [{ id: 10, name: 'Wunsch 1', value: 'Neuer Wunsch', sortKey: 1 }]
      }));

      expect(spectator.component.$updateProgress()).toBe(1); // 1 / 1

      // Kurz warten, bis das asynchrone setTimeout(..., 500) aus dem finally-Block den Balken resettet
      await new Promise(resolve => setTimeout(resolve, 550));

      expect(spectator.component.$updateProgress()).toBe(0); // Progress wieder genullt
    });
  });
});
