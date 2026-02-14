import { Test, TestingModule } from '@nestjs/testing';
import { TestMailService } from './testmail.service';
import { ConfigService } from '@nestjs/config';

describe('TestMailService', () => {
  let service: TestMailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestMailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                TESTMAIL_ENABLED: true,
                TESTMAIL_API_KEY: 'test-api-key',
                TESTMAIL_NAMESPACE: 'presentation-designer',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TestMailService>(TestMailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInboxAddress', () => {
    it('should return correct inbox address', () => {
      const address = service.getInboxAddress('test');
      expect(address).toBe('presentation-designer.test@inbox.testmail.app');
    });

    it('should use default tag', () => {
      const address = service.getInboxAddress();
      expect(address).toBe('presentation-designer.default@inbox.testmail.app');
    });
  });

  describe('healthCheck', () => {
    it('should return false when TestMail is disabled', async () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce(false);
      const result = await service.healthCheck();
      expect(result).toBe(false);
    });
  });
});
