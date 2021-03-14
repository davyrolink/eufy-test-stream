import { Device, Station, StationEvents as BaseStationEvents, StreamMetadata } from 'eufy-security-client';
import { LoggerInterface } from '../Logger';
import { Readable } from 'stream';
import { TypedEmitter } from 'tiny-typed-emitter';

interface StationEvents extends Omit<BaseStationEvents, 'start_livestream' | 'stop_livestream'> {
    start_livestream: (station: Station, device: Device, metadata: StreamMetadata, videostream: Readable, audiostream: Readable) => void;
    stop_livestream: (station: Station, device: Device) => void;
}

export class StationEventEmitter extends TypedEmitter<StationEvents> {
    logger: LoggerInterface;

    constructor(logger: LoggerInterface) {
        super();

        this.logger = logger;
    }
}
