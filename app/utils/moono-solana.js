import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

export const DEFAULT_PROGRAM_ID = 'moonoL26kRC8S49yPuuopKhbNhvgf2h4Dva91noD8rN';
export const SETTINGS_STORAGE_KEY = 'moono-user-settings-v1';
export const PAGE_SIZE = 32;
export const SOLANA_CHAIN_KEY = 'solana';
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
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYDutZJ3rrodpAtxEvsCzor: 'USDT',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK',
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'USDC',
};

const encoder = new TextEncoder();

const PROTOCOL_SEED = encoder.encode('protocol');
const ASSET_POOL_SEED = encoder.encode('asset_pool');
const VAULT_AUTHORITY_SEED = encoder.encode('vault_authority');
const VAULT_SEED = encoder.encode('vault');
const TICK_PAGE_SEED = encoder.encode('tick_page');
const LP_POSITION_SEED = encoder.encode('lp_position');

const PROTOCOL_CONFIG_DISCRIMINATOR = [207, 91, 250, 28, 152, 179, 215, 209];
const ASSET_POOL_DISCRIMINATOR = [81, 48, 2, 215, 147, 255, 152, 112];
const TICK_PAGE_DISCRIMINATOR = [110, 112, 11, 129, 24, 29, 182, 65];
const EXECUTION_STRATEGY_CONFIG_DISCRIMINATOR = [
  86, 201, 71, 63, 13, 238, 70, 230,
];
const DEPOSIT_TO_TICK_DISCRIMINATOR = [195, 171, 163, 179, 56, 122, 130, 206];
const WITHDRAW_FROM_TICK_DISCRIMINATOR = [245, 145, 186, 211, 99, 83, 248, 95];

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

export function formatTokenAmount(value, decimals = 0) {
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
      amountFormatted: formatTokenAmount(amount, pool.decimals),
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
}) {
  let ata = getAssociatedTokenAddressSync(
    ensurePublicKey(mint),
    ensurePublicKey(owner),
    false,
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

export async function signAndSendTransaction({
  connection,
  provider,
  transaction,
}) {
  let signed = await provider.signAndSendTransaction(transaction);
  let latestBlockhash = await connection.getLatestBlockhash('confirmed');

  await connection.confirmTransaction(
    {
      signature: signed.signature,
      ...latestBlockhash,
    },
    'confirmed',
  );

  return signed.signature;
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

function encodeU64(value) {
  let buffer = new ArrayBuffer(8);
  let view = new DataView(buffer);
  view.setBigUint64(0, BigInt(value), true);
  return new Uint8Array(buffer);
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
