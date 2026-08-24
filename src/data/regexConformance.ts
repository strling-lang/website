import { createEmptyConsumptionState } from '@/lib/regex-conformance/consumer';

// Production-safe starting state. A certified downstream checkpoint has not
// been consumed. Test fixtures live under tests/fixtures and are never imported
// by website source or included as public compatibility/profile truth.
export const regexConformanceState = createEmptyConsumptionState();
