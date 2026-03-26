import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class ProfileController extends Controller {
  @service('moono-state') moonoState;

  @tracked wrapAmount = '';
  @tracked wrapBusy = false;
  @tracked unwrapBusy = false;
  @tracked actionError = null;
  @tracked actionMessage = null;

  @action updateWrapAmount(event) {
    this.wrapAmount = event.target.value;
  }

  @action async wrapSol() {
    this.wrapBusy = true;
    this.actionError = null;
    this.actionMessage = null;

    try {
      let signature = await this.moonoState.wrapSolToWsol(this.wrapAmount);
      this.wrapAmount = '';
      this.actionMessage = `Wrapped SOL to WSOL: ${signature}`;
    } catch (error) {
      this.actionError = error?.message ?? 'Failed to wrap SOL.';
    } finally {
      this.wrapBusy = false;
    }
  }

  @action async unwrapAllWsol() {
    this.unwrapBusy = true;
    this.actionError = null;
    this.actionMessage = null;

    try {
      let signature = await this.moonoState.unwrapAllWsol();
      this.actionMessage = `Unwrapped WSOL to SOL: ${signature}`;
    } catch (error) {
      this.actionError = error?.message ?? 'Failed to unwrap WSOL.';
    } finally {
      this.unwrapBusy = false;
    }
  }
}
