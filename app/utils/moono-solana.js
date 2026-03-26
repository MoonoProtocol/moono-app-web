import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

export const DEFAULT_PROGRAM_ID = 'moonoL26kRC8S49yPuuopKhbNhvgf2h4Dva91noD8rN';
export const SETTINGS_STORAGE_KEY = 'moono-user-settings-v1';
export const PAGE_SIZE = 32;
export const SOLANA_CHAIN_KEY = 'solana';
export const MODE_PUMP_FUN = 1;
export const LOAN_STATUS_OPENED = 1;
export const LOAN_STATUS_FUNDED = 2;
export const LOAN_STATUS_EXECUTED = 3;
export const MODE_LABELS = {
  1: 'pump.fun',
  2: 'meteora',
  3: 'pump.swap',
};
export const STRATEGY_SLUG_TO_MODE = {
  'pump.fun': 1,
  meteora: 2,
  'pump.swap': 3,
};
export const NETWORK_PRESETS = {
  mainnet: {
    label: 'Mainnet',
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  },
  devnet: {
    label: 'Devnet',
    rpcEndpoint: 'https://api.devnet.solana.com',
  },
  testnet: {
    label: 'Testnet',
    rpcEndpoint: 'https://api.testnet.solana.com',
  },
  localnet: {
    label: 'Localnet',
    rpcEndpoint: 'http://127.0.0.1:8899',
  },
  custom: {
    label: 'Custom RPC',
    rpcEndpoint: '',
  },
};
export const BLOCKCHAIN_OPTIONS = [
  {
    key: SOLANA_CHAIN_KEY,
    label: 'Solana',
  },
];
export const KNOWN_MINT_LABELS = {
  So11111111111111111111111111111111111111112: 'WSOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYDutZJ3rrodpAtxEvsCzor: 'USDT',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK',
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'USDC',
};
export const PUMP_FUN_ENV_CONFIG = {
  local: {
    label: 'Local mock pump.fun',
    useCreateV2: true,
    programId: 'pump5khDuXvghyrSQATnojua6ydquBG5fN7FibwHF4e',
    feeProgramId: 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
    feeConfigAuthority: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    mayhemProgramId: 'pump5khDuXvghyrSQATnojua6ydquBG5fN7FibwHF4e',
    global: { type: 'pda', seeds: ['global'] },
    mintAuthority: { type: 'pda', seeds: ['mint-authority'] },
    eventAuthority: {
      type: 'fixed',
      address: SystemProgram.programId.toBase58(),
    },
    feeRecipient: { type: 'owner' },
    feeRecipientCandidates: [],
    creatorVault: { type: 'loanExecutionWallet' },
    globalParams: { type: 'pda', seeds: ['global-params'], program: 'mayhem' },
    solVault: { type: 'pda', seeds: ['sol-vault'], program: 'mayhem' },
    bondingCurveSeed: 'bonding-curve',
    bondingCurveV2Seed: 'bonding-curve-v2',
  },
  devnet: {
    label: 'Pump.fun devnet',
    useCreateV2: true,
    programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    feeProgramId: 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
    feeConfigAuthority: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    mayhemProgramId: 'MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e',
    global: {
      type: 'fixed',
      address: '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf',
    },
    mintAuthority: { type: 'pda', seeds: ['mint-authority'] },
    eventAuthority: { type: 'pda', seeds: ['__event_authority'] },
    feeRecipient: {
      type: 'fixed',
      address: '68yFSZxzLWJXkxxRGydZ63C6mHx1NLEDWmwN9Lb5yySg',
    },
    feeRecipientCandidates: [
      '68yFSZxzLWJXkxxRGydZ63C6mHx1NLEDWmwN9Lb5yySg',
      '6QgPshH1egekJ2TURfakiiApDdv98qfRuRe7RectX8xs',
      '78i5hpHxbtmosSJdfJ74WzwdUr3eKWg9RbCPpBeAF78t',
      '8RMFYhsVsfdGCuWPFLxMCbSpSesiofabDdNorGqFrBNe',
      '9GDepfBcjJMvNgmijXWVWa97Am7VZYCqXx7kJV44E9ij',
      '9ppkS5madL2uXozoEnMnZi5bKDq9jgdKkSavjWTS5NfW',
      'DDMCfwbcaNYTeMk1ca8tr8BQKFaUfFCWFwBJq8JcnyCw',
      'DRDBsRMst21CJUhwD16pncgiXnBrFaRAPvA2G6SUQceE',
      'GesfTA3X2arioaHp8bbKdjG9vJtskViWACZoYvxp4twS',
      '4budycTjhs9fD6xw62VBducVTNgMgJJ5BgtKq7mAZwn6',
      '8SBKzEQU4nLSzcwF4a74F2iaUDQyTfjGndn6qUWBnrpR',
      '4UQeTP1T39KZ9Sfxzo3WR5skgsaP6NZa87BAkuazLEKH',
      '8sNeir4QsLsJdYpc9RZacohhK1Y5FLU3nC5LXgYB4aa6',
      'Fh9HmeLNUMVCvejxCtCL2DbYaRyBFVJ5xrWkLnMH6fdk',
      '463MEnMeGyJekNZFQSTUABBEbLnvMTALbT6ZmsxAbAdq',
      '6AUH3WEHucYZyC61hqpqYUWVto5qA5hjHuNQ32GNnNxA',
    ],
    creatorVault: { type: 'creatorVaultPda' },
    globalParams: {
      type: 'fixed',
      address: '13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ',
    },
    solVault: {
      type: 'fixed',
      address: 'BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s',
    },
    bondingCurveSeed: 'bonding-curve',
    bondingCurveV2Seed: 'bonding-curve-v2',
  },
  mainnet: {
    label: 'Pump.fun mainnet',
    useCreateV2: true,
    programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    feeProgramId: 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
    feeConfigAuthority: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    mayhemProgramId: 'MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e',
    global: {
      type: 'fixed',
      address: '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf',
    },
    mintAuthority: { type: 'pda', seeds: ['mint-authority'] },
    eventAuthority: { type: 'pda', seeds: ['__event_authority'] },
    feeRecipient: {
      type: 'fixed',
      address: '68yFSZxzLWJXkxxRGydZ63C6mHx1NLEDWmwN9Lb5yySg',
    },
    feeRecipientCandidates: [
      '68yFSZxzLWJXkxxRGydZ63C6mHx1NLEDWmwN9Lb5yySg',
      '6QgPshH1egekJ2TURfakiiApDdv98qfRuRe7RectX8xs',
      '78i5hpHxbtmosSJdfJ74WzwdUr3eKWg9RbCPpBeAF78t',
      '8RMFYhsVsfdGCuWPFLxMCbSpSesiofabDdNorGqFrBNe',
      '9GDepfBcjJMvNgmijXWVWa97Am7VZYCqXx7kJV44E9ij',
      '9ppkS5madL2uXozoEnMnZi5bKDq9jgdKkSavjWTS5NfW',
      'DDMCfwbcaNYTeMk1ca8tr8BQKFaUfFCWFwBJq8JcnyCw',
      'DRDBsRMst21CJUhwD16pncgiXnBrFaRAPvA2G6SUQceE',
      'GesfTA3X2arioaHp8bbKdjG9vJtskViWACZoYvxp4twS',
      '4budycTjhs9fD6xw62VBducVTNgMgJJ5BgtKq7mAZwn6',
      '8SBKzEQU4nLSzcwF4a74F2iaUDQyTfjGndn6qUWBnrpR',
      '4UQeTP1T39KZ9Sfxzo3WR5skgsaP6NZa87BAkuazLEKH',
      '8sNeir4QsLsJdYpc9RZacohhK1Y5FLU3nC5LXgYB4aa6',
      'Fh9HmeLNUMVCvejxCtCL2DbYaRyBFVJ5xrWkLnMH6fdk',
      '463MEnMeGyJekNZFQSTUABBEbLnvMTALbT6ZmsxAbAdq',
      '6AUH3WEHucYZyC61hqpqYUWVto5qA5hjHuNQ32GNnNxA',
    ],
    creatorVault: { type: 'creatorVaultPda' },
    globalParams: {
      type: 'fixed',
      address: '13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ',
    },
    solVault: {
      type: 'fixed',
      address: 'BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s',
    },
    bondingCurveSeed: 'bonding-curve',
    bondingCurveV2Seed: 'bonding-curve-v2',
  },
};

