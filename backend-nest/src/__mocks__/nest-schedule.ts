export const Cron = (cronTime: any, options?: any): MethodDecorator => () => {};
export const Interval = (milliseconds: number): MethodDecorator => () => {};
export const Timeout = (milliseconds: number): MethodDecorator => () => {};

export enum CronExpression {
  EVERY_SECOND = '* * * * * *',
  EVERY_5_SECONDS = '*/5 * * * * *',
  EVERY_10_SECONDS = '*/10 * * * * *',
  EVERY_30_SECONDS = '*/30 * * * * *',
  EVERY_MINUTE = '*/1 * * * *',
  EVERY_5_MINUTES = '0 */5 * * * *',
  EVERY_10_MINUTES = '0 */10 * * * *',
  EVERY_30_MINUTES = '0 */30 * * * *',
  EVERY_HOUR = '0 0-23/1 * * *',
  EVERY_DAY_AT_MIDNIGHT = '0 0 * * *',
  EVERY_WEEK = '0 0 * * 0',
}

export class ScheduleModule {
  static forRoot() {
    return {
      module: ScheduleModule,
      providers: [],
      exports: [],
    };
  }
}
