import { Camera } from 'eufy-security-client';
import { EufyGlue, EufyGlueConfig } from '../EufyGlue';
import { LoggerInterface } from '../Logger';

export class CameraStreamHelper {
    private config: EufyGlueConfig;
    private logger: LoggerInterface;
    private eufyGlue: EufyGlue;

    private camera_livestream_timeout: Map<string, NodeJS.Timeout> = new Map<string, NodeJS.Timeout>();

    constructor(config: EufyGlueConfig, logger: LoggerInterface, eufyGlue: EufyGlue) {
        this.config = config;
        this.logger = logger;
        this.eufyGlue = eufyGlue;
    }

    async startInternalLivestream(camera: Camera) {
        const station = this.eufyGlue.getStation(camera.getStationSerial());

        if (station.isConnected()) {
            if (!station.isLiveStreaming(camera)) {
                await station.startLivestream(camera);

                this.camera_livestream_timeout.set(
                    camera.getSerial(),
                    setTimeout(() => {
                        this.stopInternalLivestream(camera);
                    }, this.config.maxLivestreamDuration * 1000)
                );
            } else {
                this.logger.warn(`The stream for the device ${camera.getSerial()} cannot be started, because it is already streaming!`);
            }
        }
    }

    async stopInternalLivestream(camera: Camera) {
        const station = this.eufyGlue.getStation(camera.getStationSerial());

        if (station.isConnected() && station.isLiveStreaming(camera)) {
            await station.stopLivestream(camera);
        }
    }
}
