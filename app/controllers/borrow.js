import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class BorrowController extends Controller {
  @service('moono-state') moonoState;
}
