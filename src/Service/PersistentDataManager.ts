import { HTTPApi } from 'eufy-security-client';
import * as fs from 'fs';
import * as path from 'path';
import { PersistentData } from '../lib/eufy-security/interfaces';
import { generateSerialnumber, generateUDID, md5 } from '../lib/eufy-security/utils';
import { EufyGlueConfig } from './EufyGlue';
import { LoggerInterface } from './Logger';

export class PersistentDataManager {
    private config: EufyGlueConfig;
    private logger: LoggerInterface;
    private persistentFile: string;

    constructor(config: EufyGlueConfig, logger: LoggerInterface) {
        this.config = config;
        this.logger = logger;
        this.persistentFile = path.resolve(__dirname, '../../data/persistent.json');
    }

    private loadPersistentData(): PersistentData | undefined {
        try {
            if (fs.statSync(this.persistentFile).isFile()) {
                const fileContent = fs.readFileSync(this.persistentFile, 'utf8');
                return JSON.parse(fileContent);
            } else {
                this.logger.debug('No stored data from last exit found.');
            }
        } catch (err) {
            this.logger.debug('Error loading the stored data.', err);
        }

        return undefined;
    }

    private writePersistentData(persistentData: PersistentData): void {
        fs.writeFileSync(this.persistentFile, JSON.stringify(persistentData));
    }

    private generateLoginHash(): string {
        return md5(`${this.config.username}:${this.config.password}`);
    }

    public getData(): PersistentData {
        const persistentData = this.loadPersistentData() || ({} as PersistentData);

        if ((persistentData.login_hash || persistentData.cloud_token || persistentData.cloud_token_expiration) && this.generateLoginHash() !== persistentData.login_hash) {
            this.logger.info(`Authentication properties changed, invalidate saved cloud token.`);
            persistentData.login_hash = undefined;
            persistentData.cloud_token = undefined;
            persistentData.cloud_token_expiration = undefined;
        }

        if (!persistentData.openudid) {
            persistentData.openudid = generateUDID();
            this.logger.debug(`Generated new openudid: ${persistentData.openudid}`);
        }

        if (!persistentData.serial_number) {
            persistentData.serial_number = generateSerialnumber(12);
            this.logger.debug(`Generated new serial_number: ${persistentData.serial_number}`);
        }

        return persistentData;
    }

    private setData(data: Partial<PersistentData>) {
        let persistentData = this.getData();
        persistentData = { ...persistentData, ...data };

        this.writePersistentData(persistentData);
    }

    public setDataFromApi(api: HTTPApi) {
        const api_base = api.getAPIBase();
        const token = api.getToken();
        let token_expiration = api.getTokenExpiration();

        if (api_base) {
            this.logger.debug(`onConnect(): save api_base - api_base: ${api_base}`);
            this.setData({ api_base: api_base });
        }

        if (token && token_expiration) {
            this.logger.debug(`onConnect(): save token and expiration - token: ${token} token_expiration: ${token_expiration}`);
            this.setData({
                login_hash: this.generateLoginHash(),
                cloud_token: token,
                cloud_token_expiration: token_expiration.getTime(),
            });
        }
    }
}
