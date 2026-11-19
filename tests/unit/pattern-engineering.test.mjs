import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileProjection,
  loadPatternCompiler,
} from '../../public/examples/pattern-engineering/compiler.ts';
import {
  buildEventLog,
  extendedLogFormat,
} from '../../public/examples/pattern-engineering/production-event-logs.ts';
import {
  baseRoutes,
  compileRoutes,
  routes,
  selectRoute,
} from '../../public/examples/pattern-engineering/versioned-api-routes.ts';
import {
  baseFormats,
  buildRecordPattern,
  compileRecords,
  formats,
  matchRecord,
  parseRecordValues,
} from '../../public/examples/pattern-engineering/policy-driven-import-records.ts';

const compile = await loadPatternCompiler();
const info =
  '2026-11-18T21:34:05Z level=INFO service=billing event=invoice.created trace=4A92D61F duration_ms=19';
const error =
  '2026-11-18T21:35:11Z level=ERROR service=payments event=charge.failed trace=9B4E283C';
const project = '/api/v2/orgs/acme/projects/PRJ-0042';
const payment = 'PAY|2026-11-18|USD|acct-4821|125.50|ref-7F3A';
const refund = 'REFUND|2026-11-18|USD|acct-4821|25.00|ref-7F3B';
const transfer =
  'TRANSFER|2026-11-18|USD|acct-4821|500.00|ref-7F3C|to=acct-7351';

test('each tutorial records Simply 1.1 and compiles to an ECMAScript artifact', () => {
  const patterns = [
    buildEventLog(),
    ...routes.map(({ pattern }) => pattern),
    ...Object.values(formats).map(buildRecordPattern),
  ];
  for (const pattern of patterns) {
    const request = pattern.buildRequest(compileProjection);
    assert.equal(request.protocol_version, '1.1.0');
    assert.deepEqual(
      request.compile.target_profile,
      compileProjection.target_profile,
    );
    assert.ok(
      request.steps.some(({ step_id }) => step_id === request.root_step_id),
    );
    const operations = new Set(request.steps.map(({ operation }) => operation));
    for (const operation of ['sequence', 'capture', 'repeat', 'position']) {
      assert.ok(operations.has(operation), operation);
    }
    assert.equal(compile(pattern).flags, 'u');
  }
});

test('event logs extract fields with independently optional duration and context', () => {
  const regex = compile(buildEventLog());
  assert.deepEqual(
    { ...regex.exec(info)?.groups },
    {
      timestamp: '2026-11-18T21:34:05Z',
      severity: 'INFO',
      service: 'billing',
      event: 'invoice.created',
      traceId: '4A92D61F',
      durationMs: '19',
      context: undefined,
    },
  );
  assert.deepEqual(
    { ...regex.exec(error)?.groups },
    {
      timestamp: '2026-11-18T21:35:11Z',
      severity: 'ERROR',
      service: 'payments',
      event: 'charge.failed',
      traceId: '9B4E283C',
      durationMs: undefined,
      context: undefined,
    },
  );
  assert.equal(regex.exec(`${error} context=api`)?.groups.context, 'api');
  const both = regex.exec(`${info} context=batch-web`)?.groups;
  assert.equal(both?.durationMs, '19');
  assert.equal(both?.context, 'batch-web');
  assert.ok(regex.test(info.replace('2026-11-18', '2026-02-30')));
  assert.ok(regex.test(info.replace('billing', 'a'.repeat(16))));
});

