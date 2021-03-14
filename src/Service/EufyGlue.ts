import { HTTPApi, Device, Camera, Lock, MotionSensor, EntrySensor, Keypad, UnknownDevice, Devices, FullDevices, Hubs, Station, Stations, AuthResult } from 'eufy-security-client';
import { LoggerInterface } from './Logger';
import { PersistentDataManager } from './PersistentDataManager';
import { StationEventEmitter } from './Station/StationEventEmitter';

export interface EufyGlueConfig {
    username: string;
    password: string;
    maxLivestreamDuration: number;
}

export class EufyGlue {
    private config: EufyGlueConfig;

    private logger: LoggerInterface;
    private loggerHttpApi: LoggerInterface;

    private api: HTTPApi;
    private persistentDataManager: PersistentDataManager;

    private stations: Stations = {};
    private stationEventEmitter: StationEventEmitter;
    private devices: Devices = {};

    constructor(config: EufyGlueConfig, logger: LoggerInterface, loggerHttpApi: LoggerInterface, persistentDataManager: PersistentDataManager, stationEventEmitter: StationEventEmitter) {
        this.config = config;
        this.logger = logger;
        this.loggerHttpApi = loggerHttpApi;
        this.persistentDataManager = persistentDataManager;
        this.stationEventEmitter = stationEventEmitter;

        this.api = this.getApi();
    }

    public getStations(): Stations {
        return this.stations;
    }

    public getStation(stationSerial: string): Station {
        const station = this.stations[stationSerial];

        if (!station) {
            throw new Error('Invalid stationSerial');
        }

        return station;
    }

    public getStationDevice(station_sn: string, channel: number): Device {
        for (const device of Object.values(this.devices)) {
            if ((device.getStationSerial() === station_sn && device.getChannel() === channel) || (device.getStationSerial() === station_sn && device.getSerial() === station_sn)) {
                return device;
            }
        }
        throw new Error(`No device with channel ${channel} found on station with serial number: ${station_sn}!`);
    }

    public getDevices(): Devices {
        return this.devices;
    }

    public getDevice(deviceSerial: string): Device {
        const device = this.devices[deviceSerial];

        if (!device) {
            throw new Error('Invalid deviceSerial');
        }

        return device;
    }

    private getApi(): HTTPApi {
        const persistentData = this.persistentDataManager.getData();
        const api = new HTTPApi(this.config.username, this.config.password, this.loggerHttpApi);
        api.on('hubs', (hubs) => this.handleHubs(hubs));
        api.on('devices', (devices) => this.handleDevices(devices));
        api.on('close', () => this.onAPIClose());
        api.on('connect', () => this.onAPIConnect());

        if (persistentData.api_base) {
            api.setAPIBase(persistentData.api_base);
        }

        if (persistentData.cloud_token && persistentData.cloud_token_expiration) {
            api.setToken(persistentData.cloud_token);
            api.setTokenExpiration(new Date(persistentData.cloud_token_expiration));
        }

        api.setOpenUDID(persistentData.openudid);
        api.setSerialNumber(persistentData.serial_number);

        return api;
    }

    private handleHubs(hubs: Hubs): void {
        this.logger.debug(`EufySecurity.handleHubs(): hubs: ${Object.keys(hubs).length} - %j`, { hubs: hubs });

        const stations_sns: string[] = Object.keys(this.stations);
        for (const hubResponse of Object.values(hubs)) {
            if (stations_sns.includes(hubResponse.station_sn)) {
                const station = this.stations[hubResponse.station_sn];
                station.update(hubResponse);
            } else {
                const station = new Station(this.api, hubResponse);
                station.on('connect', (...args) => this.stationEventEmitter.emit('connect', ...args));
                station.on('close', (...args) => this.stationEventEmitter.emit('close', ...args));
                station.on('start_livestream', (station, channel, metadata, videoStream, audioStream) => {
                    const device = this.getStationDevice(station.getSerial(), channel);

                    this.stationEventEmitter.emit('start_livestream', station, device, metadata, videoStream, audioStream);
                });
                station.on('stop_livestream', (station, channel) => {
                    const device = this.getStationDevice(station.getSerial(), channel);

                    this.stationEventEmitter.emit('stop_livestream', station, device);
                });
                station.update(hubResponse, true);

                this.stations[hubResponse.station_sn] = station;
            }
        }

        this.logger.debug(`EufySecurity.handleHubs(): stations - %j`, this.stations);
    }

