import * as s from '@strling-lang/strling/simply';
import {
  asciiDigit,
  asciiHex,
  asciiLower,
  choices,
  decimalDate,
} from './lexical.ts';

type RecordKind = 'PAY' | 'REFUND' | 'TRANSFER';
type Currency = 'USD' | 'EUR' | 'GBP';

interface RecordFormat {
  readonly kind: RecordKind;
  readonly currencies: readonly [Currency, ...Currency[]];
  readonly requiresDestination: boolean;
  readonly allowsMetadata: boolean;
}

type FormatCatalog = {
  readonly [Kind in RecordKind]: RecordFormat & { readonly kind: Kind };
};

const dateField = () => s.group('date', decimalDate());
const currencyField = (currencies: RecordFormat['currencies']) =>
  s.group('currency', choices(currencies));
const accountField = (name: 'sourceAccount' | 'destinationAccount') =>
  s.group(name, 'acct-', asciiDigit().rep(4, 8));
const amountField = () =>
  s.group('amount', asciiDigit().rep(1, 8), '.', asciiDigit().rep(2));
const referenceField = () => s.group('reference', 'ref-', asciiHex().rep(4, 8));
const destinationField = () =>
  s.merge('to=', accountField('destinationAccount'));
const metadataField = () =>
  s.merge(
    'meta=',
    s.group('metadata', s.inChars(asciiLower(), asciiDigit(), '-').rep(1, 12)),
  );

export const baseFormats = {
  PAY: {
    kind: 'PAY',
    currencies: ['USD', 'EUR'],
    requiresDestination: false,
    allowsMetadata: false,
  },
  REFUND: {
    kind: 'REFUND',
    currencies: ['USD'],
    requiresDestination: false,
    allowsMetadata: false,
  },
  TRANSFER: {
    kind: 'TRANSFER',
    currencies: ['USD', 'GBP'],
    requiresDestination: true,
    allowsMetadata: false,
  },
} as const satisfies FormatCatalog;

export const formats = {
  ...baseFormats,
  PAY: { ...baseFormats.PAY, currencies: ['USD', 'EUR', 'GBP'] },
  REFUND: { ...baseFormats.REFUND, allowsMetadata: true },
} as const satisfies FormatCatalog;

export function buildRecordPattern(format: RecordFormat): s.Pattern {
  const requiredFields = [
    dateField(),
    currencyField(format.currencies),
    accountField('sourceAccount'),
    amountField(),
    referenceField(),
  ];
  if (format.requiresDestination) requiredFields.push(destinationField());

  return s.merge(
    s.start(),
    s.group('kind', format.kind),
    ...requiredFields.map((field) => s.merge('|', field)),
    ...(format.allowsMetadata ? [s.may('|', metadataField())] : []),
    s.end(),
  );
}

export function compileRecords(
  model: FormatCatalog,
  compile: (pattern: s.Pattern) => RegExp,
) {
  return new Map<string, RegExp>(
    Object.values(model).map((format) => [
      format.kind,
      compile(buildRecordPattern(format)),
    ]),
  );
}

export function matchRecord(
  catalog: ReadonlyMap<string, RegExp>,
  line: string,
) {
  const delimiter = line.indexOf('|');
  if (delimiter < 0) return null;
  const regex = catalog.get(line.slice(0, delimiter));
  return regex?.exec(line)?.groups ?? null;
}

export function parseRecordValues(date: string, amount: string) {
  // Inputs are captures from a successful match. A UTC round trip detects dates
  // normalized by Date, and BigInt keeps fractional currency units exact.
  const instant = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(instant.getTime()) ||
    instant.toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Invalid calendar date');
  }
  const minorUnits = BigInt(amount.replace('.', ''));
  if (minorUnits <= 0n) throw new Error('Amount must be positive');
  return { date, minorUnits };
}
