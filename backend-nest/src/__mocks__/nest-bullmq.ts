import { Inject } from '@nestjs/common';

export const getQueueToken = (name?: string) => `BullQueue_${name || 'default'}`;
export const InjectQueue = (queueName?: string) => Inject(getQueueToken(queueName));
export const Processor = (queueName?: string): ClassDecorator => () => {};
export const Process = (jobName?: string): MethodDecorator => () => {};
export const OnWorkerEvent = (eventName?: string): MethodDecorator => () => {};

export class WorkerHost {
  async process(...args: any[]): Promise<any> {
    return {};
  }
}

export class BullModule {
  static registerQueue(...args: any[]) {
    return {
      module: BullModule,
      providers: [],
      exports: [],
    };
  }

  static forRoot(...args: any[]) {
    return {
      module: BullModule,
      providers: [],
      exports: [],
    };
  }
}
