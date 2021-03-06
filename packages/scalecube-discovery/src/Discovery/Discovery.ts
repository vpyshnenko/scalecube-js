import { ReplaySubject } from 'rxjs';
import { getFullAddress, validateAddress, check, saveToLogs } from '@scalecube/utils';
import { Address, DiscoveryApi, ClusterApi } from '@scalecube/api';
import {
  getAddressCollision,
  getDiscoverySuccessfullyDestroyedMessage,
  INVALID_ITEMS_TO_PUBLISH,
  NODEJS_MUST_PROVIDE_CLUSTER_IMPL,
} from '../helpers/constants';

export const createDiscovery: DiscoveryApi.CreateDiscovery = (
  options: DiscoveryApi.DiscoveryOptions
): DiscoveryApi.Discovery => {
  const { address, itemsToPublish, seedAddress, debug } = options;
  const joinCluster = options.cluster;

  const discoveredItemsSubject = new ReplaySubject<DiscoveryApi.ServiceDiscoveryEvent>();

  if (!joinCluster) {
    saveToLogs(getFullAddress(address), NODEJS_MUST_PROVIDE_CLUSTER_IMPL, {}, debug, 'warn');
    discoveredItemsSubject.complete();
    return {
      destroy: () => Promise.resolve(NODEJS_MUST_PROVIDE_CLUSTER_IMPL),
      discoveredItems$: () => discoveredItemsSubject.asObservable(),
    };
  }

  const membersState: { [member: string]: boolean } = {};

  validateAddress(address, false);

  if (seedAddress) {
    seedAddress.forEach((seed) => {
      validateAddress(seed, false);
      validateAddressCollision(address, seed);
    });
  }

  check.assertArray(itemsToPublish, INVALID_ITEMS_TO_PUBLISH);

  const cluster: ClusterApi.Cluster = joinCluster({ address, seedAddress, itemsToPublish, debug: false });

  const clusterListener = cluster.listen$();
  let subscription: any;

  return Object.freeze({
    destroy: () => {
      subscription && subscription.unsubscribe();
      discoveredItemsSubject.complete();
      return new Promise<string>((resolve, reject) => {
        cluster
          .destroy()
          .then(() => resolve(getDiscoverySuccessfullyDestroyedMessage(address)))
          .catch((error: any) => reject(error));
      });
    },
    discoveredItems$: () => {
      cluster
        .getCurrentMembersData()
        .then((currentMembersState: ClusterApi.MembersData) => {
          const members = Object.keys(currentMembersState);
          members.forEach((member: string) => {
            const memberItem = currentMembersState[member];

            if (memberItem.length === 0) {
              discoveredItemsSubject.next({
                type: 'IDLE',
                items: [],
              });
            } else {
              if (!membersState[member]) {
                membersState[member] = true;
                discoveredItemsSubject.next({
                  type: 'REGISTERED',
                  items: memberItem,
                });
              }
            }
          });
        })
        .catch((error: any) => discoveredItemsSubject.error(error));

      subscription = clusterListener.subscribe(
        (clusterEvent: ClusterApi.ClusterEvent) => {
          const { type, items, from } = clusterEvent;
          if (items.length > 0) {
            if (type === 'REMOVED' && membersState[from]) {
              membersState[from] = false;
              discoveredItemsSubject.next({
                type: 'UNREGISTERED',
                items,
              });
            }

            if (type !== 'REMOVED' && !membersState[from]) {
              membersState[from] = true;
              discoveredItemsSubject.next({
                type: 'REGISTERED',
                items,
              });
            }
          }
        },
        (error: any) => discoveredItemsSubject.error(error),
        () => discoveredItemsSubject.complete()
      );

      return discoveredItemsSubject.asObservable();
    },
  });
};

const validateAddressCollision = (address: Address, seedAddress: Address) => {
  const fullAddress = getFullAddress(address);
  const fullSeedAddress = getFullAddress(seedAddress);
  if (fullAddress === fullSeedAddress) {
    throw new Error(getAddressCollision(fullAddress, fullSeedAddress));
  }
};