test('base and extended log formats reject malformed or partially matching records', () => {
  const base = compile(buildEventLog());
  const extended = compile(buildEventLog(extendedLogFormat));
  for (const input of [
    info.replace('INFO', 'NOTICE'),
    info.replace('21:34:05', '21:34'),
    info.replace(' trace=4A92D61F', ''),
    info.replace(
      'service=billing event=invoice.created',
      'event=invoice.created service=billing',
    ),
    info.replace('billing', 'a'.repeat(17)),
    info.replace('billing', 'pay_ments'),
    info.replace('invoice', 'Invoice'),
    info.replace('4A92D61F', '4a92d61f'),
    info.replace('duration_ms=19', 'duration_ms=12345678'),
    `${error} context=${'a'.repeat(13)}`,
    `${error} context=api duration_ms=19`,
    `${info} extra=1`,
    `${info}\n`,
    `prefix ${info}`,
  ]) {
    assert.equal(base.exec(input), null, input);
    assert.equal(extended.exec(input), null, input);
  }
  for (const line of [
    info,
    error,
    `${error} context=api`,
    `${info} context=batch-web`,
  ]) {
    assert.deepEqual(
      { ...extended.exec(line)?.groups },
      { ...base.exec(line)?.groups, requestId: undefined },
    );
  }
  const traceLine = info.replace('INFO', 'TRACE');
  const withId = `${traceLine} context=web request_id=AB12CD34`;
  assert.equal(base.exec(traceLine), null);
  assert.equal(base.exec(`${info} request_id=AB12CD34`), null);
  assert.equal(extended.exec(traceLine)?.groups.severity, 'TRACE');
  assert.equal(extended.exec(withId)?.groups.requestId, 'AB12CD34');
  assert.equal(extended.exec(`${traceLine} request_id=ABC`), null);
});

test('route factories preserve shared captures and dispatch by method', () => {
  const catalog = compileRoutes(routes, compile);
  const base = compileRoutes(baseRoutes, compile);
  const collection = catalog.find(({ name }) => name === 'listEvents');
  const expectedFields = {
    version: '2',
    organization: 'acme',
    project: 'PRJ-0042',
  };
  assert.deepEqual(
    { ...collection.regex.exec(`${project}/events`)?.groups },
    expectedFields,
  );
  assert.equal(collection.regex.exec(`${project}/events/EVT-1907`), null);
  assert.equal(baseRoutes[1].pattern, baseRoutes[2].pattern);

  for (const [method, path, name] of [
    ['GET', project, 'getProject'],
    ['GET', `${project}/events`, 'listEvents'],
    ['POST', `${project}/events`, 'createEvent'],
  ]) {
    for (const entries of [base, catalog]) {
      const selected = selectRoute(entries, method, path);
      assert.equal(selected?.name, name, path);
      assert.deepEqual({ ...selected.fields }, expectedFields);
    }
  }
  const detail = `${project}/events/EVT-1907`;
  const selected = selectRoute(catalog, 'GET', detail);
  assert.equal(selected?.name, 'getEvent');
  assert.deepEqual(
    { ...selected.fields },
    { ...expectedFields, event: 'EVT-1907' },
  );
  assert.equal(selectRoute(base, 'GET', detail), null);
  assert.equal(
    selectRoute(catalog, 'GET', project.replace('v2', 'v3'))?.fields.version,
    '3',
  );
});

test('the route catalog rejects invalid paths and reports overlaps regardless of order', () => {
  const catalog = compileRoutes(routes, compile);
  for (const [method, path] of [
    ['GET', project.replace('v2', 'v1')],
    ['GET', project.replace('v2', 'v02')],
    ['GET', project.replace('acme', '')],
    ['GET', project.replace('acme', '2acme')],
    ['GET', project.replace('acme', 'a'.repeat(32))],
    ['GET', project.replace('acme', '%61cme')],
    ['GET', project.replace('PRJ-', 'PROJ-')],
    ['GET', `${project}/events/EVT-19`],
    ['GET', `${project}/events/evt-1907`],
    ['GET', `${project}/events/EVT-1907/extra`],
    ['GET', `${project}/events/`],
    ['GET', `${project}/events?limit=10`],
    ['GET', `${project}\n`],
    ['GET', `prefix${project}`],
    ['POST', project],
  ])
    assert.equal(selectRoute(catalog, method, path), null, `${method} ${path}`);

  const ambiguous = compileRoutes(
    [...routes, { ...baseRoutes[1], name: 'listEventsAgain' }],
    compile,
  );
  for (const entries of [ambiguous, [...ambiguous].reverse()]) {
    assert.throws(
      () => selectRoute(entries, 'GET', `${project}/events`),
      /Ambiguous routes/,
    );
    assert.equal(
      selectRoute(entries, 'POST', `${project}/events`)?.name,
      'createEvent',
    );
  }
});

