import { createEmptyConsumptionState } from '@/lib/regex-conformance/consumer';
import type { SemanticSnapshotIdentity } from '@/lib/regex-conformance/contracts';

import { regexDocs } from './regexDocs';

export const regexConformanceSemanticSnapshot: SemanticSnapshotIdentity = {
  snapshotId: regexDocs.source.snapshotId,
  digest: `sha256:${regexDocs.source.semanticDigest}`,
};

// Production-safe starting state. A certified downstream checkpoint has not
// been consumed. Test fixtures live under tests/fixtures and are never imported
// by website source or included as public compatibility/profile truth.
export const regexConformanceState = createEmptyConsumptionState();
