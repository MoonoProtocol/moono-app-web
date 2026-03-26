import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class LoanRoute extends Route {
  @service('moono-state') moonoState;

  async model(params) {
    await this.moonoState.refreshAll();
    return {
      address: params.loan_address,
    };
  }
}
