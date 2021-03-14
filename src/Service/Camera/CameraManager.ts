import { Camera } from 'eufy-security-client';
import { EufyGlue } from '../EufyGlue';

export class CameraManager {
    eufyGlue: EufyGlue;

    constructor(eufyGlue: EufyGlue) {
        this.eufyGlue = eufyGlue;
    }

    getCamera(deviceId: string): Camera {
        const camera = this.eufyGlue.getDevice(deviceId) as Camera;

        if (!camera?.isCamera()) {
            throw new Error('Invalid device');
        }

        return camera;
    }
}