test('import record variants capture their fields and accept identifier boundaries', () => {
  const base = compileRecords(baseFormats, compile);
  const updated = compileRecords(formats, compile);
  for (const catalog of [base, updated]) {
    assert.deepEqual(
      { ...matchRecord(catalog, payment) },
      {
        kind: 'PAY',
        date: '2026-11-18',
        currency: 'USD',
        sourceAccount: 'acct-4821',
        amount: '125.50',
        reference: 'ref-7F3A',
      },
    );
    assert.deepEqual(
      { ...matchRecord(catalog, transfer) },
      {
        kind: 'TRANSFER',
        date: '2026-11-18',
        currency: 'USD',
        sourceAccount: 'acct-4821',
        amount: '500.00',
        reference: 'ref-7F3C',
        destinationAccount: 'acct-7351',
      },
    );
    assert.equal(matchRecord(catalog, refund)?.kind, 'REFUND');
    assert.equal(matchRecord(catalog, refund)?.metadata, undefined);
    assert.equal(
      matchRecord(catalog, payment.replace('USD', 'EUR'))?.currency,
      'EUR',
    );
    assert.equal(
      matchRecord(catalog, transfer.replace('USD', 'GBP'))?.currency,
      'GBP',
    );
    const atLimit = matchRecord(
      catalog,
      payment.replace('4821', '12345678').replace('7F3A', '7F3ABCDE'),
    );
    assert.equal(atLimit?.sourceAccount, 'acct-12345678');
    assert.equal(atLimit?.reference, 'ref-7F3ABCDE');
  }
  const withMetadata = `${refund}|meta=web-2`;
  const withGbp = payment.replace('USD', 'GBP');
  assert.equal(matchRecord(base, withMetadata), null);
  assert.equal(matchRecord(base, withGbp), null);
  assert.equal(matchRecord(updated, withMetadata)?.metadata, 'web-2');
  assert.equal(matchRecord(updated, withGbp)?.currency, 'GBP');
});

test('record patterns reject malformed fields and enforce destination and metadata policy', () => {
  const catalog = compileRecords(formats, compile);
  for (const input of [
    payment.replace('PAY', 'CHARGEBACK'),
    refund.replace('USD', 'EUR'),
    payment.replace('125.50', '125.5'),
    payment.replace('125.50', '-125.50'),
    payment.replace('125.50', '125,50'),
    payment.replace('125.50', '123456789.00'),
    payment.replace('|USD|', ';USD|'),
    payment.replace('acct-4821', ''),
    payment.replace('acct-4821', 'acct-123456789'),
    payment.replace('acct-4821', 'acct-48|21'),
    payment.replace('acct-4821', 'acct-48\\|21'),
    payment.replace('7F3A', '7f3Z'),
    transfer.replace('|to=acct-7351', ''),
    `${payment}|to=acct-7351`,
    `${payment}|meta=web-2`,
    `${refund}|meta=abcdefghijklm`,
    `${refund}|meta=`,
    `${refund}|meta=web|2`,
    `${payment}|extra=1`,
    `${payment}|`,
    `${payment}\n`,
    `prefix${payment}`,
  ])
    assert.equal(matchRecord(catalog, input), null, input);
});

test('calendar validity and amount positivity belong to domain validation', () => {
  const catalog = compileRecords(formats, compile);
  const matched = matchRecord(catalog, payment);
  assert.deepEqual(parseRecordValues(matched.date, matched.amount), {
    date: '2026-11-18',
    minorUnits: 12550n,
  });
  const impossible = matchRecord(catalog, payment.replace('11-18', '02-30'));
  assert.equal(impossible.date, '2026-02-30');
  assert.throws(
    () => parseRecordValues(impossible.date, impossible.amount),
    /Invalid calendar date/,
  );
  const zero = matchRecord(catalog, payment.replace('125.50', '0.00'));
  assert.equal(zero.amount, '0.00');
  assert.throws(
    () => parseRecordValues(zero.date, zero.amount),
    /Amount must be positive/,
  );
});