const encoder = new TextEncoder();

const PROTOCOL_SEED = encoder.encode('protocol');
const ASSET_POOL_SEED = encoder.encode('asset_pool');
const VAULT_AUTHORITY_SEED = encoder.encode('vault_authority');
const VAULT_SEED = encoder.encode('vault');
const QUOTE_TREASURY_AUTHORITY_SEED = encoder.encode('quote_treasury_auth');
const QUOTE_TREASURY_VAULT_SEED = encoder.encode('quote_treasury_vault');
const STRATEGY_CONFIG_SEED = encoder.encode('strategy_config');
const TICK_PAGE_SEED = encoder.encode('tick_page');
const LP_POSITION_SEED = encoder.encode('lp_position');
const LOAN_POSITION_SEED = encoder.encode('loan_position');
const LOAN_VAULT_AUTHORITY_SEED = encoder.encode('loan_vault_authority');
const LOAN_QUOTE_VAULT_SEED = encoder.encode('loan_quote_vault');
const LOAN_QUOTE_BUFFER_VAULT_SEED = encoder.encode('loan_quote_buffer_vault');
const BORROW_POSITION_SEED = encoder.encode('borrow_position');
const LOAN_EXECUTION_WALLET_SEED = encoder.encode('loan_execution_wallet');
const QUOTE_SINK_AUTHORITY_SEED = encoder.encode('quote_sink_authority');
const TEMP_WSOL_VAULT_SEED = encoder.encode('temp_wsol_vault');
const GLOBAL_VOLUME_ACCUMULATOR_SEED = encoder.encode(
  'global_volume_accumulator',
);
const USER_VOLUME_ACCUMULATOR_SEED = encoder.encode('user_volume_accumulator');
const FEE_CONFIG_SEED = encoder.encode('fee_config');
const INITIALIZE_TICK_PAGE_DISCRIMINATOR = [90, 94, 87, 220, 76, 148, 88, 163];

const PROTOCOL_CONFIG_DISCRIMINATOR = [207, 91, 250, 28, 152, 179, 215, 209];
const ASSET_POOL_DISCRIMINATOR = [81, 48, 2, 215, 147, 255, 152, 112];
const TICK_PAGE_DISCRIMINATOR = [110, 112, 11, 129, 24, 29, 182, 65];
const EXECUTION_STRATEGY_CONFIG_DISCRIMINATOR = [
  86, 201, 71, 63, 13, 238, 70, 230,
];
const LOAN_POSITION_DISCRIMINATOR = [45, 172, 28, 194, 82, 206, 243, 190];
const BORROW_SLICE_POSITION_DISCRIMINATOR = [
  163, 77, 139, 213, 28, 186, 248, 86,
];
const DEPOSIT_TO_TICK_DISCRIMINATOR = [195, 171, 163, 179, 56, 122, 130, 206];
const WITHDRAW_FROM_TICK_DISCRIMINATOR = [245, 145, 186, 211, 99, 83, 248, 95];
const OPEN_LOAN_DISCRIMINATOR = [49, 29, 234, 76, 192, 61, 108, 20];
const INITIALIZE_BORROW_SLICE_POSITION_DISCRIMINATOR = [
  114, 226, 202, 61, 116, 215, 102, 214,
];
const FUND_LOAN_FROM_TICKS_DISCRIMINATOR = [159, 74, 227, 31, 24, 23, 177, 49];
const EXECUTE_LAUNCH_PUMP_FUN_DISCRIMINATOR = [
  182, 53, 23, 92, 232, 17, 202, 57,
];

export function makeConnection(rpcEndpoint) {
  return new Connection(rpcEndpoint, 'confirmed');
}

