import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

import {
  BLOCKCHAIN_OPTIONS,
  DEFAULT_PROGRAM_ID,
  MODE_LABELS,
  NETWORK_PRESETS,
  SETTINGS_STORAGE_KEY,
  SOLANA_CHAIN_KEY,
  STRATEGY_SLUG_TO_MODE,
  buildDepositToTickTransaction,
  buildWithdrawFromTickTransaction,
  deriveLpPositionPda,
  deriveProtocolPda,
  deriveVaultAuthorityPda,
  ensureAssociatedTokenAccountInstruction,
  fetchAllAssetPools,
  fetchAllExecutionStrategyConfigs,
  fetchAllTickPages,
  fetchMintInfo,
  fetchProtocolAccount,
  fetchWalletLpPositions,
  fetchWalletTokenBalances,
  formatTokenAmount,
  getPhantomProvider,
  makeConnection,
  parsePublicKey,
  parseTokenAmountToBaseUnits,
  shortAddress,
  signAndSendTransaction,
  strategyDescription,
} from 'moono/utils/moono-solana';

const DEFAULT_SETTINGS = {
  blockchain: SOLANA_CHAIN_KEY,
  networkPreset: 'localnet',
  rpcEndpoint: NETWORK_PRESETS.localnet.rpcEndpoint,
  programId: DEFAULT_PROGRAM_ID,
};
const WALLET_AUTOCONNECT_STORAGE_KEY = 'moono-wallet-autoconnect-v1';

export default class MoonoStateService extends Service {
  refreshPromise = null;

  @tracked settings = { ...DEFAULT_SETTINGS };
  @tracked settingsError = null;

  @tracked phantomAvailable = false;
  @tracked walletBusy = false;
  @tracked walletError = null;
  @tracked walletAddress = null;
  @tracked walletBalance = null;
  @tracked walletTokenBalances = [];

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

  get borrowStrategyCards() {
    let existing = new Map(
      this.executionStrategies.map((strategy) => [strategy.slug, strategy]),
    );

    return Object.values(MODE_LABELS).map((label) => {
      let strategy = existing.get(label);

      return {
        slug: label,
        label,
        strategy,
        availableLiquidity: this.assetPools
          .filter((pool) => pool.allowBorrows)
          .map((pool) => ({
            address: pool.address,
            mint: pool.mint,
            totalAvailableLiquidityFormatted:
              pool.totalAvailableLiquidityFormatted,
          })),
      };
    });
  }

  get borrowEnabledPools() {
    return this.assetPools.filter((pool) => pool.allowBorrows);
  }

  get assetPoolsByAddress() {
    return new Map(this.assetPools.map((pool) => [pool.address, pool]));
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
    this.walletTokenBalances = [];
    this.lpPositions = [];
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
      let [balanceLamports, tokenBalances, lpPositions] = await Promise.all([
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
      ]);

      this.walletBalance = `${(balanceLamports / 1_000_000_000).toFixed(4)} SOL`;
      this.walletTokenBalances = tokenBalances;
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

  async depositToTick(poolAddress, tickIndex, amountInput) {
    let pool = this.findPool(poolAddress);

    if (!pool) {
      throw new Error('Asset Pool was not found.');
    }

    if (!this.walletAddress) {
      throw new Error('Connect a wallet before depositing.');
    }

    let tickPage = pool.tickPages.find((page) =>
      page.ticks.some((tick) => tick.absoluteIndex === tickIndex),
    );

    if (!tickPage) {
      throw new Error('Tick page was not found.');
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

    let latestBlockhash = await connection.getLatestBlockhash('confirmed');
    let { ata, instruction } = await ensureAssociatedTokenAccountInstruction({
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
      tickPage: tickPage.address,
      tokenProgram: pool.tokenProgram,
      userTokenAccount: ata,
      vault: pool.vault,
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
}
