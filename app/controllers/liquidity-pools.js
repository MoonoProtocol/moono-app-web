import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class LiquidityPoolsController extends Controller {
  @service('moono-state') moonoState;
}
