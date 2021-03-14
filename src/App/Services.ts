import { CameraManager } from '../Service/Camera/CameraManager';
import { CameraStreamHelper } from '../Service/Camera/CameraStreamHelper';
import { EufyGlue } from '../Service/EufyGlue';
import { LoggerHttpApi, LoggerMain } from '../Service/Logger';
import { PersistentDataManager } from '../Service/PersistentDataManager';
import { StationEventEmitter } from '../Service/Station/StationEventEmitter';
import { ParametersInterface } from './Parameters';

export const Services = (parameters: ParametersInterface) => {
    const eufyConfig = {
        ...{ maxLivestreamDuration: 30 },
        ...parameters.eufyConfig,
    };

    const loggerMain = LoggerMain;
    const loggerHttpApi = LoggerHttpApi;
    const persistentDataManager = new PersistentDataManager(eufyConfig, loggerMain);
    const stationEventEmitter = new StationEventEmitter(loggerMain);

    const eufyGlue = new EufyGlue(eufyConfig, loggerMain, loggerHttpApi, persistentDataManager, stationEventEmitter);
    eufyGlue.logon();

    const cameraManager = new CameraManager(eufyGlue);
    const cameraStreamHelper = new CameraStreamHelper(eufyConfig, loggerMain, eufyGlue);

    return {
        loggerMain,
        stationEventEmitter,
        cameraManager,
        cameraStreamHelper,
    };
};
