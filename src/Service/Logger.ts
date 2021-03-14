import Pino from 'pino';
import { Logger as TsLogger } from 'ts-log';

export interface LoggerInterface extends TsLogger {}

export const LoggerHttpApi = Pino({
    name: 'HTTPApi',
    // level: 'debug',
});

export const LoggerMain = Pino({
    name: 'Main',
    level: 'debug',
});
