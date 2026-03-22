import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class SolanaResourceRoute extends Route {
  @service('moono-state') moonoState;

  async model(params) {
    await this.moonoState.refreshAll();

    if (['pump.fun', 'pump.swap', 'meteora'].includes(params.resource_id)) {
      return {
        type: 'strategy',
        slug: params.resource_id,
      };
    }

    return {
      type: 'pool',
      address: params.resource_id,
    };
  }
}
