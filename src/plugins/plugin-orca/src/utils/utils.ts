import {
    type IAgentRuntime,
    ModelType,
    logger,
    parseJSONObjectFromText,
    createUniqueUuid,
} from '@elizaos/core';

export async function acquireService(
    runtime: IAgentRuntime,
    serviceType,
    asking = '',
    retries = 10
) {
    let service = runtime.getService(serviceType) as any;
    while (!service) {
        console.log(asking, 'waiting for', serviceType, 'service...');
        service = runtime.getService(serviceType) as any;
        if (!service) {
            await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
            console.log(asking, 'Acquired', serviceType, 'service...');
        }
    }
    return service;
}