import { EufyGlue } from '../Service/EufyGlue';

export interface ParametersInterface {
    eufyConfig: EufyGlue['config'];
    cameraDeviceId: string;
}

export const Parameters = (): ParametersInterface => {
    return {
        eufyConfig: {
            username: 'lorem@ipsum.com',
            password: '123456789',
            maxLivestreamDuration: 10,
        },
        cameraDeviceId: 'T8210P0000000000',
    };
};