    private handleDevices(devices: FullDevices): void {
        this.logger.debug(`EufySecurity.handleDevices(): devices: ${Object.keys(devices).length} - %j`, { devices: devices });
        const device_sns: string[] = Object.keys(this.devices);
        for (const fullDeviceResponse of Object.values(devices)) {
            if (device_sns.includes(fullDeviceResponse.device_sn)) {
                const device = this.devices[fullDeviceResponse.device_sn];
                device.update(fullDeviceResponse);
            } else {
                let device: Device;

                if (Device.isCamera(fullDeviceResponse.device_type)) {
                    device = new Camera(this.api, fullDeviceResponse);
                } else if (Device.isLock(fullDeviceResponse.device_type)) {
                    device = new Lock(this.api, fullDeviceResponse);
                } else if (Device.isMotionSensor(fullDeviceResponse.device_type)) {
                    device = new MotionSensor(this.api, fullDeviceResponse);
                } else if (Device.isEntrySensor(fullDeviceResponse.device_type)) {
                    device = new EntrySensor(this.api, fullDeviceResponse);
                } else if (Device.isKeyPad(fullDeviceResponse.device_type)) {
                    device = new Keypad(this.api, fullDeviceResponse);
                } else {
                    device = new UnknownDevice(this.api, fullDeviceResponse);
                }

                device.update(fullDeviceResponse, true);

                this.devices[fullDeviceResponse.device_sn] = device;
            }
        }

        this.logger.debug(`EufySecurity.handleDevices(): devices - %j`, this.devices);
    }

    public async logon(verify_code?: number): Promise<void> {
        if (verify_code) {
            await this.api.addTrustDevice(verify_code).then((result) => {
                if (!result) {
                    this.logger.debug('EufySecurity.logon(): verify_code invalid');
                    return;
                }

                this.logger.debug('EufySecurity.logon(): verify_code ok');
                this.onConnect();
            });
        } else {
            switch (await this.api.authenticate()) {
                case AuthResult.SEND_VERIFY_CODE:
                    this.logger.debug('EufySecurity.logon(): send_verify_code');
                    break;
                case AuthResult.RENEW:
                    this.logger.debug('EufySecurity.logon(): renew');
                    const result = await this.api.authenticate();
                    if (result == AuthResult.OK) {
                        this.onConnect();
                    }
                    break;
                case AuthResult.ERROR:
                    this.logger.error('EufySecurity.logon(): error');
                    break;
                case AuthResult.OK:
                    this.logger.debug('EufySecurity.logon(): ok');
                    this.onConnect();
                    break;
            }
        }
    }

    public async refreshData(): Promise<void> {
        await this.api.updateDeviceInfo();
        Object.values(this.stations).forEach(async (station: Station) => {
            if (station.isConnected()) await station.getCameraInfo();
        });
    }

    private async onConnect(): Promise<void> {
        this.logger.debug(`onConnect(): `);
        await this.refreshData();

        let token_expiration = this.api.getTokenExpiration();
        const trusted_token_expiration = this.api.getTrustedTokenExpiration();

        if (token_expiration?.getTime() !== trusted_token_expiration.getTime()) {
            try {
                const trusted_devices = await this.api.listTrustDevice();
                trusted_devices.forEach((trusted_device) => {
                    if (trusted_device.is_current_device === 1) {
                        token_expiration = trusted_token_expiration;
                        this.api.setTokenExpiration(token_expiration);
                        this.logger.debug(`onConnect(): This device is trusted. Token expiration extended to: ${token_expiration})`);
                    }
                });
            } catch (error) {
                this.logger.error(`onConnect(): trusted_devices - Error: ${error}`);
            }
        }

        this.persistentDataManager.setDataFromApi(this.api);

        Object.values(this.stations).forEach((station: Station) => {
            station.connect(); // pass true???
        });
    }

    private onAPIClose(): void {
        this.logger.debug('onAPIClose');
    }

    private onAPIConnect(): void {
        this.logger.debug('onAPIConnect');
    }
}
