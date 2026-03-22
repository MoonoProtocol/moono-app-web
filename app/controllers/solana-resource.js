import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class SolanaResourceController extends Controller {
  @service('moono-state') moonoState;

  get isPool() {
    return this.model?.type === 'pool';
  }

  get pool() {
    if (!this.isPool) {
      return null;
    }

    return this.moonoState.findPool(this.model?.address);
  }

  get strategy() {
    if (this.isPool) {
      return null;
    }

    return this.moonoState.findStrategy(this.model?.slug);
  }

  get strategyDescription() {
    if (this.isPool) {
      return null;
    }

    return this.moonoState.describeStrategy(this.model?.slug);
  }
}
