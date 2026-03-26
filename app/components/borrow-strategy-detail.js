import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import {
  LOAN_STATUS_EXECUTED,
  MODE_PUMP_FUN,
  formatTokenAmount,
  formatTickPercentage,
} from 'moono/utils/moono-solana';

export default class BorrowStrategyDetailComponent extends Component {
  @service router;
  @service('moono-state') moonoState;

  @tracked requestedQuoteAmount = '12';
  @tracked extraUserQuoteAmount = '2';
  @tracked termDays = '30';

  @tracked plannerBusy = false;
  @tracked actionError = null;
  @tracked actionMessage = null;

  get strategy() {
    return this.args.strategy;
  }

  get isPumpFun() {
    return this.strategy?.mode === MODE_PUMP_FUN;
  }

  get pool() {
    return this.moonoState.borrowableWsolPool;
  }

  get poolAvailable() {
    return Boolean(this.pool);
  }

  get pumpFunConfig() {
    return this.moonoState.pumpFunEnvConfig;
  }

  get runtimeConfigReady() {
    if (!this.pumpFunConfig?.programId) {
      return false;
    }

    if (this.moonoState.settings.networkPreset === 'localnet') {
      return true;
    }

    return Boolean(
      this.pumpFunConfig.global &&
      this.pumpFunConfig.eventAuthority &&
      this.pumpFunConfig.feeRecipient &&
      this.pumpFunConfig.creatorVault &&
      this.pumpFunConfig.mayhemProgramId &&
      this.pumpFunConfig.globalParams &&
      this.pumpFunConfig.solVault &&
      this.pumpFunConfig.feeProgramId &&
      this.pumpFunConfig.feeConfigAuthority,
    );
  }

  get latestPumpFunLoan() {
    return this.moonoState.latestLoanForStrategy(MODE_PUMP_FUN);
  }

  get latestExecutedLoan() {
    return this.moonoState.walletLoans.find(
      (loan) =>
        loan.strategyMode === MODE_PUMP_FUN &&
        loan.status === LOAN_STATUS_EXECUTED,
    );
  }

  get planPreview() {
    if (!this.isPumpFun || !this.poolAvailable) {
      return { plan: null, error: null };
    }

    try {
      return {
        plan: this.moonoState.buildPumpFunBorrowPlan({
          requestedQuoteAmountInput: this.requestedQuoteAmount,
          extraUserQuoteAmountInput: this.extraUserQuoteAmount,
          termDaysInput: this.termDays,
        }),
        error: null,
      };
    } catch (error) {
      return {
        plan: null,
        error: error?.message ?? 'Borrow plan is invalid.',
      };
    }
  }

  get plan() {
    return this.planPreview.plan;
  }

  get planError() {
    return this.planPreview.error;
  }

  get fillRows() {
    return (this.plan?.fills ?? []).map((fill) => ({
      ...fill,
      tickLabel: formatTickPercentage(fill.tick),
      principalFormatted: this.formatQuote(fill.principalAmount),
      upfrontInterestFormatted: this.formatQuote(fill.upfrontInterestAmount),
      protocolFeeFormatted: this.formatQuote(fill.protocolFeeAmount),
    }));
  }

  get canOpenLoan() {
    return Boolean(
      this.moonoState.walletConnected &&
      this.poolAvailable &&
      this.plan &&
      !this.planError,
    );
  }

  get upfrontPaidNowFormatted() {
    if (!this.plan || !this.pool) {
      return '0';
    }

    let total =
      BigInt(this.plan.requiredQuoteBufferAmount) +
      BigInt(this.plan.totalUpfrontInterestPaid) +
      BigInt(this.plan.totalProtocolFeePaid) +
      BigInt(this.plan.totalPlatformCostPaid);

    return formatTokenAmount(total, this.pool.decimals);
  }

  get extraBuyFundsRequiredAtLaunchFormatted() {
    if (!this.plan || !this.pool) {
      return '0';
    }

    return formatTokenAmount(
      this.plan.extraUserQuoteAmount,
      this.pool.decimals,
    );
  }

  get openLoanDisabled() {
    return !this.canOpenLoan;
  }

  formatQuote(value) {
    if (!this.pool) {
      return String(value ?? '0');
    }

    return formatTokenAmount(value, this.pool.decimals);
  }

  @action updateField(field, event) {
    this[field] = event.target.value;
  }

  @action async openLoan() {
    if (!this.plan) {
      return;
    }

    this.plannerBusy = true;
    this.actionError = null;
    this.actionMessage = null;

    try {
      let result = await this.moonoState.openPumpFunLoan(this.plan);
      this.router.transitionTo('loan', result.loanAddress);
    } catch (error) {
      this.actionError = error?.message ?? 'Failed to open loan.';
    } finally {
      this.plannerBusy = false;
    }
  }
}
