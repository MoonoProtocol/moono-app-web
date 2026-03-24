import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { formatTickPercentage } from 'moono/utils/moono-solana';

export default class PoolDetailComponent extends Component {
  @service('moono-state') moonoState;

  @tracked depositAmount = '';
  @tracked selectedTickSliderValue = '0';
  @tracked withdrawAmounts = {};
  @tracked depositBusy = false;
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

  get walletQuoteAssetBalance() {
    return this.moonoState.walletTokenBalances.find(
      (balance) => balance.mint === this.pool?.mint,
    );
  }

  get walletQuoteAssetBalanceText() {
    return this.walletQuoteAssetBalance?.amountFormatted ?? '0';
  }

  get walletQuoteAssetBalanceRaw() {
    return BigInt(this.walletQuoteAssetBalance?.amount ?? '0');
  }

  get walletQuoteAssetBalanceMax() {
    return formatBaseUnitsForInput(
      this.walletQuoteAssetBalanceRaw,
      this.pool?.decimals ?? 0,
    );
  }

  get walletQuoteAssetBalanceStep() {
    let rawBalance = this.walletQuoteAssetBalanceRaw;

    if (rawBalance <= 0n) {
      return '0.01';
    }

    let rawStep = rawBalance / 100n;

    if (rawStep <= 0n) {
      rawStep = 1n;
    }

    return formatBaseUnitsForInput(rawStep, this.pool?.decimals ?? 0);
  }

  get depositAmountSliderValue() {
    if (!this.depositAmount?.trim()) {
      return '0';
    }

    let normalized = normalizeDecimalInput(this.depositAmount);
    let current = Number(normalized);
    let max = Number(this.walletQuoteAssetBalanceMax);

    if (!Number.isFinite(current) || current < 0) {
      return '0';
    }

    if (Number.isFinite(max) && current > max) {
      return this.walletQuoteAssetBalanceMax;
    }

    return normalized;
  }

  get availableTicks() {
    return (this.pool?.tickPages ?? [])
      .flatMap((tickPage) =>
        tickPage.ticks.map((tick) => ({
          ...tick,
          pageIndex: tickPage.pageIndex,
          pageAddress: tickPage.address,
          apyLabel: formatTickPercentage(tick.absoluteIndex),
        })),
      )
      .sort((left, right) => left.absoluteIndex - right.absoluteIndex);
  }

  get hasAvailableTicks() {
    return this.availableTicks.length > 0;
  }

  get sliderMax() {
    return Math.max(this.availableTicks.length - 1, 0);
  }

  get selectedTickOption() {
    if (!this.availableTicks.length) {
      return null;
    }

    let sliderIndex = Number(this.selectedTickSliderValue);
    let safeIndex = Number.isInteger(sliderIndex)
      ? Math.min(Math.max(sliderIndex, 0), this.sliderMax)
      : 0;

    return this.availableTicks[safeIndex] ?? this.availableTicks[0];
  }

  get firstTickOption() {
    return this.availableTicks[0] ?? null;
  }

  get lastTickOption() {
    return this.availableTicks[this.availableTicks.length - 1] ?? null;
  }

  get depositDisabled() {
    return (
      this.walletDisconnected ||
      !this.pool?.allowDeposits ||
      !this.selectedTickOption
    );
  }

  get depositBalanceSliderDisabled() {
    return this.depositDisabled || this.walletQuoteAssetBalanceRaw <= 0n;
  }

  get walletDisconnected() {
    return !this.moonoState.walletConnected;
  }

  formatTickPercentage(tick) {
    return formatTickPercentage(tick);
  }

  @action updateDepositAmount(event) {
    this.depositAmount = event.target.value;
  }

  @action updateDepositAmountFromSlider(event) {
    this.depositAmount = event.target.value;
  }

  @action updateSelectedTickSliderValue(event) {
    this.selectedTickSliderValue = event.target.value;
  }

  @action updateWithdrawAmount(positionAddress, event) {
    this.withdrawAmounts = {
      ...this.withdrawAmounts,
      [positionAddress]: event.target.value,
    };
  }

  @action async deposit() {
    if (!this.selectedTickOption) {
      return;
    }

    this.depositBusy = true;
    this.actionError = null;
    this.actionMessage = null;

    try {
      let signature = await this.moonoState.depositToTick(
        this.pool.address,
        this.selectedTickOption.absoluteIndex,
        this.depositAmount,
      );

      this.depositAmount = '';
      this.actionMessage = `Deposit submitted: ${signature}`;
    } catch (error) {
      this.actionError = error?.message ?? 'Deposit failed.';
    } finally {
      this.depositBusy = false;
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

function formatBaseUnitsForInput(value, decimals) {
  let amount = BigInt(value ?? 0);
  let scale = 10n ** BigInt(decimals);
  let whole = amount / scale;
  let fraction = amount % scale;

  if (decimals === 0) {
    return whole.toString();
  }

  let paddedFraction = fraction.toString().padStart(decimals, '0');
  let trimmedFraction = paddedFraction.replace(/0+$/, '');

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
}

function normalizeDecimalInput(value) {
  let normalized = String(value ?? '').trim();

  if (!normalized) {
    return '0';
  }

  if (normalized.startsWith('.')) {
    return `0${normalized}`;
  }

  return normalized;
}
