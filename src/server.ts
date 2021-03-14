import { Camera, Device, Station, StreamMetadata } from 'eufy-security-client';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import { Services } from './App/Services';
import { Parameters } from './App/Parameters';

const parameters = Parameters();
const services = Services(parameters);
const logger = services.loggerMain;

services.stationEventEmitter.on('start_livestream', (station: Station, device: Device, metadata: StreamMetadata, videoStream: Readable, audioStream: Readable) => {
    logger.debug('start_livestream - %j', { station: station.getSerial(), device: device.getSerial(), metadata, videoStream_readableLength: videoStream.readableLength, audioStream_readableLength: audioStream.readableLength });

    const outputFile = path.resolve(__dirname, '../output/test-stream.dump');

    videoStream.pipe(fs.createWriteStream(outputFile)).on('finish', () => {
        logger.debug('videoStream dump finished!');
        logger.info('Manually test the output by running# ffplay output/test-stream.dump');

        setTimeout(() => {
            process.exit();
        }, 1000);
    });
});

services.stationEventEmitter.on('connect', () => {
    const camera: Camera = services.cameraManager.getCamera(parameters.cameraDeviceId);
    services.cameraStreamHelper.startInternalLivestream(camera);
});
