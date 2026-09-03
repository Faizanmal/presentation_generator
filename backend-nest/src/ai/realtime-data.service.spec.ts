import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RealTimeDataService } from './realtime-data.service';

describe('RealTimeDataService', () => {
  it('returns empty research instead of fake $1.2B stats when no providers are configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealTimeDataService,
        {
          provide: ConfigService,
          useValue: { get: () => '' },
        },
      ],
    }).compile();

    const service = module.get(RealTimeDataService);
    const result = await service.search(
      'artificial intelligence statistics',
      4,
    );

    expect(result.results).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/\$1\.2B/);
    expect(JSON.stringify(result)).not.toMatch(/2\.5M/);
  });
});
