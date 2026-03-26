import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { PublicKey, Transaction } from '@solana/web3.js';

import {
  BLOCKCHAIN_OPTIONS,
  DEFAULT_PROGRAM_ID,
  LOAN_STATUS_FUNDED,
  LOAN_STATUS_OPENED,
  MODE_PUMP_FUN,
  NETWORK_PRESETS,
  SETTINGS_STORAGE_KEY,
  SOLANA_CHAIN_KEY,
  STRATEGY_SLUG_TO_MODE,
  buildExecuteLaunchPumpFunTransaction,
  buildFundLoanFromTicksTransaction,
  buildInitializeBorrowSliceTransaction,
  buildOpenLoanTransaction,
  buildRoutePlan,
  buildRoutePlanHash,
  buildWrapSolInstructions,
  buildDepositToTickTransaction,
  buildInitializeTickPageTransaction,
  buildVersionedTransaction,
  buildUnwrapWsolInstruction,
  buildWithdrawFromTickTransaction,
  createLookupTableInstruction,
  deriveBorrowSlicePda,
  deriveBondingCurvePda,
  deriveBondingCurveV2Pda,
  deriveCreatorVaultPda,
  deriveFeeConfigPda,
  deriveGlobalVolumeAccumulatorPda,
  deriveLpPositionPda,
  deriveLoanExecutionWalletPda,
  deriveLoanPositionPda,
  deriveLoanQuoteBufferVaultPda,
  deriveLoanQuoteVaultPda,
  deriveLoanVaultAuthorityPda,
  deriveMayhemStatePda,
  deriveProtocolPda,
  deriveProtocolQuoteTreasuryAuthorityPda,
  deriveProtocolQuoteTreasuryVaultPda,
  deriveStrategyConfigPda,
  deriveTempWsolVaultPda,
  deriveTickPagePda,
  deriveUserVolumeAccumulatorPda,
  deriveVaultAuthorityPda,
  ensureAssociatedTokenAccountInstruction,
  extendLookupTableInstruction,
  fetchBorrowSlicesForOwner,
  fetchAllAssetPools,
  fetchAllExecutionStrategyConfigs,
  fetchAllTickPages,
  fetchMintInfo,
  fetchProtocolAccount,
  fetchWalletLoanPositions,
  fetchWalletLpPositions,
  fetchWalletTokenBalances,
  formatMintDisplayLabel,
  formatTokenAmount,
  generateLoanId,
  generateMintKeypair,
  getPumpFunEnvConfig,
  getPhantomProvider,
  isWsolMint,
  makeConnection,
  parsePublicKey,
  parseTokenAmountToBaseUnits,
  shortAddress,
  signAndSendTransaction,
  strategyDescription,
  validatePlanTotals,
} from 'moono/utils/moono-solana';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

const DEFAULT_SETTINGS = {
  blockchain: SOLANA_CHAIN_KEY,
  networkPreset: 'localnet',
  rpcEndpoint: NETWORK_PRESETS.localnet.rpcEndpoint,
  programId: DEFAULT_PROGRAM_ID,
};
const WALLET_AUTOCONNECT_STORAGE_KEY = 'moono-wallet-autoconnect-v1';
const LOAN_ID_STORAGE_KEY = 'moono-loan-id-map-v1';
const LOAN_PLAN_STORAGE_KEY = 'moono-loan-plan-map-v1';
const LOOKUP_TABLE_STORAGE_KEY = 'moono-lookup-table-map-v1';

export default class MoonoStateService extends Service {
  refreshPromise = null;

  @tracked settings = { ...DEFAULT_SETTINGS };
  @tracked settingsError = null;

  @tracked phantomAvailable = false;
  @tracked walletBusy = false;
  @tracked walletError = null;
  @tracked walletAddress = null;
  @tracked walletBalance = null;
  @tracked walletBalanceLamports = '0';
  @tracked walletTokenBalances = [];
  @tracked walletLoans = [];
  @tracked borrowSlices = [];

  @tracked refreshBusy = false;
  @tracked refreshError = null;
  @tracked protocol = {
    address: null,
    exists: false,
  };
  @tracked assetPools = [];
  @tracked executionStrategies = [];
  @tracked lpPositions = [];
  @tracked lastSignature = null;

  constructor() {
    super(...arguments);
    this.loadStoredSettings();
    this.syncPhantomState();
    this.refreshAll();
    this.restoreWalletConnection();
  }

  get blockchainOptions() {
    return BLOCKCHAIN_OPTIONS.map((option) => ({
      ...option,
      selected: option.key === this.settings.blockchain,
    }));
  }

  get networkOptions() {
    return Object.entries(NETWORK_PRESETS).map(([key, preset]) => ({
      key,
      label: preset.label,
      selected: key === this.settings.networkPreset,
    }));
  }

  get connection() {
    return makeConnection(this.settings.rpcEndpoint);
  }

  get protocolPdaString() {
    let programPublicKey = parsePublicKey(this.settings.programId);

    if (!programPublicKey) {
      return 'invalid program id';
    }

    return deriveProtocolPda(programPublicKey)[0].toBase58();
  }

  get walletConnected() {
    return Boolean(this.walletAddress);
  }

  get walletShort() {
    return shortAddress(this.walletAddress);
  }

  get walletBalanceText() {
    return this.walletBalance ?? 'n/a';
  }

  get poolsEnabledCount() {
    return this.assetPools.filter((pool) => pool.isEnabled).length;
  }

  get totalAvailableLiquidityFormatted() {
    let total = this.assetPools.reduce(
      (sum, pool) => sum + BigInt(pool.totalAvailableLiquidityRaw ?? 0),
      0n,
    );

    return formatTokenAmount(total, 0);
  }

  get dashboardLiquidityByMint() {
    let totalsByMint = new Map();

    for (let pool of this.assetPools) {
      let existing = totalsByMint.get(pool.mint) ?? {
        mint: pool.mint,
        mintLabel: pool.mintLabel,
        decimals: pool.decimals,
        totalRaw: 0n,
      };

      existing.totalRaw += BigInt(pool.totalAvailableLiquidityRaw ?? 0);
      totalsByMint.set(pool.mint, existing);
    }

    return [...totalsByMint.values()]
      .map((entry) => ({
        ...entry,
        totalFormatted: formatTokenAmount(entry.totalRaw, entry.decimals),
      }))
      .sort((left, right) => left.mintLabel.localeCompare(right.mintLabel));
  }

  get borrowStrategyCards() {
    return this.executionStrategies
      .filter((strategy) => strategy.isEnabled)
      .map((strategy) => ({
        slug: strategy.slug,
        label: strategy.label,
        strategy,
        availableLiquidity: this.assetPools
          .filter((pool) =>
            strategy.mode === MODE_PUMP_FUN
              ? pool.allowBorrows && isWsolMint(pool.mint)
              : pool.allowBorrows,
          )
          .map((pool) => ({
            address: pool.address,
            mint: pool.mint,
            mintLabel: pool.mintLabel,
            totalAvailableLiquidityFormatted:
              pool.totalAvailableLiquidityFormatted,
          })),
      }));
  }

