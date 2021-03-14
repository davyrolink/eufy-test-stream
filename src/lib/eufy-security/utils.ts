import * as crypto from 'crypto';
import { readBigUInt64BE } from 'read-bigint';

export const generateUDID = function (): string {
    return readBigUInt64BE(crypto.randomBytes(8)).toString(16);
};

export const generateSerialnumber = function (length: number): string {
    return crypto.randomBytes(length / 2).toString('hex');
};

export const md5 = (contents: string): string => crypto.createHash('md5').update(contents).digest('hex');
