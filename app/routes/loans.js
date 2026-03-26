import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class LoansRoute extends Route {
  @service('moono-state') moonoState;

  async model() {
    await this.moonoState.refreshAll();
    return {};
  }
}