  get borrowEnabledPools() {
    return this.assetPools.filter((pool) => pool.allowBorrows);
  }

  get assetPoolsByAddress() {
    return new Map(this.assetPools.map((pool) => [pool.address, pool]));
  }

  get strategiesByMode() {
    return new Map(
      this.executionStrategies.map((strategy) => [strategy.mode, strategy]),
    );
  }

  get pumpFunStrategy() {
    return (
      this.executionStrategies.find(
        (strategy) => strategy.mode === MODE_PUMP_FUN,
      ) ?? null
    );
  }

  get wsolAssetPools() {
    return this.assetPools.filter((pool) => isWsolMint(pool.mint));
  }

  get borrowableWsolPool() {
    return (
      this.wsolAssetPools.find((pool) => pool.allowBorrows && pool.isEnabled) ??
      null
    );
  }

  get pumpFunEnvConfig() {
    return getPumpFunEnvConfig(this.settings.networkPreset);
  }

  loadStoredSettings() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    let stored = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(stored),
      };
    } catch {
      this.settingsError = 'Failed to load saved settings.';
    }
  }

  persistSettings() {
    this.settingsError = null;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    }
  }

  updateBlockchain(value) {
    this.settings = {
      ...this.settings,
      blockchain: value,
    };
    this.persistSettings();
  }

  async updateNetworkPreset(value, customRpcEndpoint = null) {
    let rpcEndpoint =
      value === 'custom'
        ? (customRpcEndpoint ?? this.settings.rpcEndpoint)
        : (NETWORK_PRESETS[value]?.rpcEndpoint ?? this.settings.rpcEndpoint);

    this.settings = {
      ...this.settings,
      networkPreset: value,
      rpcEndpoint: rpcEndpoint || this.settings.rpcEndpoint,
    };
    this.persistSettings();
    await this.refreshAll();
  }

  syncPhantomState() {
    let provider = getPhantomProvider();
    this.phantomAvailable = Boolean(provider);

    if (provider?.publicKey) {
      this.walletAddress = provider.publicKey.toBase58();
      this.refreshWalletState();
    }
  }

  async restoreWalletConnection() {
    if (!this.shouldAutoconnectWallet()) {
      return;
    }

    let provider = getPhantomProvider();

    if (!provider) {
      return;
    }

    try {
      let response = await provider.connect({ onlyIfTrusted: true });
      this.walletAddress =
        response?.publicKey?.toBase58?.() ??
        provider.publicKey?.toBase58?.() ??
        null;

      if (this.walletAddress) {
        await this.refreshWalletState();
      }
    } catch {
      this.clearWalletAutoconnectPreference();
    }
  }

  async toggleWalletConnection() {
    if (this.walletConnected) {
      this.disconnectWallet();
      return;
    }

    let provider = getPhantomProvider();

    if (!provider) {
      this.walletError = 'Phantom wallet was not detected.';
      return;
    }

    this.walletBusy = true;
    this.walletError = null;

    try {
      let response = await provider.connect();
      this.walletAddress = response.publicKey.toBase58();
      this.persistWalletAutoconnectPreference();
      await this.refreshWalletState();
    } catch (error) {
      this.walletError = error?.message ?? 'Failed to connect wallet.';
    } finally {
      this.walletBusy = false;
    }
  }

  disconnectWallet() {
    let provider = getPhantomProvider();

    provider?.disconnect?.();
    this.clearWalletAutoconnectPreference();

    this.walletAddress = null;
    this.walletBalance = null;
    this.walletBalanceLamports = '0';
    this.walletTokenBalances = [];
    this.lpPositions = [];
    this.walletLoans = [];
    this.borrowSlices = [];
    this.walletError = null;
  }

  async refreshAll() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshBusy = true;
    this.refreshError = null;
    this.refreshPromise = (async () => {
      try {
        let programPublicKey = parsePublicKey(this.settings.programId);

        if (!programPublicKey) {
          throw new Error('Program ID is not a valid Solana public key.');
        }

        let connection = this.connection;
        let [protocol, assetPools, tickPages, executionStrategies] =
          await Promise.all([
            fetchProtocolAccount(connection, programPublicKey),
            fetchAllAssetPools(connection, programPublicKey),
            fetchAllTickPages(connection, programPublicKey),
            fetchAllExecutionStrategyConfigs(connection, programPublicKey),
          ]);

        let tickPagesByPool = new Map();

        for (let tickPage of tickPages) {
          let existing = tickPagesByPool.get(tickPage.assetPool) ?? [];
          existing.push(tickPage);
          tickPagesByPool.set(tickPage.assetPool, existing);
        }

        let poolsWithSummaries = await Promise.all(
          assetPools.map(async (pool) => {
            let mintInfo = await fetchMintInfo(connection, pool.mint);
            let poolTickPages = (tickPagesByPool.get(pool.address) ?? []).sort(
              (left, right) => left.pageIndex - right.pageIndex,
            );
            let totalAvailableLiquidityRaw = poolTickPages.reduce(
              (sum, tickPage) => sum + BigInt(tickPage.totalAvailableLiquidity),
              0n,
            );
            let totalSharesRaw = poolTickPages.reduce(
              (sum, tickPage) => sum + BigInt(tickPage.totalShares),
              0n,
            );

            return {
              ...pool,
              tickPages: poolTickPages,
              mintLabel: formatMintDisplayLabel(pool.mint),
              tokenProgram: mintInfo.tokenProgram,
              totalAvailableLiquidityRaw: totalAvailableLiquidityRaw.toString(),
              totalAvailableLiquidityFormatted: formatTokenAmount(
                totalAvailableLiquidityRaw,
                pool.decimals,
              ),
              totalSharesRaw: totalSharesRaw.toString(),
              totalSharesFormatted: formatTokenAmount(
                totalSharesRaw,
                pool.decimals,
              ),
            };
          }),
        );

        this.protocol = protocol;
        this.assetPools = poolsWithSummaries;
        this.executionStrategies = executionStrategies;

        await this.refreshWalletState();
      } catch (error) {
        this.refreshError =
          error?.message ?? 'Failed to refresh protocol data.';
      } finally {
        this.refreshBusy = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async refreshWalletState() {
    if (!this.walletAddress) {
      return;
    }

    try {
      let connection = this.connection;
      let [
        balanceLamports,
        tokenBalances,
        lpPositions,
        walletLoans,
        borrowSlices,
      ] = await Promise.all([
        connection.getBalance(parsePublicKey(this.walletAddress)),
        fetchWalletTokenBalances(
          connection,
          this.walletAddress,
          this.assetPools,
        ),
        fetchWalletLpPositions(
          connection,
          this.settings.programId,
          this.walletAddress,
          this.assetPoolsByAddress,
        ),
        fetchWalletLoanPositions(
          connection,
          this.settings.programId,
          this.walletAddress,
          this.assetPoolsByAddress,
          this.strategiesByMode,
        ),
        fetchBorrowSlicesForOwner(
          connection,
          this.settings.programId,
          this.walletAddress,
        ),
      ]);

      this.walletBalance = `${formatTokenAmount(balanceLamports, 9, {
        preserveTrailingZeros: true,
      })} SOL`;
      this.walletBalanceLamports = balanceLamports.toString();
      this.walletTokenBalances = tokenBalances
        .map((balance) => ({
          ...balance,
          mintLabel: formatMintDisplayLabel(balance.mint),
        }))
        .sort((left, right) => left.mintLabel.localeCompare(right.mintLabel));
      this.lpPositions = lpPositions.map((position) => {
        let tickPage = position.pool?.tickPages?.find((page) =>
          page.ticks.some((tick) => tick.absoluteIndex === position.tick),
        );
        let tickState = tickPage?.ticks?.find(
          (tick) => tick.absoluteIndex === position.tick,
        );
        let redeemableRaw =
          tickState && BigInt(tickState.totalShares) > 0n
            ? (BigInt(position.shares) * BigInt(tickState.availableLiquidity)) /
              BigInt(tickState.totalShares)
            : 0n;

        return {
          ...position,
          redeemableRaw: redeemableRaw.toString(),
          redeemableFormatted: formatTokenAmount(
            redeemableRaw,
            position.decimals ?? 0,
          ),
        };
      });
      this.walletLoans = walletLoans.map((loan) => ({
        ...loan,
        requestedQuoteAmountFormatted: formatTokenAmount(
          loan.requestedQuoteAmount,
          loan.pool?.decimals ?? 0,
        ),
        fundedQuoteAmountFormatted: formatTokenAmount(
          loan.fundedQuoteAmount,
          loan.pool?.decimals ?? 0,
        ),
        extraUserQuoteAmountFormatted: formatTokenAmount(
          loan.extraUserQuoteAmount,
          loan.pool?.decimals ?? 0,
        ),
        requiredQuoteBufferAmountFormatted: formatTokenAmount(
          loan.requiredQuoteBufferAmount,
          loan.pool?.decimals ?? 0,
        ),
        totalUpfrontInterestPaidFormatted: formatTokenAmount(
          loan.totalUpfrontInterestPaid,
          loan.pool?.decimals ?? 0,
        ),
        totalProtocolFeePaidFormatted: formatTokenAmount(
          loan.totalProtocolFeePaid,
          loan.pool?.decimals ?? 0,
        ),
        totalPlatformCostPaidFormatted: formatTokenAmount(
          loan.totalPlatformCostPaid,
          loan.pool?.decimals ?? 0,
        ),
        executedLoanQuoteAmountFormatted: formatTokenAmount(
          loan.executedLoanQuoteAmount,
          loan.pool?.decimals ?? 0,
        ),
        executedExtraUserQuoteAmountFormatted: formatTokenAmount(
          loan.executedExtraUserQuoteAmount,
          loan.pool?.decimals ?? 0,
        ),
      }));
      this.borrowSlices = borrowSlices;
    } catch (error) {
      this.walletError = error?.message ?? 'Failed to load wallet state.';
    }
  }

  findPool(address) {
    return this.assetPools.find((pool) => pool.address === address) ?? null;
  }

  findStrategy(slug) {
    let mode = STRATEGY_SLUG_TO_MODE[slug];

    return (
      this.executionStrategies.find((strategy) => strategy.mode === mode) ??
      null
    );
  }

  describeStrategy(slug) {
    return strategyDescription(this.findStrategy(slug));
  }

  findLoan(address) {
    return this.walletLoans.find((loan) => loan.address === address) ?? null;
  }

  borrowSlicesForLoan(loanAddress) {
    return this.borrowSlices.filter(
      (slice) => slice.loanPosition === loanAddress,
    );
  }

  latestLoanForStrategy(mode) {
    return this.walletLoans.find((loan) => loan.strategyMode === mode) ?? null;
  }

  shouldAutoconnectWallet() {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(WALLET_AUTOCONNECT_STORAGE_KEY) === 'true';
  }

  persistWalletAutoconnectPreference() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(WALLET_AUTOCONNECT_STORAGE_KEY, 'true');
  }

  clearWalletAutoconnectPreference() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(WALLET_AUTOCONNECT_STORAGE_KEY);
  }

  loadLoanIdMap() {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      return JSON.parse(localStorage.getItem(LOAN_ID_STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  persistLoanId(loanAddress, loanId) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    let loanIdMap = this.loadLoanIdMap();
    loanIdMap[loanAddress] = String(loanId);
    localStorage.setItem(LOAN_ID_STORAGE_KEY, JSON.stringify(loanIdMap));
  }

  loanIdForAddress(loanAddress) {
    return this.loadLoanIdMap()[loanAddress] ?? null;
  }

  loadLoanPlanMap() {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      return JSON.parse(localStorage.getItem(LOAN_PLAN_STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  persistLoanPlan(loanAddress, planDraft) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    let planMap = this.loadLoanPlanMap();
    planMap[loanAddress] = planDraft;
    localStorage.setItem(LOAN_PLAN_STORAGE_KEY, JSON.stringify(planMap));
  }

  loanPlanForAddress(loanAddress) {
    return this.loadLoanPlanMap()[loanAddress] ?? null;
  }

  loadLookupTableMap() {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      return JSON.parse(localStorage.getItem(LOOKUP_TABLE_STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  persistLookupTableAddress(key, address) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    let lookupTableMap = this.loadLookupTableMap();
    lookupTableMap[key] = address;
    localStorage.setItem(
      LOOKUP_TABLE_STORAGE_KEY,
      JSON.stringify(lookupTableMap),
    );
  }

  lookupTableAddressForKey(key) {
    return this.loadLookupTableMap()[key] ?? null;
  }

  lookupTableCacheKey(label) {
    return [
      this.settings.networkPreset,
      this.settings.programId,
      this.walletAddress,
      label,
    ].join(':');
  }

  async ensureLookupTable({ label, addresses, connection, provider }) {
    let cacheKey = this.lookupTableCacheKey(label);
    let cachedAddress = this.lookupTableAddressForKey(cacheKey);
    let normalizedAddresses = [
      ...new Set(
        addresses.map((address) => parsePublicKey(address).toBase58()),
      ),
    ].map((address) => parsePublicKey(address));
    let tableAddress = cachedAddress ? parsePublicKey(cachedAddress) : null;
    let lookupTableAccount = null;

    if (tableAddress) {
      let existing = await connection.getAddressLookupTable(tableAddress);
      lookupTableAccount = existing.value;
    }

    if (!lookupTableAccount) {
      let recentSlot = await connection.getSlot('confirmed');
      let [createIx, createdLookupTable] = createLookupTableInstruction({
        authority: this.walletAddress,
        payer: this.walletAddress,
        recentSlot,
      });
      let latestBlockhash = await connection.getLatestBlockhash('confirmed');
      let createTransaction = new Transaction({
        feePayer: parsePublicKey(this.walletAddress),
        recentBlockhash: latestBlockhash.blockhash,
      });
      createTransaction.add(createIx);

      await signAndSendTransaction({
        connection,
        provider,
        transaction: createTransaction,
      });

      tableAddress = createdLookupTable;
      this.persistLookupTableAddress(cacheKey, tableAddress.toBase58());

      let currentSlot = await connection.getSlot('confirmed');
      while (currentSlot <= recentSlot) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        currentSlot = await connection.getSlot('confirmed');
      }
    }

    let fetchedTable = await connection.getAddressLookupTable(tableAddress);
    lookupTableAccount = fetchedTable.value;

    if (!lookupTableAccount) {
      throw new Error('Lookup table could not be loaded after creation.');
    }

    let existingAddresses = new Set(
      lookupTableAccount.state.addresses.map((address) => address.toBase58()),
    );
    let missingAddresses = normalizedAddresses.filter(
      (address) => !existingAddresses.has(address.toBase58()),
    );

    if (missingAddresses.length > 0) {
      let latestBlockhash = await connection.getLatestBlockhash('confirmed');
      let extendTransaction = new Transaction({
        feePayer: parsePublicKey(this.walletAddress),
        recentBlockhash: latestBlockhash.blockhash,
      });
      extendTransaction.add(
        extendLookupTableInstruction({
          payer: this.walletAddress,
          authority: this.walletAddress,
          lookupTable: tableAddress,
          addresses: missingAddresses,
        }),
      );

      await signAndSendTransaction({
        connection,
        provider,
        transaction: extendTransaction,
      });

      let warmedUp = false;

      while (!warmedUp) {
        let refreshed = await connection.getAddressLookupTable(tableAddress);
        lookupTableAccount = refreshed.value;

        if (!lookupTableAccount) {
          throw new Error('Lookup table could not be reloaded after extend.');
        }

        let currentSlot = await connection.getSlot('confirmed');
        warmedUp = currentSlot > lookupTableAccount.state.lastExtendedSlot;

        if (!warmedUp) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    return lookupTableAccount;
  }

  async createFreshLookupTableForInstructions({
    instructions,
    connection,
    provider,
  }) {
    let currentSlot = await connection.getSlot('confirmed');
    let recentSlot = Math.max(currentSlot - 1, 0);
    let [createIx, lookupTableAddress] = createLookupTableInstruction({
      authority: this.walletAddress,
      payer: this.walletAddress,
      recentSlot,
    });
    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let createTransaction = new Transaction({
      feePayer: parsePublicKey(this.walletAddress),
      recentBlockhash: latestBlockhash.blockhash,
    });

    createTransaction.add(createIx);

    await signAndSendTransaction({
      connection,
      provider,
      transaction: createTransaction,
    });

    let addresses = Array.from(
      new Map(
        instructions
          .flatMap((instruction) => [
            ...instruction.keys.map((key) => key.pubkey),
            instruction.programId,
          ])
          .map((pubkey) => [pubkey.toBase58(), pubkey]),
      ).values(),
    );

    for (let index = 0; index < addresses.length; index += 20) {
      let extendLatestBlockhash =
        await connection.getLatestBlockhash('confirmed');
      let extendTransaction = new Transaction({
        feePayer: parsePublicKey(this.walletAddress),
        recentBlockhash: extendLatestBlockhash.blockhash,
      });

      extendTransaction.add(
        extendLookupTableInstruction({
          payer: this.walletAddress,
          authority: this.walletAddress,
          lookupTable: lookupTableAddress,
          addresses: addresses.slice(index, index + 20),
        }),
      );

      await signAndSendTransaction({
        connection,
        provider,
        transaction: extendTransaction,
      });
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    let lookup = await connection.getAddressLookupTable(lookupTableAddress);

    if (!lookup.value) {
      throw new Error('Fresh execute lookup table was not found on RPC.');
    }

    return lookup.value;
  }

  async depositToTick(poolAddress, tickIndex, amountInput) {
    let pool = this.findPool(poolAddress);

    if (!pool) {
      throw new Error('Asset Pool was not found.');
    }

    if (!this.walletAddress) {
      throw new Error('Connect a wallet before depositing.');
    }

    let provider = getPhantomProvider();

    if (!provider) {
      throw new Error('Phantom wallet was not detected.');
    }

    let connection = this.connection;
    let amount = parseTokenAmountToBaseUnits(amountInput, pool.decimals);

    if (amount <= 0n) {
      throw new Error('Amount must be greater than zero.');
    }

    if (isWsolMint(pool.mint)) {
      if (BigInt(this.walletBalanceLamports ?? '0') < amount) {
        throw new Error('Not enough SOL to wrap and deposit.');
      }
    } else {
      let walletBalance = this.walletQuoteBalanceForMint(pool.mint);

      if (BigInt(walletBalance?.amount ?? '0') < amount) {
        throw new Error(`Not enough ${pool.mintLabel} to deposit.`);
      }
    }
    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let ataData = isWsolMint(pool.mint)
      ? await buildWrapSolInstructions({
          connection,
          owner: this.walletAddress,
          lamports: amount,
        })
      : await ensureAssociatedTokenAccountInstruction({
          connection,
          owner: this.walletAddress,
          mint: pool.mint,
          tokenProgram: pool.tokenProgram,
        });
    let lpPosition = deriveLpPositionPda(
      this.settings.programId,
      this.walletAddress,
      pool.address,
      tickIndex,
    )[0];
    let pageIndex = Math.floor(Number(tickIndex) / 32);
    let [tickPageAddress] = deriveTickPagePda(
      this.settings.programId,
      pool.address,
      pageIndex,
    );
    let tickPage =
      pool.tickPages.find((page) => page.address === tickPageAddress.toBase58())
        ?.address ?? tickPageAddress.toBase58();
    let transaction = buildDepositToTickTransaction({
      amount,
      assetPool: pool.address,
      blockhash: latestBlockhash.blockhash,
      lpPosition,
      mint: pool.mint,
      owner: this.walletAddress,
      programId: this.settings.programId,
      protocol: this.protocol.address,
      tick: tickIndex,
      tickPage,
      tokenProgram: pool.tokenProgram,
      userTokenAccount: ataData.ata,
      vault: pool.vault,
    });

    let tickPageAccount = await connection.getAccountInfo(tickPageAddress);

    if (!tickPageAccount) {
      transaction.instructions.unshift(
        ...buildInitializeTickPageTransaction({
          blockhash: latestBlockhash.blockhash,
          pageIndex,
          programId: this.settings.programId,
          protocol: this.protocol.address,
          assetPool: pool.address,
          tickPage,
          authority: this.walletAddress,
        }).instructions,
      );
    }

    if (ataData.instructions?.length) {
      transaction.instructions.unshift(...ataData.instructions);
    } else if (ataData.instruction) {
      transaction.instructions.unshift(ataData.instruction);
    }

    let signature = await signAndSendTransaction({
      connection,
      provider,
      transaction,
    });

    this.lastSignature = signature;
    await this.refreshAll();
    return signature;
  }

  async withdrawPosition(positionAddress, sharesInput) {
    let position = this.lpPositions.find(
      (item) => item.address === positionAddress,
    );

    if (!position) {
      throw new Error('LP position was not found.');
    }

    if (!this.walletAddress) {
      throw new Error('Connect a wallet before withdrawing.');
    }

    let provider = getPhantomProvider();

    if (!provider) {
      throw new Error('Phantom wallet was not detected.');
    }

    let sharesToBurn = parseTokenAmountToBaseUnits(
      sharesInput,
      position.decimals ?? 0,
    );

    if (sharesToBurn <= 0n) {
      throw new Error('Shares to burn must be greater than zero.');
    }

    let tickPage = position.pool?.tickPages?.find((page) =>
      page.ticks.some((tick) => tick.absoluteIndex === position.tick),
    );

    if (!tickPage) {
      throw new Error('Tick page was not found.');
    }

    let connection = this.connection;
    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let { ata, instruction } = await ensureAssociatedTokenAccountInstruction({
      connection,
      owner: this.walletAddress,
      mint: position.pool.mint,
      tokenProgram: position.pool.tokenProgram,
    });
    let vaultAuthority = deriveVaultAuthorityPda(
      this.settings.programId,
      position.pool.address,
    )[0];
    let transaction = buildWithdrawFromTickTransaction({
      assetPool: position.pool.address,
      blockhash: latestBlockhash.blockhash,
      lpPosition: position.address,
      mint: position.pool.mint,
      owner: this.walletAddress,
      programId: this.settings.programId,
      protocol: this.protocol.address,
      sharesToBurn,
      tick: position.tick,
      tickPage: tickPage.address,
      tokenProgram: position.pool.tokenProgram,
      userTokenAccount: ata,
      vault: position.pool.vault,
      vaultAuthority,
    });

    if (instruction) {
      transaction.instructions.unshift(instruction);
    }

    let signature = await signAndSendTransaction({
      connection,
      provider,
      transaction,
    });

    this.lastSignature = signature;
    await this.refreshAll();
    return signature;
  }

  async wrapSolToWsol(amountInput) {
    let pool = this.wsolAssetPools[0] ?? null;

    if (!pool) {
      throw new Error('WSOL Asset Pool was not found.');
    }

    if (!this.walletAddress) {
      throw new Error('Connect a wallet before wrapping SOL.');
    }

    let provider = getPhantomProvider();

    if (!provider) {
      throw new Error('Phantom wallet was not detected.');
    }

    let amount = parseTokenAmountToBaseUnits(amountInput, pool.decimals);

    if (amount <= 0n) {
      throw new Error('Wrap amount must be greater than zero.');
    }

    if (BigInt(this.walletBalanceLamports ?? '0') < amount) {
      throw new Error('Not enough SOL to wrap into WSOL.');
    }

    let connection = this.connection;
    let wrapData = await buildWrapSolInstructions({
      connection,
      owner: this.walletAddress,
      lamports: amount,
    });
    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let transaction = new Transaction({
      feePayer: parsePublicKey(this.walletAddress),
      recentBlockhash: latestBlockhash.blockhash,
    });

    transaction.add(...wrapData.instructions);

    let signature = await signAndSendTransaction({
      connection,
      provider,
      transaction,
    });

    this.lastSignature = signature;
    await this.refreshAll();
    return signature;
  }

  async unwrapAllWsol() {
    let pool = this.wsolAssetPools[0] ?? null;

    if (!pool) {
      throw new Error('WSOL Asset Pool was not found.');
    }

    if (!this.walletAddress) {
      throw new Error('Connect a wallet before unwrapping WSOL.');
    }

    let provider = getPhantomProvider();

    if (!provider) {
      throw new Error('Phantom wallet was not detected.');
    }

    let ata = getAssociatedTokenAddressSync(
      parsePublicKey(pool.mint),
      parsePublicKey(this.walletAddress),
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    let connection = this.connection;
    let existing = await connection.getAccountInfo(ata);

    if (!existing) {
      throw new Error('WSOL token account was not found for this wallet.');
    }

    if (
      BigInt(this.walletQuoteBalanceForMint(pool.mint)?.amount ?? '0') <= 0n
    ) {
      throw new Error('There is no WSOL balance to unwrap.');
    }

    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let transaction = new Transaction({
      feePayer: parsePublicKey(this.walletAddress),
      recentBlockhash: latestBlockhash.blockhash,
    });

    transaction.add(
      buildUnwrapWsolInstruction({
        owner: this.walletAddress,
        ata,
      }),
    );

    let signature = await signAndSendTransaction({
      connection,
      provider,
      transaction,
    });

    this.lastSignature = signature;
    await this.refreshAll();
    return signature;
  }

  walletQuoteBalanceForMint(mint) {
    return (
      this.walletTokenBalances.find((balance) => balance.mint === mint) ?? null
    );
  }

  buildPumpFunBorrowPlan({
    requestedQuoteAmountInput,
    extraUserQuoteAmountInput,
    termDaysInput,
  }) {
    let strategy = this.pumpFunStrategy;
    let pool = this.borrowableWsolPool;

    if (!strategy?.isEnabled) {
      throw new Error('pump.fun strategy is not enabled on this RPC.');
    }

    if (!pool) {
      throw new Error('No borrow-enabled WSOL Asset Pool was found.');
    }

    let requestedQuoteAmount = parseTokenAmountToBaseUnits(
      requestedQuoteAmountInput,
      pool.decimals,
    );
    let extraUserQuoteAmount = parseTokenAmountToBaseUnits(
      extraUserQuoteAmountInput || '0',
      pool.decimals,
    );
    let termDays = Number(termDaysInput ?? 0);

    if (!Number.isFinite(termDays) || termDays <= 0) {
      throw new Error('Term must be greater than zero days.');
    }

    let plan = buildRoutePlan({
      pool,
      strategy,
      requestedQuoteAmount,
      extraUserQuoteAmount,
      termSec: BigInt(Math.round(termDays * 24 * 60 * 60)),
      protocolFeeBps: 0,
      platformCostQuote: 0n,
    });

    if (BigInt(plan.fundedQuoteAmount) < BigInt(plan.requestedQuoteAmount)) {
      throw new Error(
        'Not enough LP liquidity to fully satisfy this requested quote amount.',
      );
    }

    let requiredQuoteBufferAmount = this.calculateRequiredQuoteBufferAmount(
      strategy,
      plan.fundedQuoteAmount,
    );

    return {
      ...plan,
      loanId: generateLoanId().toString(),
      requestedQuoteAmountFormatted: formatTokenAmount(
        plan.requestedQuoteAmount,
        pool.decimals,
      ),
      requestedButUnfundedQuoteAmountFormatted: formatTokenAmount(
        BigInt(plan.requestedQuoteAmount) - BigInt(plan.fundedQuoteAmount),
        pool.decimals,
      ),
      fundedQuoteAmountFormatted: formatTokenAmount(
        plan.fundedQuoteAmount,
        pool.decimals,
      ),
      extraUserQuoteAmountFormatted: formatTokenAmount(
        plan.extraUserQuoteAmount,
        pool.decimals,
      ),
      totalUpfrontInterestPaidFormatted: formatTokenAmount(
        plan.totalUpfrontInterestPaid,
        pool.decimals,
      ),
      totalProtocolFeePaidFormatted: formatTokenAmount(
        plan.totalProtocolFeePaid,
        pool.decimals,
      ),
      totalPlatformCostPaidFormatted: formatTokenAmount(
        plan.totalPlatformCostPaid,
        pool.decimals,
      ),
      requiredQuoteBufferAmount: requiredQuoteBufferAmount.toString(),
      requiredQuoteBufferAmountFormatted: formatTokenAmount(
        requiredQuoteBufferAmount,
        pool.decimals,
      ),
      pool,
      strategy,
    };
  }

  calculateRequiredQuoteBufferAmount(strategy, fundedQuoteAmount) {
    let funded = BigInt(fundedQuoteAmount ?? 0);
    let percentBuffer =
      (funded * BigInt(strategy?.extraQuoteCollateralBps ?? 0)) / 10000n;
    let minBuffer = BigInt(strategy?.minQuoteBufferAmount ?? 0);
    let fixedMigrationCost = BigInt(strategy?.fixedMigrationCostQuote ?? 0);
    let baseBuffer = percentBuffer > minBuffer ? percentBuffer : minBuffer;

    return baseBuffer + fixedMigrationCost;
  }

  async openPumpFunLoan(planDraft) {
    validatePlanTotals(planDraft);
    let pool = this.borrowableWsolPool;
    let strategy = this.pumpFunStrategy;

    if (!pool || !strategy) {
      throw new Error('pump.fun WSOL configuration is unavailable.');
    }

    if (!this.walletAddress) {
      throw new Error('Connect a wallet before opening a loan.');
    }

    let provider = getPhantomProvider();

    if (!provider) {
      throw new Error('Phantom wallet was not detected.');
    }

    let routePlanHash = await buildRoutePlanHash(planDraft);
    let connection = this.connection;
    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let requiredQuoteBufferAmount = this.calculateRequiredQuoteBufferAmount(
      strategy,
      planDraft.fundedQuoteAmount,
    );
    let upfrontWalletNeed =
      requiredQuoteBufferAmount +
      BigInt(planDraft.totalUpfrontInterestPaid) +
      BigInt(planDraft.totalProtocolFeePaid) +
      BigInt(planDraft.totalPlatformCostPaid);
    let walletWsolBalance = BigInt(
      this.walletQuoteBalanceForMint(pool.mint)?.amount ?? '0',
    );

    if (walletWsolBalance < upfrontWalletNeed) {
      throw new Error(
        'Not enough WSOL for upfront payments and buffer. Wrap SOL to WSOL in Profile before opening the loan.',
      );
    }
    let { ata } = await ensureAssociatedTokenAccountInstruction({
      connection,
      owner: this.walletAddress,
      mint: pool.mint,
      tokenProgram: pool.tokenProgram ?? TOKEN_PROGRAM_ID,
    });
    let loanPosition = deriveLoanPositionPda(
      this.settings.programId,
      this.walletAddress,
      planDraft.loanId,
    )[0];
    let loanVaultAuthority = deriveLoanVaultAuthorityPda(
      this.settings.programId,
      loanPosition,
    )[0];
    let loanQuoteVault = deriveLoanQuoteVaultPda(
      this.settings.programId,
      loanPosition,
    )[0];
    let loanQuoteBufferVault = deriveLoanQuoteBufferVaultPda(
      this.settings.programId,
      loanPosition,
    )[0];
    let strategyConfig = deriveStrategyConfigPda(
      this.settings.programId,
      strategy.mode,
    )[0];
    let protocolQuoteTreasuryAuthority =
      deriveProtocolQuoteTreasuryAuthorityPda(
        this.settings.programId,
        pool.address,
      )[0];
    let protocolQuoteTreasuryVault = deriveProtocolQuoteTreasuryVaultPda(
      this.settings.programId,
      pool.address,
    )[0];
    let transaction = buildOpenLoanTransaction({
      blockhash: latestBlockhash.blockhash,
      loanId: planDraft.loanId,
      routePlanHash,
      plannedSliceCount: planDraft.plannedSliceCount,
      requestedQuoteAmount: planDraft.requestedQuoteAmount,
      fundedQuoteAmount: planDraft.fundedQuoteAmount,
      extraUserQuoteAmount: planDraft.extraUserQuoteAmount,
      termSec: planDraft.termSec,
      totalUpfrontInterestPaid: planDraft.totalUpfrontInterestPaid,
      totalProtocolFeePaid: planDraft.totalProtocolFeePaid,
      totalPlatformCostPaid: planDraft.totalPlatformCostPaid,
      programId: this.settings.programId,
      protocol: this.protocol.address,
      quoteAssetPool: pool.address,
      strategyConfig,
      owner: this.walletAddress,
      quoteMint: pool.mint,
      userQuoteTokenAccount: ata,
      loanPosition,
      loanVaultAuthority,
      loanQuoteVault,
      loanQuoteBufferVault,
      protocolQuoteTreasuryAuthority,
      protocolQuoteTreasuryVault,
      tokenProgram: pool.tokenProgram ?? TOKEN_PROGRAM_ID,
    });

    let signature = await signAndSendTransaction({
      connection,
      provider,
      transaction,
    });

    this.lastSignature = signature;
    this.persistLoanId(loanPosition.toBase58(), planDraft.loanId);
    this.persistLoanPlan(loanPosition.toBase58(), planDraft);
    await this.refreshAll();

    return {
      signature,
      loanAddress: loanPosition.toBase58(),
      routePlanHash: [...routePlanHash]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
      requiredQuoteBufferAmount: requiredQuoteBufferAmount.toString(),
    };
  }

  async fundPumpFunLoan({ loanAddress, fills }) {
    let loan = this.findLoan(loanAddress);

    if (!loan) {
      throw new Error('Loan was not found.');
    }

    if (loan.status !== LOAN_STATUS_OPENED) {
      throw new Error('Only OPENED loans can be funded from ticks.');
    }

    let provider = getPhantomProvider();

    if (!provider) {
      throw new Error('Phantom wallet was not detected.');
    }

    let pool = loan.pool ?? this.findPool(loan.quoteAssetPool);
    let loanId = this.loanIdForAddress(loan.address);
    let storedPlan = this.loanPlanForAddress(loan.address);

    if (!loanId) {
      throw new Error('Loan id for this loan is not available locally.');
    }

    if (!storedPlan?.fills?.length && !fills?.length) {
      throw new Error('Borrow plan for this loan is not available locally.');
    }
    let connection = this.connection;
    let normalizedFills = [...(fills?.length ? fills : storedPlan.fills)]
      .map((fill) => ({
        tick: Number(fill.tick),
        principalAmount: BigInt(fill.principalAmount),
        upfrontInterestAmount: BigInt(fill.upfrontInterestAmount),
        protocolFeeAmount: BigInt(fill.protocolFeeAmount),
      }))
      .sort((left, right) => left.tick - right.tick)
      .reduce((aggregated, fill) => {
        let previousFill = aggregated[aggregated.length - 1];

        if (previousFill?.tick === fill.tick) {
          previousFill.principalAmount += fill.principalAmount;
          previousFill.upfrontInterestAmount += fill.upfrontInterestAmount;
          previousFill.protocolFeeAmount += fill.protocolFeeAmount;
        } else {
          aggregated.push({ ...fill });
        }

        return aggregated;
      }, []);

    for (let fill of normalizedFills) {
      let borrowSlice = deriveBorrowSlicePda(
        this.settings.programId,
        loan.address,
        fill.tick,
      )[0];
      let existing = await connection.getAccountInfo(borrowSlice);

      if (existing) {
        continue;
      }

      let latestBlockhash = await connection.getLatestBlockhash('confirmed');
      let initializeTx = buildInitializeBorrowSliceTransaction({
        blockhash: latestBlockhash.blockhash,
        loanId,
        tick: fill.tick,
        programId: this.settings.programId,
        protocol: this.protocol.address,
        quoteAssetPool: pool.address,
        loanPosition: loan.address,
        owner: this.walletAddress,
        borrowSlicePosition: borrowSlice,
      });

      await signAndSendTransaction({
        connection,
        provider,
        transaction: initializeTx,
      });
    }

    let remainingAccounts = normalizedFills.flatMap((fill) => [
      {
        pubkey: deriveTickPagePda(
          this.settings.programId,
          pool.address,
          Math.floor(fill.tick / 32),
        )[0],
        isWritable: true,
      },
      {
        pubkey: deriveBorrowSlicePda(
          this.settings.programId,
          loan.address,
          fill.tick,
        )[0],
        isWritable: true,
      },
    ]);
    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let transaction = buildFundLoanFromTicksTransaction({
      blockhash: latestBlockhash.blockhash,
      fills: normalizedFills,
      programId: this.settings.programId,
      protocol: this.protocol.address,
      quoteAssetPool: pool.address,
      owner: this.walletAddress,
      quoteMint: pool.mint,
      vaultAuthority: deriveVaultAuthorityPda(
        this.settings.programId,
        pool.address,
      )[0],
      vault: pool.vault,
      loanPosition: loan.address,
      loanQuoteVault: loan.loanQuoteVault,
      tokenProgram: pool.tokenProgram ?? TOKEN_PROGRAM_ID,
      remainingAccounts,
    });
    let signature = await signAndSendTransaction({
      connection,
      provider,
      transaction,
    });

    this.lastSignature = signature;
    await this.refreshAll();

    return signature;
  }

  async executePumpFunLaunch({
    loanAddress,
    name,
    symbol,
    uri,
    loanQuoteSpendAmountInput,
    extraUserQuoteSpendAmountInput = '0',
    collateralMinBaseOutInput = '1',
    immediateUserMinBaseOutInput = '0',
  }) {
    let loan = this.findLoan(loanAddress);
    let config = this.pumpFunEnvConfig;
    let normalizedName = String(name ?? '').trim();
    let normalizedSymbol = String(symbol ?? '').trim();
    let normalizedUri = String(uri ?? '').trim();

    if (!loan) {
      throw new Error('Loan was not found.');
    }

    if (loan.status !== LOAN_STATUS_FUNDED) {
      throw new Error('Only FUNDED loans can be executed.');
    }

    if (!config?.programId) {
      throw new Error('pump.fun runtime config is missing for this network.');
    }

    if (!normalizedName || !normalizedSymbol || !normalizedUri) {
      throw new Error('Name, symbol, and URI are required for Execute launch.');
    }

    let resolvedGlobal = this.resolvePumpFunRuntimeAccount(
      config.global,
      config.programId,
    );
    let resolvedMintAuthority = this.resolvePumpFunRuntimeAccount(
      config.mintAuthority,
      config.programId,
    );
    let resolvedEventAuthority = this.resolvePumpFunRuntimeAccount(
      config.eventAuthority,
      config.programId,
    );
    let resolvedGlobalParams = this.resolvePumpFunRuntimeAccount(
      config.globalParams,
      config.programId,
      config.mayhemProgramId,
    );
    let resolvedSolVault = this.resolvePumpFunRuntimeAccount(
      config.solVault,
      config.programId,
      config.mayhemProgramId,
    );

    if (
      !resolvedGlobal ||
      !resolvedMintAuthority ||
      !resolvedEventAuthority ||
      !resolvedGlobalParams ||
      !resolvedSolVault ||
      !config.mayhemProgramId ||
      !config.feeProgramId ||
      !config.feeConfigAuthority
    ) {
      throw new Error(
        'pump.fun runtime config is incomplete for this network.',
      );
    }

    let provider = getPhantomProvider();

    if (!provider) {
      throw new Error('Phantom wallet was not detected.');
    }

    let pool = loan.pool ?? this.findPool(loan.quoteAssetPool);
    let connection = this.connection;
    let loanQuoteSpendAmount = parseTokenAmountToBaseUnits(
      loanQuoteSpendAmountInput,
      pool.decimals,
    );
    let extraUserQuoteSpendAmount = parseTokenAmountToBaseUnits(
      extraUserQuoteSpendAmountInput || '0',
      pool.decimals,
    );
    let collateralMinBaseOut = BigInt(collateralMinBaseOutInput || '0');
    let immediateUserMinBaseOut = BigInt(immediateUserMinBaseOutInput || '0');
    let currentWsolBalance = BigInt(
      this.walletQuoteBalanceForMint(pool.mint)?.amount ?? '0',
    );

    if (currentWsolBalance < extraUserQuoteSpendAmount) {
      throw new Error('Not enough WSOL for extra buy.');
    }
    let { ata } = await ensureAssociatedTokenAccountInstruction({
      connection,
      owner: this.walletAddress,
      mint: pool.mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    });
    let baseMint = generateMintKeypair();
    let loanExecutionWallet = deriveLoanExecutionWalletPda(
      this.settings.programId,
      loan.address,
    )[0];
    let pumpFunBondingCurve = deriveBondingCurvePda(
      config.programId,
      baseMint.publicKey,
      config.bondingCurveSeed ?? 'bonding-curve',
    )[0];
    let pumpFunBondingCurveV2 = deriveBondingCurveV2Pda(
      config.programId,
      baseMint.publicKey,
      config.bondingCurveV2Seed ?? 'bonding-curve-v2',
    )[0];
    let pumpFunAssociatedBondingCurve = getAssociatedTokenAddressSync(
      baseMint.publicKey,
      pumpFunBondingCurve,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    let pumpFunLoanTemporaryWsolVault = deriveTempWsolVaultPda(
      this.settings.programId,
      loan.address,
      'loan',
    )[0];
    let pumpFunMayhemState = deriveMayhemStatePda(
      config.mayhemProgramId,
      baseMint.publicKey,
    )[0];
    let pumpFunMayhemTokenVault = getAssociatedTokenAddressSync(
      baseMint.publicKey,
      parsePublicKey(resolvedSolVault),
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    let loanCollateralVault = getAssociatedTokenAddressSync(
      baseMint.publicKey,
      loanExecutionWallet,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    let userBaseTokenAccount = getAssociatedTokenAddressSync(
      baseMint.publicKey,
      parsePublicKey(this.walletAddress),
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    let feeRecipient = this.resolvePumpFunDynamicAccount(config.feeRecipient, {
      owner: this.walletAddress,
      loanExecutionWallet,
      pumpFunProgramId: config.programId,
    });
    let creatorVault = this.resolvePumpFunDynamicAccount(config.creatorVault, {
      owner: this.walletAddress,
      loanExecutionWallet,
      pumpFunProgramId: config.programId,
    });

    if (!feeRecipient || !creatorVault) {
      throw new Error(
        'pump.fun fee recipient / creator vault config is incomplete.',
      );
    }
    let globalVolumeAccumulator = deriveGlobalVolumeAccumulatorPda(
      config.programId,
    )[0];
    let executionWalletVolumeAccumulator = deriveUserVolumeAccumulatorPda(
      config.programId,
      loanExecutionWallet,
    )[0];
    let ownerVolumeAccumulator = deriveUserVolumeAccumulatorPda(
      config.programId,
      this.walletAddress,
    )[0];
    let feeConfig = deriveFeeConfigPda(
      config.feeProgramId,
      config.feeConfigAuthority,
    )[0];
    let remainingAccounts = [
      { pubkey: globalVolumeAccumulator, isWritable: false },
      { pubkey: executionWalletVolumeAccumulator, isWritable: true },
      { pubkey: ownerVolumeAccumulator, isWritable: true },
      { pubkey: feeConfig, isWritable: false },
      { pubkey: config.feeProgramId, isWritable: false },
      { pubkey: pumpFunBondingCurveV2, isWritable: true },
    ];
    let extraQuoteAccount = await getAccount(connection, ata, 'confirmed');

    console.log('userExtraQuoteTokenAccount', ata.toBase58());
    console.log('userBaseTokenAccount', userBaseTokenAccount.toBase58());
    console.log('loanCollateralVault', loanCollateralVault.toBase58());
    console.log(
      'pumpFunExecutionWalletVolumeAccumulator',
      executionWalletVolumeAccumulator.toBase58(),
    );
    console.log(
      'pumpFunOwnerVolumeAccumulator',
      ownerVolumeAccumulator.toBase58(),
    );
    console.log(
      'remainingAccounts',
      remainingAccounts.map((account) =>
        parsePublicKey(account.pubkey).toBase58(),
      ),
    );
    console.log('user extra WSOL balance', extraQuoteAccount.amount.toString());
    console.log(
      'extraUserQuoteSpendAmount',
      extraUserQuoteSpendAmount.toString(),
    );

    let feeRecipientCandidates = [
      ...(config.feeRecipientCandidates ?? []),
      feeRecipient,
    ].filter((value, index, array) => value && array.indexOf(value) === index);
    let signature = null;
    let lastError = null;

    for (let candidate of feeRecipientCandidates) {
      try {
        let latestBlockhash = await connection.getLatestBlockhash('confirmed');
        let transaction = buildExecuteLaunchPumpFunTransaction({
          blockhash: latestBlockhash.blockhash,
          useCreateV2: config.useCreateV2 ?? true,
          name: normalizedName,
          symbol: normalizedSymbol,
          uri: normalizedUri,
          loanQuoteSpendAmount,
          extraUserQuoteSpendAmount,
          collateralMinBaseOut,
          immediateUserMinBaseOut,
          programId: this.settings.programId,
          protocol: this.protocol.address,
          quoteAssetPool: pool.address,
          owner: this.walletAddress,
          quoteMint: pool.mint,
          baseMint: baseMint.publicKey,
          loanPosition: loan.address,
          loanVaultAuthority: deriveLoanVaultAuthorityPda(
            this.settings.programId,
            loan.address,
          )[0],
          loanExecutionWallet,
          loanQuoteVault: loan.loanQuoteVault,
          userExtraQuoteTokenAccount: ata,
          pumpFunProgram: config.programId,
          pumpFunGlobal: resolvedGlobal,
          pumpFunBondingCurve,
          pumpFunBondingCurveV2,
          pumpFunAssociatedBondingCurve,
          pumpFunMayhemProgram: config.mayhemProgramId,
          pumpFunGlobalParams: resolvedGlobalParams,
          pumpFunSolVault: resolvedSolVault,
          pumpFunMayhemState,
          pumpFunMayhemTokenVault,
          pumpFunLoanTemporaryWsolVault,
          pumpFunMintAuthority: resolvedMintAuthority,
          pumpFunEventAuthority: resolvedEventAuthority,
          pumpFunFeeRecipient: candidate,
          pumpFunCreatorVault: creatorVault,
          loanCollateralVault,
          userBaseTokenAccount,
          quoteTokenProgram: TOKEN_PROGRAM_ID,
          baseTokenProgram: TOKEN_2022_PROGRAM_ID,
          remainingAccounts,
        });
        let versionedTransaction = buildVersionedTransaction({
          payer: this.walletAddress,
          blockhash: latestBlockhash.blockhash,
          instructions: transaction.instructions,
          lookupTables: [
            await this.createFreshLookupTableForInstructions({
              instructions: transaction.instructions,
              connection,
              provider,
            }),
          ],
        });

        versionedTransaction.sign([baseMint]);

        signature = await signAndSendTransaction({
          connection,
          provider,
          transaction: versionedTransaction,
          simulateBeforeSend: true,
        });
        break;
      } catch (error) {
        lastError = error;
        let message = String(error?.message ?? error);

        if (!message.includes('NotAuthorized')) {
          throw error;
        }
      }
    }

    if (!signature) {
      throw (
        lastError ??
        new Error('Execute launch failed for all fee recipient candidates.')
      );
    }

    this.lastSignature = signature;
    await this.refreshAll();

    return {
      signature,
      mintAddress: baseMint.publicKey.toBase58(),
    };
  }

  resolvePumpFunRuntimeAccount(spec, programId, mayhemProgramId = null) {
    if (!spec) {
      return null;
    }

    if (spec.type === 'fixed') {
      return spec.address;
    }

    if (spec.type === 'pda') {
      let runtimeProgramId =
        spec.program === 'mayhem' ? (mayhemProgramId ?? programId) : programId;

      return deriveRuntimePda(runtimeProgramId, spec.seeds);
    }

    return null;
  }

  resolvePumpFunDynamicAccount(
    spec,
    { owner, loanExecutionWallet, pumpFunProgramId },
  ) {
    if (!spec) {
      return null;
    }

    if (spec.type === 'fixed') {
      return spec.address;
    }

    if (spec.type === 'owner') {
      return owner;
    }

    if (spec.type === 'loanExecutionWallet') {
      return loanExecutionWallet;
    }

    if (spec.type === 'creatorVaultPda') {
      return deriveCreatorVaultPda(pumpFunProgramId, owner)[0].toBase58();
    }

    return null;
  }
}

function deriveRuntimePda(programId, seeds) {
  let normalizedSeeds = (seeds ?? []).map((seed) =>
    typeof seed === 'string' ? new TextEncoder().encode(seed) : seed,
  );

  return PublicKey.findProgramAddressSync(
    normalizedSeeds,
    parsePublicKey(programId),
  )[0].toBase58();
}
