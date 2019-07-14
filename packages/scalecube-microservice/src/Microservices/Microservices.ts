import { Address, TransportApi, DiscoveryApi, MicroserviceApi } from '@scalecube/api';
import { createDiscovery } from '@scalecube/scalecube-discovery';
import { TransportBrowser } from '@scalecube/transport-browser';
import { defaultRouter } from '../Routers/default';
import { getServiceCall } from '../ServiceCall/ServiceCall';
import { createRemoteRegistry } from '../Registry/RemoteRegistry';
import { createLocalRegistry } from '../Registry/LocalRegistry';
import { MicroserviceContext } from '../helpers/types';
import { validateDiscoveryInstance, validateMicroserviceOptions } from '../helpers/validation';
import { ASYNC_MODEL_TYPES, MICROSERVICE_NOT_EXISTS } from '../helpers/constants';
import { startServer } from '../TransportProviders/MicroserviceServer';
import { isServiceAvailableInRegistry } from '../helpers/serviceData';
import { createProxies, createProxy } from '../Proxy/createProxy';
import { check, getAddress } from '@scalecube/utils';

export const createMicroservice: MicroserviceApi.CreateMicroservice = (
  options: MicroserviceApi.MicroserviceOptions
) => {
  let microserviceOptions = {
    services: [],
    discovery: createDiscovery,
    transport: TransportBrowser,
    ...options,
  };

  if (check.isString(microserviceOptions.address)) {
    microserviceOptions = { ...microserviceOptions, address: getAddress(microserviceOptions.address as string) };
  }

  if (check.isString(microserviceOptions.seedAddress)) {
    microserviceOptions = {
      ...microserviceOptions,
      seedAddress: getAddress(microserviceOptions.seedAddress as string),
    };
  }

  // TODO: add address, customTransport, customDiscovery  to the validation process
  validateMicroserviceOptions(microserviceOptions);

  const { services, transport, discovery } = microserviceOptions;
  const address = microserviceOptions.address as Address;
  const seedAddress = microserviceOptions.seedAddress as Address;

  const transportClientProvider = (transport as TransportApi.Transport).clientProvider;

  // tslint:disable-next-line
  let microserviceContext: MicroserviceContext | null = createMicroserviceContext();
  const { remoteRegistry, localRegistry } = microserviceContext;

  localRegistry.add({ services, address });

  // if address is not available then microservice can't share services
  const endPointsToPublishInCluster = address
    ? remoteRegistry.createEndPoints({
        services,
        address,
      }) || []
    : [];

  const discoveryInstance: DiscoveryApi.Discovery = createDiscoveryInstance({
    address,
    itemsToPublish: endPointsToPublishInCluster,
    seedAddress,
    discovery,
  });

  // server use only localCall therefor, router is irrelevant
  const defaultLocalCall = getServiceCall({
    router: defaultRouter,
    microserviceContext,
    transportClientProvider,
  });

  // if address is not available then microservice can't start a server and get serviceCall requests
  address &&
    startServer({
      address,
      serviceCall: defaultLocalCall,
      transportServerProvider: (transport as TransportApi.Transport).serverProvider,
    });

  discoveryInstance.discoveredItems$().subscribe(remoteRegistry.update);

  const isServiceAvailable = isServiceAvailableInRegistry(
    endPointsToPublishInCluster,
    remoteRegistry,
    discoveryInstance
  );

  return Object.freeze({
    createProxies: (createProxiesOptions: MicroserviceApi.CreateProxiesOptions) =>
      createProxies({ createProxiesOptions, microserviceContext, isServiceAvailable, transportClientProvider }),
    createProxy: (proxyOptions: MicroserviceApi.ProxyOptions) =>
      createProxy({
        ...proxyOptions,
        microserviceContext,
        transportClientProvider,
      }),
    createServiceCall: ({ router }: { router: MicroserviceApi.Router }) =>
      createServiceCall({
        router,
        microserviceContext,
        transportClientProvider,
      }),
    destroy: () => destroy({ microserviceContext, discovery: discoveryInstance }),
  } as MicroserviceApi.Microservice);
};

const createServiceCall = ({
  router = defaultRouter,
  microserviceContext,
  transportClientProvider,
}: {
  router?: MicroserviceApi.Router;
  microserviceContext: MicroserviceContext | null;
  transportClientProvider: TransportApi.ClientProvider;
}) => {
  if (!microserviceContext) {
    throw new Error(MICROSERVICE_NOT_EXISTS);
  }

  const serviceCall = getServiceCall({ router, microserviceContext, transportClientProvider });
  return Object.freeze({
    requestStream: (message: MicroserviceApi.Message, messageFormat: boolean = false) =>
      serviceCall({
        message,
        asyncModel: ASYNC_MODEL_TYPES.REQUEST_STREAM,
        messageFormat,
      }),
    requestResponse: (message: MicroserviceApi.Message, messageFormat: boolean = false) =>
      serviceCall({
        message,
        asyncModel: ASYNC_MODEL_TYPES.REQUEST_RESPONSE,
        messageFormat,
      }),
  });
};

const destroy = ({
  microserviceContext,
  discovery,
}: {
  microserviceContext: MicroserviceContext | null;
  discovery: DiscoveryApi.Discovery;
}) => {
  if (!microserviceContext) {
    throw new Error(MICROSERVICE_NOT_EXISTS);
  }

  return new Promise((resolve, reject) => {
    microserviceContext = null;
    discovery &&
      discovery.destroy().then(() => {
        // Object.values(microserviceContext).forEach(
        //   (contextEntity) => typeof contextEntity.destroy === 'function' && contextEntity.destroy()
        // );

        // TODO: destroy server
        // TODO: destroy client
        // TODO: destroy registry
        resolve('');
      });
  });
};

const createMicroserviceContext = () => {
  const remoteRegistry = createRemoteRegistry();
  const localRegistry = createLocalRegistry();
  return {
    remoteRegistry,
    localRegistry,
  };
};

const createDiscoveryInstance = (opt: {
  address?: Address;
  seedAddress?: Address;
  itemsToPublish: MicroserviceApi.Endpoint[];
  discovery: DiscoveryApi.CreateDiscovery;
}): DiscoveryApi.Discovery => {
  const { seedAddress, itemsToPublish, discovery } = opt;
  const address = opt.address || getAddress(Date.now().toString());
  const discoveryInstance = discovery({
    address,
    itemsToPublish,
    seedAddress,
  });

  validateDiscoveryInstance(discoveryInstance);

  return discoveryInstance;
};
