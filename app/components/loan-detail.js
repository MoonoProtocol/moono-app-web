import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import {
  formatTokenAmount,
  LOAN_STATUS_EXECUTED,
  LOAN_STATUS_FUNDED,
  LOAN_STATUS_OPENED,
} from 'moono/utils/moono-solana';

export default class LoanDetailComponent extends Component {
  @service('moono-state') moonoState;

  @tracked fundingBusy = false;
  @tracked executeBusy = false;
  @tracked actionError = null;
  @tracked actionMessage = null;

  @tracked tokenName = 'Moono';
  @tracked tokenSymbol = 'MNO';
  @tracked tokenUri = 'https://example.com/token.json';

  constructor() {
    super(...arguments);

    let savedDraft = this.args.loan
      ? this.moonoState.loanPlanForAddress(this.args.loan.address)
      : null;

    if (savedDraft?.tokenName) {
      this.tokenName = savedDraft.tokenName;
    }

    if (savedDraft?.tokenSymbol) {
      this.tokenSymbol = savedDraft.tokenSymbol;
    }

    if (savedDraft?.tokenUri) {
      this.tokenUri = savedDraft.tokenUri;
    }
  }

  get loan() {
    return this.args.loan;
  }

  get storedPlan() {
    return this.loan
      ? this.moonoState.loanPlanForAddress(this.loan.address)
      : null;
  }

  get borrowSlices() {
    return this.loan
      ? this.moonoState.borrowSlicesForLoan(this.loan.address)
      : [];
  }

  get canFund() {
    return Boolean(
      this.loan?.status === LOAN_STATUS_OPENED &&
      this.storedPlan?.fills?.length,
    );
  }

  get fundDisabled() {
    return !this.canFund;
  }

  get canExecute() {
    return Boolean(
      this.loan?.status === LOAN_STATUS_FUNDED && this.metadataReady,
    );
  }

  get executeDisabled() {
    return !this.canExecute;
  }

  get metadataReady() {
    return Boolean(
      String(this.tokenName ?? '').trim() &&
      String(this.tokenSymbol ?? '').trim() &&
      String(this.tokenUri ?? '').trim(),
    );
  }

  get isExecuted() {
    return this.loan?.status === LOAN_STATUS_EXECUTED;
  }

  get plannedLoanQuoteSpendFormatted() {
    return this.loan?.fundedQuoteAmountFormatted ?? '0';
  }

  get plannedExtraUserQuoteSpendFormatted() {
    return this.loan?.extraUserQuoteAmountFormatted ?? '0';
  }

  get collateralMinBaseOut() {
    return '1';
  }

  get immediateUserMinBaseOut() {
    return BigInt(this.loan?.extraUserQuoteAmount ?? 0) > 0n ? '1' : '0';
  }

  get upfrontPaidNowFormatted() {
    if (!this.loan?.pool) {
      return '0';
    }

    let total =
      BigInt(this.loan.requiredQuoteBufferAmount ?? 0) +
      BigInt(this.loan.totalUpfrontInterestPaid ?? 0) +
      BigInt(this.loan.totalProtocolFeePaid ?? 0) +
      BigInt(this.loan.totalPlatformCostPaid ?? 0);

    return formatTokenAmount(total, this.loan.pool.decimals ?? 0);
  }

  get extraBuyFundsRequiredAtLaunchFormatted() {
    return this.loan?.extraUserQuoteAmountFormatted ?? '0';
  }

  @action updateField(field, event) {
    this[field] = event.target.value;
  }

  @action async fundLoan() {
    if (!this.loan) {
      return;
    }

    this.fundingBusy = true;
    this.actionError = null;
    this.actionMessage = null;

    try {
      let signature = await this.moonoState.fundPumpFunLoan({
        loanAddress: this.loan.address,
      });
      this.actionMessage = `Loan funded: ${signature}`;
    } catch (error) {
      this.actionError = error?.message ?? 'Failed to fund loan.';
    } finally {
      this.fundingBusy = false;
    }
  }

  @action async executeLaunch() {
    if (!this.loan) {
      return;
    }

    this.executeBusy = true;
    this.actionError = null;
    this.actionMessage = null;

    try {
      let result = await this.moonoState.executePumpFunLaunch({
        loanAddress: this.loan.address,
        name: this.tokenName,
        symbol: this.tokenSymbol,
        uri: this.tokenUri,
        loanQuoteSpendAmountInput: this.plannedLoanQuoteSpendFormatted,
        extraUserQuoteSpendAmountInput:
          this.plannedExtraUserQuoteSpendFormatted,
        collateralMinBaseOutInput: this.collateralMinBaseOut,
        immediateUserMinBaseOutInput: this.immediateUserMinBaseOut,
      });
      this.actionMessage = `Launch executed: ${result.mintAddress}`;
    } catch (error) {
      this.actionError = error?.message ?? 'Failed to execute launch.';
    } finally {
      this.executeBusy = false;
    }
  }
}