export function parsePublicKey(value) {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

export function shortAddress(value, size = 4) {
  if (!value || value.length <= size * 2 + 3) {
    return value ?? 'not set';
  }

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function getPhantomProvider() {
  if (typeof window === 'undefined') {
    return null;
  }

  let provider = window.phantom?.solana ?? window.solana;

  return provider?.isPhantom ? provider : null;
}

export function formatTokenAmount(
  value,
  decimals = 0,
  { preserveTrailingZeros = false } = {},
) {
  let amount = BigInt(value ?? 0);
  let scale = 10n ** BigInt(decimals);
  let whole = amount / scale;
  let fraction = amount % scale;

  if (decimals === 0) {
    return formatWholeWithCommas(whole);
  }

  let paddedFraction = fraction.toString().padStart(decimals, '0');
  let trimmedFraction = preserveTrailingZeros
    ? paddedFraction
    : paddedFraction.replace(/0+$/, '');

  let formattedWhole = formatWholeWithCommas(whole);

  return trimmedFraction
    ? `${formattedWhole}.${trimmedFraction}`
    : formattedWhole;
}

export function parseTokenAmountToBaseUnits(value, decimals) {
  let normalized = String(value ?? '').trim();

  if (!normalized) {
    throw new Error('Amount is required.');
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Amount must be a positive decimal number.');
  }

  let [wholePart, fractionPart = ''] = normalized.split('.');

  if (fractionPart.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places.`);
  }

  let paddedFraction = fractionPart.padEnd(decimals, '0');
  let combined = `${wholePart}${paddedFraction}`.replace(/^0+(?=\d)/, '');

  return BigInt(combined || '0');
}

export function formatTickPercentage(tick) {
  let tickValue = Number(tick ?? 0);
  return `${(tickValue / 100).toFixed(2)}%`;
}

export function formatMintDisplayLabel(mint) {
  if (!mint) {
    return 'unknown*';
  }

  return KNOWN_MINT_LABELS[mint] ?? `${mint.slice(0, 4)}*`;
}

export function deriveProtocolPda(programId) {
  return PublicKey.findProgramAddressSync(
    [PROTOCOL_SEED],
    ensurePublicKey(programId),
  );
}

export function deriveAssetPoolPda(programId, mint) {
  return PublicKey.findProgramAddressSync(
    [ASSET_POOL_SEED, ensurePublicKey(mint).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveVaultAuthorityPda(programId, assetPool) {
  return PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, ensurePublicKey(assetPool).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveVaultPda(programId, assetPool) {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, ensurePublicKey(assetPool).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveProtocolQuoteTreasuryAuthorityPda(programId, assetPool) {
  return PublicKey.findProgramAddressSync(
    [QUOTE_TREASURY_AUTHORITY_SEED, ensurePublicKey(assetPool).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveProtocolQuoteTreasuryVaultPda(programId, assetPool) {
  return PublicKey.findProgramAddressSync(
    [QUOTE_TREASURY_VAULT_SEED, ensurePublicKey(assetPool).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveStrategyConfigPda(programId, mode) {
  return PublicKey.findProgramAddressSync(
    [STRATEGY_CONFIG_SEED, Uint8Array.from([Number(mode)])],
    ensurePublicKey(programId),
  );
}

export function deriveTickPagePda(programId, assetPool, pageIndex) {
  return PublicKey.findProgramAddressSync(
    [
      TICK_PAGE_SEED,
      ensurePublicKey(assetPool).toBuffer(),
      encodeU32(pageIndex),
    ],
    ensurePublicKey(programId),
  );
}

export function deriveLpPositionPda(programId, owner, assetPool, tick) {
  return PublicKey.findProgramAddressSync(
    [
      LP_POSITION_SEED,
      ensurePublicKey(owner).toBuffer(),
      ensurePublicKey(assetPool).toBuffer(),
      encodeU32(tick),
    ],
    ensurePublicKey(programId),
  );
}

export function deriveLoanPositionPda(programId, owner, loanId) {
  return PublicKey.findProgramAddressSync(
    [LOAN_POSITION_SEED, ensurePublicKey(owner).toBuffer(), encodeU64(loanId)],
    ensurePublicKey(programId),
  );
}

export function deriveLoanVaultAuthorityPda(programId, loanPosition) {
  return PublicKey.findProgramAddressSync(
    [LOAN_VAULT_AUTHORITY_SEED, ensurePublicKey(loanPosition).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveLoanQuoteVaultPda(programId, loanPosition) {
  return PublicKey.findProgramAddressSync(
    [LOAN_QUOTE_VAULT_SEED, ensurePublicKey(loanPosition).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveLoanQuoteBufferVaultPda(programId, loanPosition) {
  return PublicKey.findProgramAddressSync(
    [LOAN_QUOTE_BUFFER_VAULT_SEED, ensurePublicKey(loanPosition).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveBorrowSlicePda(programId, loanPosition, tick) {
  return PublicKey.findProgramAddressSync(
    [
      BORROW_POSITION_SEED,
      ensurePublicKey(loanPosition).toBuffer(),
      encodeU32(tick),
    ],
    ensurePublicKey(programId),
  );
}

export function deriveLoanExecutionWalletPda(programId, loanPosition) {
  return PublicKey.findProgramAddressSync(
    [LOAN_EXECUTION_WALLET_SEED, ensurePublicKey(loanPosition).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveQuoteSinkAuthorityPda(programId, loanPosition) {
  return PublicKey.findProgramAddressSync(
    [QUOTE_SINK_AUTHORITY_SEED, ensurePublicKey(loanPosition).toBuffer()],
    ensurePublicKey(programId),
  );
}

export function deriveTempWsolVaultPda(programId, loanPosition, side) {
  return PublicKey.findProgramAddressSync(
    [
      TEMP_WSOL_VAULT_SEED,
      ensurePublicKey(loanPosition).toBuffer(),
      encoder.encode(side),
    ],
    ensurePublicKey(programId),
  );
}

export function deriveBondingCurvePda(
  pumpFunProgramId,
  mint,
  seed = 'bonding-curve',
) {
  return PublicKey.findProgramAddressSync(
    [encoder.encode(seed), ensurePublicKey(mint).toBuffer()],
    ensurePublicKey(pumpFunProgramId),
  );
}

export function deriveBondingCurveV2Pda(
  pumpFunProgramId,
  mint,
  seed = 'bonding-curve-v2',
) {
  return PublicKey.findProgramAddressSync(
    [encoder.encode(seed), ensurePublicKey(mint).toBuffer()],
    ensurePublicKey(pumpFunProgramId),
  );
}

export function deriveCreatorVaultPda(pumpFunProgramId, creator) {
  return PublicKey.findProgramAddressSync(
    [encoder.encode('creator-vault'), ensurePublicKey(creator).toBuffer()],
    ensurePublicKey(pumpFunProgramId),
  );
}

export function deriveMayhemStatePda(mayhemProgramId, mint) {
  return PublicKey.findProgramAddressSync(
    [encoder.encode('mayhem-state'), ensurePublicKey(mint).toBuffer()],
    ensurePublicKey(mayhemProgramId),
  );
}

export function deriveGlobalVolumeAccumulatorPda(pumpFunProgramId) {
  return PublicKey.findProgramAddressSync(
    [GLOBAL_VOLUME_ACCUMULATOR_SEED],
    ensurePublicKey(pumpFunProgramId),
  );
}

export function deriveUserVolumeAccumulatorPda(pumpFunProgramId, owner) {
  return PublicKey.findProgramAddressSync(
    [USER_VOLUME_ACCUMULATOR_SEED, ensurePublicKey(owner).toBuffer()],
    ensurePublicKey(pumpFunProgramId),
  );
}

export function deriveFeeConfigPda(pumpFeeProgramId, feeConfigAuthority) {
  return PublicKey.findProgramAddressSync(
    [FEE_CONFIG_SEED, ensurePublicKey(feeConfigAuthority).toBuffer()],
    ensurePublicKey(pumpFeeProgramId),
  );
}

export function decodeProtocolConfig(data) {
  let bytes = Uint8Array.from(data);

  assertDiscriminator(bytes, PROTOCOL_CONFIG_DISCRIMINATOR, 'ProtocolConfig');

  return {
    version: bytes[8],
    bump: bytes[9],
    authority: new PublicKey(bytes.slice(10, 42)).toBase58(),
    paused: bytes[42] !== 0,
  };
}

export function decodeAssetPool(data) {
  let bytes = Uint8Array.from(data);

  assertDiscriminator(bytes, ASSET_POOL_DISCRIMINATOR, 'AssetPool');

  return {
    version: bytes[8],
    bump: bytes[9],
    protocol: new PublicKey(bytes.slice(10, 42)).toBase58(),
    mint: new PublicKey(bytes.slice(42, 74)).toBase58(),
    vault: new PublicKey(bytes.slice(74, 106)).toBase58(),
    quoteTreasuryVault: new PublicKey(bytes.slice(106, 138)).toBase58(),
    isEnabled: bytes[138] !== 0,
    allowDeposits: bytes[139] !== 0,
    allowBorrows: bytes[140] !== 0,
    decimals: bytes[141],
  };
}

export function decodeTickPage(data) {
  let bytes = Uint8Array.from(data);

  assertDiscriminator(bytes, TICK_PAGE_DISCRIMINATOR, 'TickPage');

  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let ticks = [];
  let totalAvailableLiquidity = 0n;
  let totalShares = 0n;

  for (let tickIndex = 0; tickIndex < PAGE_SIZE; tickIndex++) {
    let offset = 56 + tickIndex * 64;
    let tickShares = view.getBigUint64(offset, true);
    let availableLiquidity = view.getBigUint64(offset + 8, true);
    let outstandingPrincipal = view.getBigUint64(offset + 16, true);
    let realizedInterestCollected = view.getBigUint64(offset + 24, true);
    let isNonEmpty = availableLiquidity > 0n || tickShares > 0n;

    totalAvailableLiquidity += availableLiquidity;
    totalShares += tickShares;

    ticks.push({
      index: tickIndex,
      absoluteIndex: view.getUint32(48, true) * PAGE_SIZE + tickIndex,
      totalShares: tickShares.toString(),
      availableLiquidity: availableLiquidity.toString(),
      outstandingPrincipal: outstandingPrincipal.toString(),
      realizedInterestCollected: realizedInterestCollected.toString(),
      isNonEmpty,
    });
  }

  return {
    assetPool: new PublicKey(bytes.slice(8, 40)).toBase58(),
    nonEmptyBitmap: view.getBigUint64(40, true).toString(),
    pageIndex: view.getUint32(48, true),
    bump: bytes[52],
    ticks,
    totalAvailableLiquidity: totalAvailableLiquidity.toString(),
    totalShares: totalShares.toString(),
  };
}

export function decodeExecutionStrategyConfig(data) {
  let bytes = Uint8Array.from(data);
  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  assertDiscriminator(
    bytes,
    EXECUTION_STRATEGY_CONFIG_DISCRIMINATOR,
    'ExecutionStrategyConfig',
  );

  return {
    version: bytes[8],
    bump: bytes[9],
    mode: bytes[10],
    slug: modeToSlug(bytes[10]),
    label: MODE_LABELS[bytes[10]] ?? `mode ${bytes[10]}`,
    isEnabled: bytes[11] !== 0,
    extraQuoteCollateralBps: view.getUint16(12, true),
    maxQuoteLossBps: view.getUint16(14, true),
    minQuoteBufferAmount: view.getBigUint64(16, true).toString(),
    fixedMigrationCostQuote: view.getBigUint64(24, true).toString(),
  };
}

export function decodeLpPosition(data) {
  let bytes = Uint8Array.from(data);
  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    owner: new PublicKey(bytes.slice(8, 40)).toBase58(),
    assetPool: new PublicKey(bytes.slice(40, 72)).toBase58(),
    tick: view.getUint32(72, true),
    shares: view.getBigUint64(76, true).toString(),
  };
}

export function decodeBorrowSlicePosition(data) {
  let bytes = Uint8Array.from(data);
  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  assertDiscriminator(
    bytes,
    BORROW_SLICE_POSITION_DISCRIMINATOR,
    'BorrowSlicePosition',
  );

  return {
    owner: new PublicKey(bytes.slice(8, 40)).toBase58(),
    loanPosition: new PublicKey(bytes.slice(40, 72)).toBase58(),
    assetPool: new PublicKey(bytes.slice(72, 104)).toBase58(),
    tick: view.getUint32(104, true),
    principalOutstanding: view.getBigUint64(108, true).toString(),
    upfrontInterestPaid: view.getBigUint64(116, true).toString(),
    protocolFeePaid: view.getBigUint64(124, true).toString(),
  };
}

export function decodeLoanPosition(data) {
  let bytes = Uint8Array.from(data);
  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  assertDiscriminator(bytes, LOAN_POSITION_DISCRIMINATOR, 'LoanPosition');

  return {
    version: bytes[8],
    bump: bytes[9],
    owner: new PublicKey(bytes.slice(10, 42)).toBase58(),
    quoteAssetPool: new PublicKey(bytes.slice(42, 74)).toBase58(),
    strategyConfig: new PublicKey(bytes.slice(74, 106)).toBase58(),
    strategyMode: bytes[106],
    status: bytes[107],
    routePlanHash: toHex(bytes.slice(108, 140)),
    plannedSliceCount: view.getUint16(140, true),
    requestedQuoteAmount: view.getBigUint64(148, true).toString(),
    fundedQuoteAmount: view.getBigUint64(156, true).toString(),
    extraUserQuoteAmount: view.getBigUint64(164, true).toString(),
    plannedTotalPrincipalAmount: view.getBigUint64(172, true).toString(),
    plannedTotalUpfrontInterestAmount: view.getBigUint64(180, true).toString(),
    plannedTotalProtocolFeeAmount: view.getBigUint64(188, true).toString(),
    plannedTotalPlatformCostAmount: view.getBigUint64(196, true).toString(),
    termSec: view.getBigUint64(204, true).toString(),
    createdAt: view.getBigInt64(212, true).toString(),
    expiresAt: view.getBigInt64(220, true).toString(),
    totalUpfrontInterestPaid: view.getBigUint64(228, true).toString(),
    totalProtocolFeePaid: view.getBigUint64(236, true).toString(),
    totalPlatformCostPaid: view.getBigUint64(244, true).toString(),
    requiredQuoteBufferAmount: view.getBigUint64(252, true).toString(),
    loanQuoteVault: new PublicKey(bytes.slice(260, 292)).toBase58(),
    quoteBufferVault: new PublicKey(bytes.slice(292, 324)).toBase58(),
    executedAt: view.getBigInt64(324, true).toString(),
    executedLoanQuoteAmount: view.getBigUint64(332, true).toString(),
    executedExtraUserQuoteAmount: view.getBigUint64(340, true).toString(),
    executedTotalBaseAmount: view.getBigUint64(348, true).toString(),
    collateralMint: new PublicKey(bytes.slice(356, 388)).toBase58(),
    collateralVault: new PublicKey(bytes.slice(388, 420)).toBase58(),
    collateralAmount: view.getBigUint64(420, true).toString(),
    immediateUserBaseAmount: view.getBigUint64(428, true).toString(),
    extraQuoteCollateralBpsSnapshot: view.getUint16(436, true),
    maxQuoteLossBpsSnapshot: view.getUint16(438, true),
    minQuoteBufferAmountSnapshot: view.getBigUint64(440, true).toString(),
    fixedMigrationCostQuoteSnapshot: view.getBigUint64(448, true).toString(),
  };
}

export async function fetchProtocolAccount(connection, programId) {
  let [protocolAddress] = deriveProtocolPda(programId);
  let account = await connection.getAccountInfo(protocolAddress);

  if (!account) {
    return {
      address: protocolAddress.toBase58(),
      exists: false,
    };
  }

  return {
    address: protocolAddress.toBase58(),
    exists: true,
    ...decodeProtocolConfig(account.data),
  };
}

export async function fetchAllAssetPools(connection, programId) {
  let accounts = await connection.getProgramAccounts(
    ensurePublicKey(programId),
  );

  return accounts
    .filter((account) =>
      matchesDiscriminator(account.account.data, ASSET_POOL_DISCRIMINATOR),
    )
    .map((account) => ({
      address: account.pubkey.toBase58(),
      ...decodeAssetPool(account.account.data),
    }))
    .sort((left, right) => left.mint.localeCompare(right.mint));
}

export async function fetchAllTickPages(connection, programId) {
  let accounts = await connection.getProgramAccounts(
    ensurePublicKey(programId),
  );

  return accounts
    .filter((account) =>
      matchesDiscriminator(account.account.data, TICK_PAGE_DISCRIMINATOR),
    )
    .map((account) => ({
      address: account.pubkey.toBase58(),
      ...decodeTickPage(account.account.data),
    }))
    .sort((left, right) => left.pageIndex - right.pageIndex);
}

export async function fetchAllExecutionStrategyConfigs(connection, programId) {
  let accounts = await connection.getProgramAccounts(
    ensurePublicKey(programId),
  );

  return accounts
    .filter((account) =>
      matchesDiscriminator(
        account.account.data,
        EXECUTION_STRATEGY_CONFIG_DISCRIMINATOR,
      ),
    )
    .map((account) => ({
      address: account.pubkey.toBase58(),
      ...decodeExecutionStrategyConfig(account.account.data),
    }))
    .sort((left, right) => left.mode - right.mode);
}

export async function fetchWalletTokenBalances(connection, owner, assetPools) {
  let ownerPublicKey = ensurePublicKey(owner);
  let amountsByMint = new Map();
  let knownMints = new Set(assetPools.map((pool) => pool.mint));
  let [tokenAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  for (let response of [tokenAccounts, token2022Accounts]) {
    for (let account of response.value) {
      let info = account.account.data?.parsed?.info;
      let mint = info?.mint;

      if (!mint || !knownMints.has(mint)) {
        continue;
      }

      let amount = BigInt(info.tokenAmount.amount ?? '0');
      amountsByMint.set(mint, (amountsByMint.get(mint) ?? 0n) + amount);
    }
  }

  return assetPools.map((pool) => {
    let amount = amountsByMint.get(pool.mint) ?? 0n;

    return {
      mint: pool.mint,
      decimals: pool.decimals,
      amount: amount.toString(),
      amountFormatted: formatTokenAmount(amount, pool.decimals, {
        preserveTrailingZeros: true,
      }),
    };
  });
}

export async function fetchWalletLpPositions(
  connection,
  programId,
  owner,
  assetPoolsByAddress = new Map(),
) {
  let discriminator = await accountDiscriminator('LpPosition');
  let accounts = await connection.getProgramAccounts(
    ensurePublicKey(programId),
  );

  return accounts
    .filter((account) =>
      matchesDiscriminator(account.account.data, discriminator),
    )
    .map((account) => ({
      address: account.pubkey.toBase58(),
      ...decodeLpPosition(account.account.data),
    }))
    .filter((position) => position.owner === ensurePublicKey(owner).toBase58())
    .map((position) => {
      let pool = assetPoolsByAddress.get(position.assetPool);

      return {
        ...position,
        pool,
        decimals: pool?.decimals ?? 0,
        sharesFormatted: formatTokenAmount(
          position.shares,
          pool?.decimals ?? 0,
        ),
      };
    })
    .sort((left, right) => left.tick - right.tick);
}

export async function fetchWalletLoanPositions(
  connection,
  programId,
  owner,
  assetPoolsByAddress = new Map(),
  strategiesByMode = new Map(),
) {
  let accounts = await connection.getProgramAccounts(
    ensurePublicKey(programId),
  );
  let ownerAddress = ensurePublicKey(owner).toBase58();

  return accounts
    .filter((account) =>
      matchesDiscriminator(account.account.data, LOAN_POSITION_DISCRIMINATOR),
    )
    .map((account) => ({
      address: account.pubkey.toBase58(),
      ...decodeLoanPosition(account.account.data),
    }))
    .filter((loan) => loan.owner === ownerAddress)
    .map((loan) => {
      let pool = assetPoolsByAddress.get(loan.quoteAssetPool) ?? null;
      let strategy = strategiesByMode.get(loan.strategyMode) ?? null;

      return {
        ...loan,
        pool,
        strategy,
        statusLabel: loanStatusLabel(loan.status),
      };
    })
    .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
}

export async function fetchBorrowSlicesForOwner(connection, programId, owner) {
  let accounts = await connection.getProgramAccounts(
    ensurePublicKey(programId),
  );
  let ownerAddress = ensurePublicKey(owner).toBase58();

  return accounts
    .filter((account) =>
      matchesDiscriminator(
        account.account.data,
        BORROW_SLICE_POSITION_DISCRIMINATOR,
      ),
    )
    .map((account) => ({
      address: account.pubkey.toBase58(),
      ...decodeBorrowSlicePosition(account.account.data),
    }))
    .filter((slice) => slice.owner === ownerAddress)
    .sort((left, right) => left.tick - right.tick);
}

export async function fetchMintInfo(connection, mint) {
  let mintPublicKey = ensurePublicKey(mint);
  let account = await connection.getParsedAccountInfo(
    mintPublicKey,
    'confirmed',
  );
  let owner = account.value?.owner?.toBase58?.() ?? TOKEN_PROGRAM_ID.toBase58();
  let parsedInfo = account.value?.data?.parsed?.info;

  return {
    mint: mintPublicKey.toBase58(),
    tokenProgram: owner,
    supply: parsedInfo?.supply ?? null,
    decimals: parsedInfo?.decimals ?? null,
  };
}

export async function ensureAssociatedTokenAccountInstruction({
  connection,
  owner,
  mint,
  tokenProgram,
  payer = owner,
  allowOwnerOffCurve = false,
}) {
  let ata = getAssociatedTokenAddressSync(
    ensurePublicKey(mint),
    ensurePublicKey(owner),
    allowOwnerOffCurve,
    ensurePublicKey(tokenProgram),
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  let existing = await connection.getAccountInfo(ata);

  if (existing) {
    return { ata, instruction: null };
  }

  return {
    ata,
    instruction: createAssociatedTokenAccountInstruction(
      ensurePublicKey(payer),
      ata,
      ensurePublicKey(owner),
      ensurePublicKey(mint),
      ensurePublicKey(tokenProgram),
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  };
}

export async function buildWrapSolInstructions({
  connection,
  owner,
  lamports,
  payer = owner,
}) {
  let normalizedLamports = BigInt(lamports ?? 0);
  let ataData = await ensureAssociatedTokenAccountInstruction({
    connection,
    owner,
    mint: NATIVE_MINT,
    tokenProgram: TOKEN_PROGRAM_ID,
    payer,
  });
  let instructions = [];

  if (ataData.instruction) {
    instructions.push(ataData.instruction);
  }

  if (normalizedLamports > 0n) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: ensurePublicKey(owner),
        toPubkey: ataData.ata,
        lamports: Number(normalizedLamports),
      }),
      createSyncNativeInstruction(ataData.ata, TOKEN_PROGRAM_ID),
    );
  }

  return {
    ata: ataData.ata,
    instructions,
  };
}

export function buildUnwrapWsolInstruction({ owner, ata }) {
  return createCloseAccountInstruction(
    ensurePublicKey(ata),
    ensurePublicKey(owner),
    ensurePublicKey(owner),
    [],
    TOKEN_PROGRAM_ID,
  );
}

export function buildDepositToTickTransaction({
  amount,
  assetPool,
  blockhash,
  lpPosition,
  mint,
  owner,
  programId,
  protocol,
  tick,
  tickPage,
  tokenProgram,
  userTokenAccount,
  vault,
}) {
  let transaction = new Transaction({
    feePayer: ensurePublicKey(owner),
    recentBlockhash: blockhash,
  });

  transaction.add(
    new TransactionInstruction({
      programId: ensurePublicKey(programId),
      keys: [
        readonlyKey(protocol),
        writableKey(assetPool),
        signerKey(owner),
        readonlyKey(mint),
        writableKey(userTokenAccount),
        writableKey(vault),
        writableKey(tickPage),
        writableKey(lpPosition),
        readonlyKey(tokenProgram),
        readonlyKey(SystemProgram.programId),
      ],
      data: Uint8Array.from([
        ...DEPOSIT_TO_TICK_DISCRIMINATOR,
        ...encodeU32(tick),
        ...encodeU64(amount),
      ]),
    }),
  );

  return transaction;
}

export function buildInitializeTickPageTransaction({
  blockhash,
  pageIndex,
  programId,
  protocol,
  assetPool,
  tickPage,
  authority,
}) {
  let transaction = new Transaction({
    feePayer: ensurePublicKey(authority),
    recentBlockhash: blockhash,
  });

  transaction.add(
    new TransactionInstruction({
      programId: ensurePublicKey(programId),
      keys: [
        readonlyKey(protocol),
        readonlyKey(assetPool),
        writableKey(tickPage),
        signerKey(authority),
        readonlyKey(SystemProgram.programId),
      ],
      data: Uint8Array.from([
        ...INITIALIZE_TICK_PAGE_DISCRIMINATOR,
        ...encodeU32(pageIndex),
      ]),
    }),
  );

  return transaction;
}

export function buildWithdrawFromTickTransaction({
  assetPool,
  blockhash,
  lpPosition,
  mint,
  owner,
  programId,
  protocol,
  sharesToBurn,
  tick,
  tickPage,
  tokenProgram,
  userTokenAccount,
  vault,
  vaultAuthority,
}) {
  let transaction = new Transaction({
    feePayer: ensurePublicKey(owner),
    recentBlockhash: blockhash,
  });

  transaction.add(
    new TransactionInstruction({
      programId: ensurePublicKey(programId),
      keys: [
        readonlyKey(protocol),
        writableKey(assetPool),
        signerKey(owner),
        readonlyKey(mint),
        writableKey(userTokenAccount),
        readonlyKey(vaultAuthority),
        writableKey(vault),
        writableKey(tickPage),
        writableKey(lpPosition),
        readonlyKey(tokenProgram),
      ],
      data: Uint8Array.from([
        ...WITHDRAW_FROM_TICK_DISCRIMINATOR,
        ...encodeU32(tick),
        ...encodeU64(sharesToBurn),
      ]),
    }),
  );

  return transaction;
}

export function buildOpenLoanTransaction({
  blockhash,
  loanId,
  routePlanHash,
  plannedSliceCount,
  requestedQuoteAmount,
  fundedQuoteAmount,
  extraUserQuoteAmount,
  termSec,
  totalUpfrontInterestPaid,
  totalProtocolFeePaid,
  totalPlatformCostPaid,
  programId,
  protocol,
  quoteAssetPool,
  strategyConfig,
  owner,
  quoteMint,
  userQuoteTokenAccount,
  loanPosition,
  loanVaultAuthority,
  loanQuoteVault,
  loanQuoteBufferVault,
  protocolQuoteTreasuryAuthority,
  protocolQuoteTreasuryVault,
  tokenProgram,
}) {
  let transaction = new Transaction({
    feePayer: ensurePublicKey(owner),
    recentBlockhash: blockhash,
  });

  transaction.add(
    new TransactionInstruction({
      programId: ensurePublicKey(programId),
      keys: [
        readonlyKey(protocol),
        writableKey(quoteAssetPool),
        readonlyKey(strategyConfig),
        signerKey(owner),
        readonlyKey(quoteMint),
        writableKey(userQuoteTokenAccount),
        writableKey(loanPosition),
        readonlyKey(loanVaultAuthority),
        writableKey(loanQuoteVault),
        writableKey(loanQuoteBufferVault),
        readonlyKey(protocolQuoteTreasuryAuthority),
        writableKey(protocolQuoteTreasuryVault),
        readonlyKey(tokenProgram),
        readonlyKey(SystemProgram.programId),
      ],
      data: Uint8Array.from([
        ...OPEN_LOAN_DISCRIMINATOR,
        ...encodeU64(loanId),
        ...encodeFixedBytes(routePlanHash, 32),
        ...encodeU16(plannedSliceCount),
        ...encodeU64(requestedQuoteAmount),
        ...encodeU64(fundedQuoteAmount),
        ...encodeU64(extraUserQuoteAmount),
        ...encodeU64(termSec),
        ...encodeU64(totalUpfrontInterestPaid),
        ...encodeU64(totalProtocolFeePaid),
        ...encodeU64(totalPlatformCostPaid),
      ]),
    }),
  );

  return transaction;
}

export function buildInitializeBorrowSliceTransaction({
  blockhash,
  loanId,
  tick,
  programId,
  protocol,
  quoteAssetPool,
  loanPosition,
  owner,
  borrowSlicePosition,
}) {
  let transaction = new Transaction({
    feePayer: ensurePublicKey(owner),
    recentBlockhash: blockhash,
  });

  transaction.add(
    new TransactionInstruction({
      programId: ensurePublicKey(programId),
      keys: [
        readonlyKey(protocol),
        readonlyKey(quoteAssetPool),
        writableKey(loanPosition),
        signerKey(owner),
        writableKey(borrowSlicePosition),
        readonlyKey(SystemProgram.programId),
      ],
      data: Uint8Array.from([
        ...INITIALIZE_BORROW_SLICE_POSITION_DISCRIMINATOR,
        ...encodeU64(loanId),
        ...encodeU32(tick),
      ]),
    }),
  );

  return transaction;
}

export function buildFundLoanFromTicksTransaction({
  blockhash,
  fills,
  programId,
  protocol,
  quoteAssetPool,
  owner,
  quoteMint,
  vaultAuthority,
  vault,
  loanPosition,
  loanQuoteVault,
  tokenProgram,
  remainingAccounts = [],
}) {
  let transaction = new Transaction({
    feePayer: ensurePublicKey(owner),
    recentBlockhash: blockhash,
  });
  let serializedFills = fills.flatMap((fill) => [
    ...encodeU32(fill.tick),
    ...encodeU64(fill.principalAmount),
    ...encodeU64(fill.upfrontInterestAmount),
    ...encodeU64(fill.protocolFeeAmount),
  ]);

  transaction.add(
    new TransactionInstruction({
      programId: ensurePublicKey(programId),
      keys: [
        readonlyKey(protocol),
        writableKey(quoteAssetPool),
        signerKey(owner),
        readonlyKey(quoteMint),
        readonlyKey(vaultAuthority),
        writableKey(vault),
        writableKey(loanPosition),
        writableKey(loanQuoteVault),
        readonlyKey(tokenProgram),
        ...remainingAccounts.map((account) =>
          account.isWritable
            ? writableKey(account.pubkey)
            : readonlyKey(account.pubkey),
        ),
      ],
      data: Uint8Array.from([
        ...FUND_LOAN_FROM_TICKS_DISCRIMINATOR,
        ...encodeU32(fills.length),
        ...serializedFills,
      ]),
    }),
  );

  return transaction;
}

export function buildExecuteLaunchPumpFunTransaction({
  blockhash,
  useCreateV2,
  name,
  symbol,
  uri,
  loanQuoteSpendAmount,
  extraUserQuoteSpendAmount,
  collateralMinBaseOut,
  immediateUserMinBaseOut,
  programId,
  protocol,
  quoteAssetPool,
  owner,
  quoteMint,
  baseMint,
  loanPosition,
  loanVaultAuthority,
  loanExecutionWallet,
  loanQuoteVault,
  userExtraQuoteTokenAccount,
  pumpFunProgram,
  pumpFunGlobal,
  pumpFunBondingCurve,
  pumpFunAssociatedBondingCurve,
  pumpFunMayhemProgram,
  pumpFunGlobalParams,
  pumpFunSolVault,
  pumpFunMayhemState,
  pumpFunMayhemTokenVault,
  pumpFunLoanTemporaryWsolVault,
  pumpFunMintAuthority,
  pumpFunEventAuthority,
  pumpFunFeeRecipient,
  pumpFunCreatorVault,
  loanCollateralVault,
  userBaseTokenAccount,
  quoteTokenProgram,
  baseTokenProgram,
  remainingAccounts = [],
  associatedTokenProgram = ASSOCIATED_TOKEN_PROGRAM_ID,
}) {
  let transaction = new Transaction({
    feePayer: ensurePublicKey(owner),
    recentBlockhash: blockhash,
  });

  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    }),
  );

  transaction.add(
    new TransactionInstruction({
      programId: ensurePublicKey(programId),
      keys: [
        readonlyKey(protocol),
        writableKey(quoteAssetPool),
        signerKey(owner),
        writableKey(quoteMint),
        { pubkey: ensurePublicKey(baseMint), isSigner: true, isWritable: true },
        writableKey(loanPosition),
        readonlyKey(loanVaultAuthority),
        writableKey(loanExecutionWallet),
        writableKey(loanQuoteVault),
        writableKey(userExtraQuoteTokenAccount),
        readonlyKey(pumpFunProgram),
        readonlyKey(pumpFunGlobal),
        writableKey(pumpFunBondingCurve),
        writableKey(pumpFunAssociatedBondingCurve),
        writableKey(pumpFunLoanTemporaryWsolVault),
        readonlyKey(pumpFunMintAuthority),
        readonlyKey(pumpFunEventAuthority),
        writableKey(pumpFunFeeRecipient),
        writableKey(pumpFunCreatorVault),
        writableKey(pumpFunMayhemProgram),
        writableKey(pumpFunGlobalParams),
        writableKey(pumpFunSolVault),
        writableKey(pumpFunMayhemState),
        writableKey(pumpFunMayhemTokenVault),
        writableKey(loanCollateralVault),
        writableKey(userBaseTokenAccount),
        readonlyKey(quoteTokenProgram),
        readonlyKey(baseTokenProgram),
        readonlyKey(associatedTokenProgram),
        readonlyKey(SystemProgram.programId),
        ...remainingAccounts.map((account) =>
          account.isWritable
            ? writableKey(account.pubkey)
            : readonlyKey(account.pubkey),
        ),
      ],
      data: Uint8Array.from([
        ...EXECUTE_LAUNCH_PUMP_FUN_DISCRIMINATOR,
        ...encodeBool(useCreateV2),
        ...encodeString(name),
        ...encodeString(symbol),
        ...encodeString(uri),
        ...encodeU64(loanQuoteSpendAmount),
        ...encodeU64(extraUserQuoteSpendAmount),
        ...encodeU64(collateralMinBaseOut),
        ...encodeU64(immediateUserMinBaseOut),
      ]),
    }),
  );

  return transaction;
}

export function buildRoutePlan({
  pool,
  strategy,
  requestedQuoteAmount,
  extraUserQuoteAmount,
  termSec,
  protocolFeeBps = 0,
  platformCostQuote = 0n,
}) {
  let requested = BigInt(requestedQuoteAmount ?? 0);
  let extra = BigInt(extraUserQuoteAmount ?? 0);
  let term = BigInt(termSec ?? 0);
  let feeBps = BigInt(protocolFeeBps ?? 0);
  let remaining = requested;
  let fills = [];

  let sortedTicks = (pool?.tickPages ?? [])
    .flatMap((page) =>
      page.ticks.map((tick) => ({
        tick: tick.absoluteIndex,
        availableLiquidity: BigInt(tick.availableLiquidity ?? 0),
      })),
    )
    .filter((tick) => tick.availableLiquidity > 0n)
    .sort((left, right) => left.tick - right.tick);

  for (let tick of sortedTicks) {
    if (remaining <= 0n) {
      break;
    }

    let principal =
      tick.availableLiquidity > remaining ? remaining : tick.availableLiquidity;
    let interest =
      (principal * BigInt(tick.tick) * term) /
      (10000n * 365n * 24n * 60n * 60n);
    let protocolFee = (principal * feeBps) / 10000n;

    fills.push({
      tick: tick.tick,
      principalAmount: principal.toString(),
      upfrontInterestAmount: interest.toString(),
      protocolFeeAmount: protocolFee.toString(),
    });

    remaining -= principal;
  }

  let funded = fills.reduce(
    (sum, fill) => sum + BigInt(fill.principalAmount),
    0n,
  );

  let plan = {
    mode: strategy?.mode ?? MODE_PUMP_FUN,
    poolAddress: pool?.address ?? null,
    quoteMint: pool?.mint ?? null,
    requestedQuoteAmount: requested.toString(),
    fundedQuoteAmount: funded.toString(),
    extraUserQuoteAmount: extra.toString(),
    plannedSliceCount: fills.length,
    termSec: term.toString(),
    totalUpfrontInterestPaid: fills
      .reduce((sum, fill) => sum + BigInt(fill.upfrontInterestAmount), 0n)
      .toString(),
    totalProtocolFeePaid: fills
      .reduce((sum, fill) => sum + BigInt(fill.protocolFeeAmount), 0n)
      .toString(),
    totalPlatformCostPaid: BigInt(platformCostQuote ?? 0).toString(),
    fills,
  };

  validatePlanTotals(plan);

  return plan;
}

export async function buildRoutePlanHash(plan) {
  let canonical = canonicalizeRoutePlan(plan);
  let digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonical));

  return new Uint8Array(digest);
}

export function validatePlanTotals(plan) {
  let funded = BigInt(plan.fundedQuoteAmount ?? 0);
  let requested = BigInt(plan.requestedQuoteAmount ?? 0);
  let totalPrincipal = 0n;
  let totalInterest = 0n;
  let totalProtocolFee = 0n;

  if ((plan.plannedSliceCount ?? 0) <= 0) {
    throw new Error('planned_slice_count must be greater than zero.');
  }

  if (requested <= 0n || funded <= 0n || funded > requested) {
    throw new Error('Borrow plan quote amounts are invalid.');
  }

  for (let fill of plan.fills ?? []) {
    totalPrincipal += BigInt(fill.principalAmount ?? 0);
    totalInterest += BigInt(fill.upfrontInterestAmount ?? 0);
    totalProtocolFee += BigInt(fill.protocolFeeAmount ?? 0);
  }

  if (totalPrincipal !== funded) {
    throw new Error('Borrow plan principal sum does not match funded quote.');
  }

  if (totalInterest !== BigInt(plan.totalUpfrontInterestPaid ?? 0)) {
    throw new Error(
      'Borrow plan interest sum does not match total upfront interest.',
    );
  }

  if (totalProtocolFee !== BigInt(plan.totalProtocolFeePaid ?? 0)) {
    throw new Error(
      'Borrow plan protocol fee sum does not match total protocol fee.',
    );
  }

  return true;
}

export function generateLoanId() {
  return BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
}

export function generateMintKeypair() {
  return Keypair.generate();
}

export function buildVersionedTransaction({
  payer,
  blockhash,
  instructions,
  lookupTables = [],
}) {
  let message = new TransactionMessage({
    payerKey: ensurePublicKey(payer),
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTables);

  return new VersionedTransaction(message);
}

export function createLookupTableInstruction({ authority, payer, recentSlot }) {
  return AddressLookupTableProgram.createLookupTable({
    authority: ensurePublicKey(authority),
    payer: ensurePublicKey(payer),
    recentSlot,
  });
}

export function extendLookupTableInstruction({
  payer,
  authority,
  lookupTable,
  addresses,
}) {
  return AddressLookupTableProgram.extendLookupTable({
    payer: ensurePublicKey(payer),
    authority: ensurePublicKey(authority),
    lookupTable: ensurePublicKey(lookupTable),
    addresses: addresses.map((address) => ensurePublicKey(address)),
  });
}

export async function signAndSendTransaction({
  connection,
  provider,
  transaction,
  simulateBeforeSend = false,
}) {
  let signature;

  try {
    if (typeof provider.signTransaction === 'function') {
      let signedTransaction = await provider.signTransaction(transaction);

      if (simulateBeforeSend) {
        let simulation = await connection.simulateTransaction(
          signedTransaction,
          {
            commitment: 'confirmed',
            sigVerify: false,
            replaceRecentBlockhash: true,
          },
        );

        if (simulation.value.err) {
          let simulationLogs = simulation.value.logs ?? [];
          throw new Error(
            `Transaction simulation failed before send: ${JSON.stringify(simulation.value.err)}\nFull logs:\n${simulationLogs.join('\n')}`,
          );
        }
      }

      signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          preflightCommitment: 'confirmed',
        },
      );
    } else {
      let signed = await provider.signAndSendTransaction(transaction);
      signature = signed.signature;
    }
  } catch (error) {
    let providerMessage =
      error?.message ?? error?.toString?.() ?? 'Unknown wallet error';
    let extractedLogs = [];
    let sizeMatch = providerMessage.match(
      /Transaction too large:\s*(\d+)\s*>\s*(\d+)/i,
    );

    if (Array.isArray(error?.logs) && error.logs.length > 0) {
      extractedLogs = error.logs;
    } else if (typeof error?.getLogs === 'function') {
      try {
        let fetchedLogs = await error.getLogs(connection);

        if (Array.isArray(fetchedLogs) && fetchedLogs.length > 0) {
          extractedLogs = fetchedLogs;
        }
      } catch {
        // Ignore log extraction failures and fall back to the provider message.
      }
    }

    if (sizeMatch) {
      let [, actualSize, limitSize] = sizeMatch;
      throw new Error(
        `Execute transaction is too large for Solana packet limits (${actualSize} > ${limitSize}). This is usually caused by long token metadata fields such as name, symbol, or especially URI. Address lookup tables are already enabled here, so the remaining limit is instruction payload size.`,
      );
    }

    if (extractedLogs.length > 0) {
      throw new Error(
        `Wallet rejected or failed to sign transaction: ${providerMessage}\nFull logs:\n${extractedLogs.join('\n')}`,
      );
    }

    throw new Error(
      `Wallet rejected or failed to sign transaction: ${providerMessage}`,
    );
  }

  let status = null;

  for (let attempt = 0; attempt < 15; attempt++) {
    let response = await connection.getSignatureStatuses([signature]);
    status = response.value[0];

    if (status?.err) {
      let transactionDetails = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      let logMessage = transactionDetails?.meta?.logMessages?.find((line) =>
        /error|failed|custom program error/i.test(line),
      );

      throw new Error(
        logMessage
          ? `Transaction failed: ${logMessage}`
          : `Transaction failed: ${JSON.stringify(status.err)}`,
      );
    }

    if (
      status?.confirmationStatus === 'confirmed' ||
      status?.confirmationStatus === 'finalized'
    ) {
      return signature;
    }

    await delay(1000);
  }

  throw new Error(
    'Transaction was sent by the wallet but was not found on the selected RPC. Check that Phantom is connected to the same network as the app.',
  );
}

export function strategyDescription(strategy) {
  if (!strategy) {
    return 'Configuration was not found for this strategy mode.';
  }

  return `ExecutionStrategyConfig for ${strategy.label} defines collateral buffers, quote loss protection, and fixed migration costs used by future borrow flows.`;
}

export function modeToSlug(mode) {
  return MODE_LABELS[mode] ?? `mode-${mode}`;
}

export function loanStatusLabel(status) {
  switch (status) {
    case LOAN_STATUS_OPENED:
      return 'OPENED';
    case LOAN_STATUS_FUNDED:
      return 'FUNDED';
    case LOAN_STATUS_EXECUTED:
      return 'EXECUTED';
    default:
      return `STATUS ${status}`;
  }
}

export function isWsolMint(mint) {
  return ensurePublicKey(mint).equals(NATIVE_MINT);
}

export function resolvePumpFunEnvKey(networkPreset) {
  if (networkPreset === 'localnet') {
    return 'local';
  }

  if (networkPreset === 'devnet') {
    return 'devnet';
  }

  if (networkPreset === 'mainnet') {
    return 'mainnet';
  }

  return null;
}

export function getPumpFunEnvConfig(networkPreset) {
  let key = resolvePumpFunEnvKey(networkPreset);
  return key ? (PUMP_FUN_ENV_CONFIG[key] ?? null) : null;
}

function ensurePublicKey(value) {
  return value instanceof PublicKey ? value : new PublicKey(value);
}

function writableKey(pubkey) {
  return { pubkey: ensurePublicKey(pubkey), isSigner: false, isWritable: true };
}

function readonlyKey(pubkey) {
  return {
    pubkey: ensurePublicKey(pubkey),
    isSigner: false,
    isWritable: false,
  };
}

function signerKey(pubkey) {
  return { pubkey: ensurePublicKey(pubkey), isSigner: true, isWritable: true };
}

function encodeU32(value) {
  let buffer = new ArrayBuffer(4);
  let view = new DataView(buffer);
  view.setUint32(0, Number(value), true);
  return new Uint8Array(buffer);
}

function encodeU16(value) {
  let buffer = new ArrayBuffer(2);
  let view = new DataView(buffer);
  view.setUint16(0, Number(value), true);
  return new Uint8Array(buffer);
}

function encodeU64(value) {
  let buffer = new ArrayBuffer(8);
  let view = new DataView(buffer);
  view.setBigUint64(0, BigInt(value), true);
  return new Uint8Array(buffer);
}

function encodeBool(value) {
  return Uint8Array.from([value ? 1 : 0]);
}

function encodeFixedBytes(value, size) {
  if (value instanceof Uint8Array) {
    if (value.length !== size) {
      throw new Error(`Expected ${size} bytes, received ${value.length}.`);
    }

    return value;
  }

  let bytes = Uint8Array.from(value ?? []);

  if (bytes.length !== size) {
    throw new Error(`Expected ${size} bytes, received ${bytes.length}.`);
  }

  return bytes;
}

function encodeString(value) {
  let bytes = encoder.encode(String(value ?? ''));
  return Uint8Array.from([...encodeU32(bytes.length), ...bytes]);
}

function formatWholeWithCommas(value) {
  let normalized = value.toString();
  let negative = normalized.startsWith('-');
  let digits = negative ? normalized.slice(1) : normalized;
  let grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return negative ? `-${grouped}` : grouped;
}

function matchesDiscriminator(data, discriminator) {
  let bytes = Uint8Array.from(data);

  if (bytes.length < discriminator.length) {
    return false;
  }

  for (let index = 0; index < discriminator.length; index++) {
    if (bytes[index] !== discriminator[index]) {
      return false;
    }
  }

  return true;
}

function assertDiscriminator(bytes, discriminator, label) {
  if (!matchesDiscriminator(bytes, discriminator)) {
    throw new Error(`${label} discriminator mismatch`);
  }
}

async function accountDiscriminator(name) {
  let input = encoder.encode(`account:${name}`);
  let digest = await crypto.subtle.digest('SHA-256', input);

  return [...new Uint8Array(digest).slice(0, 8)];
}

function canonicalizeRoutePlan(plan) {
  let canonical = {
    mode: Number(plan.mode ?? MODE_PUMP_FUN),
    poolAddress: plan.poolAddress ?? '',
    quoteMint: plan.quoteMint ?? '',
    requestedQuoteAmount: String(plan.requestedQuoteAmount ?? '0'),
    fundedQuoteAmount: String(plan.fundedQuoteAmount ?? '0'),
    extraUserQuoteAmount: String(plan.extraUserQuoteAmount ?? '0'),
    plannedSliceCount: Number(plan.plannedSliceCount ?? 0),
    termSec: String(plan.termSec ?? '0'),
    totalUpfrontInterestPaid: String(plan.totalUpfrontInterestPaid ?? '0'),
    totalProtocolFeePaid: String(plan.totalProtocolFeePaid ?? '0'),
    totalPlatformCostPaid: String(plan.totalPlatformCostPaid ?? '0'),
    fills: [...(plan.fills ?? [])]
      .map((fill) => ({
        tick: Number(fill.tick),
        principalAmount: String(fill.principalAmount ?? '0'),
        upfrontInterestAmount: String(fill.upfrontInterestAmount ?? '0'),
        protocolFeeAmount: String(fill.protocolFeeAmount ?? '0'),
      }))
      .sort((left, right) => left.tick - right.tick),
  };

  return JSON.stringify(canonical);
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
