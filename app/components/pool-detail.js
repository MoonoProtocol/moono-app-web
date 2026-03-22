import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class PoolDetailComponent extends Component {
  @service('moono-state') moonoState;

  @tracked depositAmounts = {};
  @tracked withdrawAmounts = {};
  @tracked depositBusy = {};
  @tracked withdrawBusy = {};
  @tracked actionError = null;
  @tracked actionMessage = null;

  get pool() {
    return this.args.pool;
  }

  get positions() {
    return this.moonoState.lpPositions.filter(
      (position) => position.assetPool === this.pool?.address,
    );
  }

  @action updateDepositAmount(tickIndex, event) {
    this.depositAmounts = {
      ...this.depositAmounts,
      [tickIndex]: event.target.value,
    };
  }

  @action updateWithdrawAmount(positionAddress, event) {
    this.withdrawAmounts = {
      ...this.withdrawAmounts,
      [positionAddress]: event.target.value,
    };
  }

  @action async deposit(tickIndex) {
    this.depositBusy = {
      ...this.depositBusy,
      [tickIndex]: true,
    };
    this.actionError = null;
    this.actionMessage = null;

    try {
      let signature = await this.moonoState.depositToTick(
        this.pool.address,
        tickIndex,
        this.depositAmounts[tickIndex],
      );

      this.depositAmounts = {
        ...this.depositAmounts,
        [tickIndex]: '',
      };
      this.actionMessage = `Deposit submitted: ${signature}`;
    } catch (error) {
      this.actionError = error?.message ?? 'Deposit failed.';
    } finally {
      this.depositBusy = {
        ...this.depositBusy,
        [tickIndex]: false,
      };
    }
  }

  @action async withdraw(positionAddress) {
    this.withdrawBusy = {
      ...this.withdrawBusy,
      [positionAddress]: true,
    };
    this.actionError = null;
    this.actionMessage = null;

    try {
      let signature = await this.moonoState.withdrawPosition(
        positionAddress,
        this.withdrawAmounts[positionAddress],
      );

      this.withdrawAmounts = {
        ...this.withdrawAmounts,
        [positionAddress]: '',
      };
      this.actionMessage = `Withdraw submitted: ${signature}`;
    } catch (error) {
      this.actionError = error?.message ?? 'Withdraw failed.';
    } finally {
      this.withdrawBusy = {
        ...this.withdrawBusy,
        [positionAddress]: false,
      };
    }
  }
}
