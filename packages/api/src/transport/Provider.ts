import { ProviderFactory } from '.';
import { PayloadSerializers } from './Transport';

/**
 * @interface Provider
 */
export default interface Provider {
  /**
   * @method
   * Factory for creating RSocket client transport provider
   */
  providerFactory: ProviderFactory;
  /**
   * @property
   * Extra configuration to pass to the factory
   */
  factoryOptions?: any;

  /**
   * @property
   * Optional serialize functionality for the payload
   */
  serializers?: PayloadSerializers;
}