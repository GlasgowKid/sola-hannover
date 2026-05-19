import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { ChurchtoolsService } from './churchtools.service';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { environment } from '../../environments/environment';

jest.mock('@churchtools/churchtools-client', () => ({
  churchtoolsClient: {
    setBaseUrl: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    getAllPages: jest.fn(),
    patch: jest.fn(),
  }
}));

jest.mock('../../environments/environment', () => ({
  environment: {
    production: false,
    ctBaseUrl: 'https://test.church.tools',
    ctUsername: 'testuser',
    ctPassword: 'testpassword'
  }
}));

describe('ChurchtoolsService', () => {
  let spectator: SpectatorService<ChurchtoolsService>;
  const createService = createServiceFactory(ChurchtoolsService);

  beforeEach(() => {
    jest.clearAllMocks();
    
    (churchtoolsClient.post as jest.Mock).mockResolvedValue({});
    (churchtoolsClient.get as jest.Mock).mockResolvedValue([]);
    (churchtoolsClient.getAllPages as jest.Mock).mockResolvedValue([]);
    (churchtoolsClient.patch as jest.Mock).mockResolvedValue({});
    
    environment.production = false;
  });

  describe('Initialization', () => {
    it('should configure client and login when not in production', async () => {
      const mockGroupTypes = [{ id: 1, name: 'Jahr' }];
      (churchtoolsClient.get as jest.Mock).mockResolvedValue(mockGroupTypes);

      spectator = createService();

      expect(churchtoolsClient.setBaseUrl).toHaveBeenCalledWith('https://test.church.tools');
      expect(churchtoolsClient.post).toHaveBeenCalledWith('/login', { username: 'testuser', password: 'testpassword' });
      
      // Warten, bis das Login-Promise aufgelöst ist
      await new Promise(process.nextTick);

      expect(churchtoolsClient.get).toHaveBeenCalledWith('/group/grouptypes');
    });

    it('should skip login when in production', async () => {
      environment.production = true;
      spectator = createService();

      expect(churchtoolsClient.post).not.toHaveBeenCalled();
      
      await new Promise(process.nextTick);
      
      expect(churchtoolsClient.get).toHaveBeenCalledWith('/group/grouptypes');
    });
  });

  describe('Data Methods', () => {
    beforeEach(async () => {
      const mockGroupTypes = [{ id: 1, name: 'Jahr' }, { id: 2, name: 'Solawoche' }];
      (churchtoolsClient.get as jest.Mock).mockImplementation((url) => {
        if (url === '/group/grouptypes') return Promise.resolve(mockGroupTypes);
        return Promise.resolve([]);
      });
      spectator = createService();
      await new Promise(process.nextTick);
    });

    it('should return groupTypes', (done) => {
      spectator.service.getGroupTypes().subscribe(types => {
        expect(types).toEqual([{ id: 1, name: 'Jahr' }, { id: 2, name: 'Solawoche' }]);
        done();
      });
    });

    it('should return correct filter for groupTypeFilter', (done) => {
      spectator.service.groupTypeFilter('Jahr').subscribe(filter => {
        expect(filter).toEqual({ group_type_ids: [1] });
        done();
      });
    });

    it('should getJahre correctly', (done) => {
      const mockJahre = [{ id: 10, name: '2024' }];
      (churchtoolsClient.get as jest.Mock).mockImplementation((url, params) => {
          if (url === '/groups' && params?.group_type_ids?.includes(1)) {
              return Promise.resolve(mockJahre);
          }
          return Promise.resolve([]);
      });

      spectator.service.getJahre().subscribe(res => {
        expect(res).toEqual(mockJahre);
        expect(churchtoolsClient.get).toHaveBeenCalledWith('/groups', { group_type_ids: [1] });
        done();
      });
    });

    it('should getSolawochen with yearGroupId', (done) => {
      const mockWochen = [{ id: 30, name: 'Woche 2' }];
      (churchtoolsClient.get as jest.Mock).mockImplementation((url, params) => {
          if (url === '/groups/10/children') return Promise.resolve([{ domainIdentifier: 30 }]);
          if (url === '/groups' && params?.ids?.includes(30)) return Promise.resolve(mockWochen);
          return Promise.resolve([]);
      });

      spectator.service.getSolawochen(10).subscribe(res => {
        expect(res).toEqual(mockWochen);
        expect(churchtoolsClient.get).toHaveBeenCalledWith('/groups/10/children', { group_type_ids: [2] });
        expect(churchtoolsClient.get).toHaveBeenCalledWith('/groups', { ids: [30] });
        done();
      });
    });

    it('should getAnmeldungen and request correct personFields', (done) => {
      const mockMembers = [{ id: 100, personId: 1000 }];
      (churchtoolsClient.getAllPages as jest.Mock).mockResolvedValue(mockMembers);

      spectator.service.getAnmeldungen(30).subscribe(res => {
        expect(res).toEqual(mockMembers);
        expect(churchtoolsClient.getAllPages).toHaveBeenCalledWith('/groups/30/members', { personFields: ["birthday", "sexId", "street", "zip", "city"] });
        done();
      });
    });

    it('should fetch and filter getGroupMemberFields correctly', (done) => {
      const mockFields = [
        { type: 'person', field: { id: 1 } },
        { type: 'group', field: { id: 2, name: 'Group Field' } }
      ];
      (churchtoolsClient.get as jest.Mock).mockImplementation((url) => {
        if (url === '/groups/30/memberfields') return Promise.resolve(mockFields);
        return Promise.resolve([]);
      });

      spectator.service.getGroupMemberFields(30).subscribe(res => {
        expect(res).toEqual([{ id: 2, name: 'Group Field' }]);
        done();
      });
    });
  });

  it('should throw error if updateGroupMember is called without login', (done) => {
    // Login künstlich verzögern, um fehlenden Login-Status zu provozieren
    (churchtoolsClient.post as jest.Mock).mockReturnValue(new Promise(() => {}));
    
    spectator = createService();
    
    spectator.service.updateGroupMember(1, 2, {}).subscribe({
      error: (err) => {
        expect(err.message).toBe('Not logged in');
        done();
      }
    });
  });
});
