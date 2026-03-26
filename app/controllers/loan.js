import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class LoanController extends Controller {
  @service('moono-state') moonoState;

  get loan() {
    return this.moonoState.findLoan(this.model?.address);
  }
}
