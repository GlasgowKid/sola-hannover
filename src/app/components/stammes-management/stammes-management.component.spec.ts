import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { of } from 'rxjs';
import { StammesManagementComponent } from './stammes-management.component';
import { ChurchtoolsService } from '../../services/churchtools.service';

describe('StammesManagementComponent', () => {
  let spectator: Spectator<StammesManagementComponent>;

  const mockChurchtoolsService = {
    getGroupTypes: jest.fn().mockReturnValue(of([])),
    getJahre: jest.fn().mockReturnValue(of([{ id: 2024, name: '2024' }])),
    getSolawochen: jest.fn().mockReturnValue(of([{ id: 1, name: 'Woche 1' }])),
    getAnmeldungen: jest.fn().mockReturnValue(of([{ id: 100, personId: 1000, person: { domainAttributes: { firstName: 'Test', lastName: 'User' } }, fields: [] }])),
    getGroupRoles: jest.fn().mockReturnValue(of([])),
    getGroupMemberFields: jest.fn().mockReturnValue(of([{ id: 10, name: 'Stammeszugehörigkeit' }])),
    updateGroupMemberFields: jest.fn().mockReturnValue(of({ fields: [{ id: 10, name: 'Stammeszugehörigkeit', value: 'Stamm 1' }] }))
  };

  const createComponent = createComponentFactory({
    component: StammesManagementComponent,
    shallow: true, // Kind-Komponenten wie die Datatable isolieren
    providers: [
      { provide: ChurchtoolsService, useValue: mockChurchtoolsService }
    ]
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // System-Mocks für Popups und LocalStorage
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {});
    jest.spyOn(window.localStorage.__proto__, 'getItem').mockReturnValue(null);
    jest.spyOn(window, 'alert').mockImplementation(() => {});

    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
    expect(mockChurchtoolsService.getJahre).toHaveBeenCalled();
  });

  it('should react to year selection', () => {
    spectator.component.onYearSelected(2024);
    expect(spectator.component.selectedYear()).toBe(2024);
    expect(spectator.component.selectedWeek()).toBeNull();
    expect(mockChurchtoolsService.getSolawochen).toHaveBeenCalledWith(2024);
  });

  it('should react to week selection and load participants', () => {
    spectator.component.onWeekSelected(1);
    expect(spectator.component.selectedWeek()).toBe(1);
    expect(mockChurchtoolsService.getAnmeldungen).toHaveBeenCalledWith(1);
    // Nach dem Subscriben müssen die Daten im Signal liegen
    expect(spectator.component.$anmeldungen().length).toBe(1);
  });

  describe('Drag and Drop (onDrop)', () => {
    beforeEach(() => {
      // Mock-Teilnehmer in den Haupt-Pool legen
      spectator.component.$anmeldungen.set([
        { id: 1, personId: 101, person: { domainAttributes: { firstName: 'A', lastName: 'A' } }, fields: [] } as any,
        { id: 2, personId: 102, person: { domainAttributes: { firstName: 'B', lastName: 'B' } }, fields: [] } as any
      ]);
    });

    it('should move participant from main pool to a group', () => {
      spectator.component.onDrop({ item: null, from: 'main', to: '0', oldIndex: 0, newIndex: 0 });
      
      const groups = spectator.component.groups();
      expect(groups[0].length).toBe(1);
      expect((groups[0][0] as any).id).toBe(1);
      
      const mainPool = spectator.component.$anmeldungen();
      expect(mainPool.length).toBe(1);
      expect((mainPool[0] as any).id).toBe(2);
      
      expect(spectator.component.isDirty()).toBe(true);
    });
    
    it('should move participant between groups', () => {
      spectator.component.onDrop({ item: null, from: 'main', to: '0', oldIndex: 0, newIndex: 0 }); // A in Gruppe 0
      spectator.component.isDirty.set(false);
      
      spectator.component.onDrop({ item: null, from: '0', to: '1', oldIndex: 0, newIndex: 0 }); // A von 0 nach 1
      
      const groups = spectator.component.groups();
      expect(groups[0].length).toBe(0);
      expect(groups[1].length).toBe(1);
      expect((groups[1][0] as any).id).toBe(1);
      
      expect(spectator.component.isDirty()).toBe(true);
    });
  });

  describe('Local Storage (saveGroups/loadGroups)', () => {
    it('should save current group state to local storage', () => {
      spectator.component.selectedWeek.set(1);
      spectator.component.groups.set([
        [{ id: 1, personId: 101 } as any],
        []
      ]);
      
      spectator.component.saveGroups();
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith('groups_week_1', expect.any(String));
      expect(spectator.component.isDirty()).toBe(false);
      expect(window.alert).toHaveBeenCalledWith('Gruppen lokal gespeichert!');
    });

    it('should load group state from local storage', () => {
      spectator.component.selectedWeek.set(1);
      spectator.component.$anmeldungen.set([{ id: 1, personId: 101 } as any, { id: 2, personId: 102 } as any]);
      
      // Simuliere lokal gespeicherten Zustand (Teilnehmer 1 in Gruppe 0, Teilnehmer 2 in main)
      jest.spyOn(window.localStorage.__proto__, 'getItem').mockReturnValue('[[1],[],[],[],[],[],[],[]]');
      
      spectator.component.loadGroups();
      
      const groups = spectator.component.groups();
      expect(groups[0].length).toBe(1);
      expect((groups[0][0] as any).id).toBe(1);
      
      const anmeldungen = spectator.component.$anmeldungen();
      expect(anmeldungen.length).toBe(1);
      expect((anmeldungen[0] as any).id).toBe(2);
    });
  });

  describe('Server Sync (saveGroupsServer / loadGroupsServer)', () => {
    it('should push groups to server', async () => {
      spectator.component.selectedWeek.set(1);
      
      // Set up state: Group 0 has participant 1, Main pool has participant 2
      spectator.component.groups.set([
        [{ id: 1, personId: 101, fields: [] } as any],
        []
      ]);
      spectator.component.$anmeldungen.set([
        { id: 2, personId: 102, fields: [{ id: 10, name: 'Stammeszugehörigkeit', value: 'Stamm 3' }] } as any
      ]);

      await spectator.component.saveGroupsServer();

      expect(mockChurchtoolsService.getGroupMemberFields).toHaveBeenCalledWith(1);
      // Person 1 (in Gruppe 0) muss auf "Stamm 1" gesetzt werden
      expect(mockChurchtoolsService.updateGroupMemberFields).toHaveBeenCalledWith(1, 101, { "10": "Stamm 1" });
      // Person 2 (im Hauptpool, aber war vorher in "Stamm 3") muss auf null resettet werden
      expect(mockChurchtoolsService.updateGroupMemberFields).toHaveBeenCalledWith(1, 102, { "10": null });
      
      expect(spectator.component.isDirty()).toBe(false);
    });

    it('should load groups from server', () => {
      spectator.component.$anmeldungen.set([
        { id: 1, personId: 101, fields: [{ name: 'Stammeszugehörigkeit', value: 'Stamm 1' }] } as any,
        { id: 2, personId: 102, fields: [] } as any, // Not assigned
        { id: 3, personId: 103, fields: [{ name: 'Stammeszugehörigkeit', value: 'Stamm 8' }] } as any
      ]);

      spectator.component.loadGroupsServer();

      const groups = spectator.component.groups();
      expect(groups[0].length).toBe(1);
      expect((groups[0][0] as any).id).toBe(1);
      
      expect(groups[7].length).toBe(1);
      expect((groups[7][0] as any).id).toBe(3);

      const mainPool = spectator.component.$anmeldungen();
      expect(mainPool.length).toBe(1);
      expect((mainPool[0] as any).id).toBe(2);
    });
  });
});
