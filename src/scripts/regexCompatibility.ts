import {
  buildCompatibilityRows,
  compatibilityCoverage,
  compatibilityEvidenceDetails,
  compatibilityStatePresentation,
  filterCompatibilityRows,
  type CompatibilityCatalogFeature,
  type CompatibilityCell,
  type CompatibilityFeatureRow,
} from '@/lib/regex-compatibility';
import type {
  NormalizedCompatibilityFinding,
  NormalizedCompatibilityProfile,
} from '@/lib/regex-conformance/contracts';

import type { RegexProfileResolverElement } from './regexProfileResolver';

interface CompatibilityCategory {
  categoryId: string;
  name: string;
}

interface CompatibilityHydrationState {
  lastConsumedCheckpoint: string | null;
  lastConsumedSequence: number | null;
  profiles: NormalizedCompatibilityProfile[];
  findings: NormalizedCompatibilityFinding[];
  catalog: CompatibilityCatalogFeature[];
  categories: CompatibilityCategory[];
}

type CompatibilityMode = 'single' | 'comparison';

function definitionListRow(
  termText: string,
  value: Node | string,
): HTMLDivElement {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = termText;
  const description = document.createElement('dd');
  description.append(
    typeof value === 'string' ? document.createTextNode(value) : value,
  );
  row.append(term, description);
  return row;
}

function code(value: string): HTMLElement {
  const element = document.createElement('code');
  element.textContent = value;
  return element;
}

function list(values: readonly string[], emptyLabel: string): HTMLElement {
  if (values.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = emptyLabel;
    return empty;
  }
  const result = document.createElement('ul');
  for (const value of values) {
    const item = document.createElement('li');
    const valueCode = document.createElement('code');
    valueCode.textContent = value;
    item.append(valueCode);
    result.append(item);
  }
  return result;
}

export class RegexCompatibilityElement extends HTMLElement {
  #state: CompatibilityHydrationState = {
    lastConsumedCheckpoint: null,
    lastConsumedSequence: null,
    profiles: [],
    findings: [],
    catalog: [],
    categories: [],
  };
  #selectedProfileReleaseIds: string[] = [];
  #mode: CompatibilityMode = 'single';
  #initialized = false;

  async connectedCallback(): Promise<void> {
    if (this.#initialized) return;
    this.#initialized = true;
    await customElements.whenDefined('regex-profile-resolver');
    this.#bindEvents();
    const stateScript = this.querySelector<HTMLScriptElement>(
      '[data-compatibility-state]',
    );
    if (stateScript?.textContent) {
      this.hydrate(
        JSON.parse(stateScript.textContent) as CompatibilityHydrationState,
      );
    }
  }

  hydrate(state: CompatibilityHydrationState): void {
    this.#state = structuredClone(state);
    this.#selectedProfileReleaseIds = state.profiles[0]
      ? [state.profiles[0].profileReleaseId]
      : [];
    const resolver = this.#resolver;
    resolver?.setProfiles(state.profiles, this.#selectedProfileReleaseIds);
    this.#renderCategories();
    this.#setLocked(state.profiles.length === 0);
    this.#render();
  }

  get #resolver(): RegexProfileResolverElement | null {
    return this.querySelector('regex-profile-resolver');
  }

  #bindEvents(): void {
    this.addEventListener('profile-selection-change', (event) => {
      const profiles = (
        event as CustomEvent<{ profiles: NormalizedCompatibilityProfile[] }>
      ).detail.profiles;
      this.#selectedProfileReleaseIds = profiles.map(
        (profile) => profile.profileReleaseId,
      );
      if (this.#mode === 'single') {
        this.#selectedProfileReleaseIds = this.#selectedProfileReleaseIds.slice(
          0,
          1,
        );
      }
      this.#render();
    });
    for (const radio of this.querySelectorAll<HTMLInputElement>(
      '[name="compatibility-mode"]',
    )) {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        this.#setMode(radio.value as CompatibilityMode);
      });
    }
    this.querySelector('[data-compatibility-search]')?.addEventListener(
      'input',
      () => this.#renderRows(),
    );
    this.querySelector('[data-compatibility-category]')?.addEventListener(
      'change',
      () => this.#renderRows(),
    );
    this.querySelector('[data-evidence-close]')?.addEventListener('click', () =>
      this.#evidenceDialog?.close(),
    );
    const dialog = this.#evidenceDialog;
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  get #evidenceDialog(): HTMLDialogElement | null {
    return this.querySelector('[data-evidence-dialog]');
  }

  #setMode(mode: CompatibilityMode): void {
    this.#mode = mode;
    const resolver = this.#resolver;
    if (!resolver) return;
    resolver.dataset.multiple = String(mode === 'comparison');
    if (mode === 'single') {
      this.#selectedProfileReleaseIds = this.#selectedProfileReleaseIds.slice(
        0,
        1,
      );
    }
    resolver.setProfiles(this.#state.profiles, this.#selectedProfileReleaseIds);
    this.#selectedProfileReleaseIds = resolver.selectedProfiles.map(
      (profile) => profile.profileReleaseId,
    );
    this.#render();
  }

  #setLocked(locked: boolean): void {
    const gate = this.querySelector<HTMLElement>('[data-compatibility-gate]');
    if (gate) gate.hidden = !locked;
    for (const input of this.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('[data-compatibility-control]')) {
      input.disabled = locked;
    }
  }

  #renderCategories(): void {
    const select = this.querySelector<HTMLSelectElement>(
      '[data-compatibility-category]',
    );
    if (!select) return;
    const current = select.value;
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All feature categories';
    select.append(all);
    for (const category of this.#state.categories) {
      const option = document.createElement('option');
      option.value = category.categoryId;
      option.textContent = category.name;
      select.append(option);
    }
    select.value = current;
  }

  #selectedProfiles(): NormalizedCompatibilityProfile[] {
    const selected = new Set(this.#selectedProfileReleaseIds);
    return this.#state.profiles.filter((profile) =>
      selected.has(profile.profileReleaseId),
    );
  }

  #rows(): CompatibilityFeatureRow[] {
    return buildCompatibilityRows(
      this.#state.catalog,
      this.#state.profiles,
      this.#state.findings,
      this.#selectedProfileReleaseIds,
    );
  }

  #render(): void {
    const comparisonHint = this.querySelector<HTMLElement>(
      '[data-comparison-hint]',
    );
    if (comparisonHint) {
      const selectedCount = this.#selectedProfileReleaseIds.length;
      comparisonHint.hidden = this.#mode !== 'comparison' || selectedCount >= 2;
      comparisonHint.textContent =
        'Add at least one more exact environment to compare columns.';
    }
    this.#renderRows();
  }

  #renderRows(): void {
    const head = this.querySelector<HTMLTableSectionElement>(
      '[data-compatibility-head]',
    );
    const body = this.querySelector<HTMLTableSectionElement>(
      '[data-compatibility-body]',
    );
    const empty = this.querySelector<HTMLElement>('[data-compatibility-empty]');
    const live = this.querySelector<HTMLElement>('[data-compatibility-live]');
    const coverage = this.querySelector<HTMLElement>(
      '[data-compatibility-coverage]',
    );
    const search = this.querySelector<HTMLInputElement>(
      '[data-compatibility-search]',
    );
    const category = this.querySelector<HTMLSelectElement>(
      '[data-compatibility-category]',
    );
    if (!head || !body || !empty || !live || !coverage) return;

    const allRows = this.#rows();
    const rows = filterCompatibilityRows(
      allRows,
      search?.value ?? '',
      category?.value || null,
    );
    const profiles = this.#selectedProfiles();
    head.replaceChildren();
    body.replaceChildren();

    if (profiles.length === 0) {
      empty.hidden = false;
      empty.textContent =
        this.#state.profiles.length === 0
          ? 'Certified compatibility results are not yet available.'
          : 'Choose an exact environment to inspect compatibility.';
      coverage.textContent = 'No certified profile scope selected.';
      live.textContent = empty.textContent;
      return;
    }

    const headRow = document.createElement('tr');
    const featureHeading = document.createElement('th');
    featureHeading.scope = 'col';
    featureHeading.textContent = 'Semantic feature';
    headRow.append(featureHeading);
    for (const profile of profiles) {
      const heading = document.createElement('th');
      heading.scope = 'col';
      const name = document.createElement('span');
      name.textContent = profile.displayName;
      const release = document.createElement('code');
      release.textContent = profile.releaseId;
      heading.append(name, release);
      headRow.append(heading);
    }
    head.append(headRow);

    for (const row of rows) {
      const tableRow = document.createElement('tr');
      tableRow.dataset.featureId = row.feature.semanticFeatureId;
      const featureCell = document.createElement('th');
      featureCell.scope = 'row';
      const link = document.createElement('a');
      link.href = row.feature.route;
      link.textContent = row.feature.name;
      const identity = document.createElement('code');
      identity.textContent = row.feature.semanticFeatureId;
      const categoryName = document.createElement('span');
      categoryName.textContent = row.feature.categoryName;
      featureCell.append(link, identity, categoryName);
      tableRow.append(featureCell);
      for (const [index, cell] of row.cells.entries()) {
        const profile = profiles[index];
        if (!profile) continue;
        const value = document.createElement('td');
        value.append(this.#stateButton(row, cell, profile));
        tableRow.append(value);
      }
      body.append(tableRow);
    }

    empty.hidden = rows.length > 0;
    empty.textContent =
      rows.length === 0 ? 'No semantic features match these filters.' : '';
    const summary = compatibilityCoverage(allRows);
    coverage.textContent = `${summary.findingCount} certified finding${summary.findingCount === 1 ? '' : 's'} · ${summary.evidenceCount} with inspectable evidence · ${summary.absentCount} without a certified finding`;
    live.textContent = `${rows.length} of ${allRows.length} semantic features shown for ${profiles.length} environment${profiles.length === 1 ? '' : 's'}.`;
  }

  #stateButton(
    row: CompatibilityFeatureRow,
    cell: CompatibilityCell,
    profile: NormalizedCompatibilityProfile,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'compatibility-state-button';
    button.dataset.state = cell.state;
    button.dataset.findingOrigin = cell.origin;
    button.setAttribute(
      'aria-label',
      `${row.feature.name} in ${profile.displayName}: ${cell.stateLabel}. View evidence details.`,
    );
    const badge = document.createElement('span');
    badge.className = `compatibility-state compatibility-state--${compatibilityStatePresentation[cell.state].tone}`;
    badge.textContent = cell.stateLabel;
    const availability = document.createElement('span');
    availability.className = 'compatibility-evidence-availability';
    availability.textContent =
      cell.evidenceAvailability === 'available'
        ? 'Evidence available'
        : cell.origin === 'absent'
          ? 'No certified finding'
          : 'Evidence not provided';
    button.append(badge, availability);
    button.addEventListener('click', () =>
      this.#openEvidence(row, cell, profile),
    );
    return button;
  }

  #openEvidence(
    row: CompatibilityFeatureRow,
    cell: CompatibilityCell,
    profile: NormalizedCompatibilityProfile,
  ): void {
    const dialog = this.#evidenceDialog;
    const title = this.querySelector<HTMLElement>('[data-evidence-title]');
    const subtitle = this.querySelector<HTMLElement>(
      '[data-evidence-subtitle]',
    );
    const detailsList = this.querySelector<HTMLDListElement>(
      '[data-evidence-details]',
    );
    if (!dialog || !title || !subtitle || !detailsList) return;
    const details = compatibilityEvidenceDetails(row, cell, profile);
    title.textContent = details.feature.name;
    subtitle.textContent = `${details.stateLabel} · ${details.profile.displayName}`;
    detailsList.replaceChildren(
      definitionListRow('Compatibility state', details.stateLabel),
      definitionListRow('Explanation', details.explanation),
      definitionListRow(
        'Conditions',
        list(details.conditions, 'None recorded.'),
      ),
      definitionListRow(
        'Exact profile',
        code(details.profile.profileReleaseId),
      ),
      definitionListRow('Profile identity', code(details.profile.profileId)),
      definitionListRow('Release', code(details.profile.releaseId)),
      definitionListRow(
        'Runtime identity',
        code(details.profile.technicalLabel),
      ),
      definitionListRow(
        'Semantic feature ID',
        code(details.feature.semanticFeatureId),
      ),
      definitionListRow('Feature category', details.feature.categoryName),
      definitionListRow(
        'Tested operation / mode / options',
        details.testedScope
          ? code(JSON.stringify(details.testedScope))
          : 'No tested scope recorded.',
      ),
      definitionListRow(
        'Evidence availability',
        details.evidenceAvailability === 'available'
          ? 'Inspectable evidence reference is available.'
          : 'No inspectable evidence reference was provided.',
      ),
      definitionListRow(
        'Evidence reference',
        details.evidence ? code(details.evidence.reference) : 'Not available.',
      ),
      definitionListRow(
        'Evidence digest',
        details.evidence ? code(details.evidence.digest) : 'Not available.',
      ),
      definitionListRow(
        'Conformance checkpoint',
        details.checkpointId ? code(details.checkpointId) : 'Not available.',
      ),
      definitionListRow(
        'Semantic snapshot',
        details.sourceSemanticSnapshot
          ? code(
              `${details.sourceSemanticSnapshot.snapshotId} · ${details.sourceSemanticSnapshot.digest}`,
            )
          : 'Not available.',
      ),
      definitionListRow(
        'Evidence manifest',
        details.evidenceManifest
          ? code(
              `${details.evidenceManifest.path} · ${details.evidenceManifest.digest}`,
            )
          : 'Not available.',
      ),
      definitionListRow(
        'Observation references',
        list(details.evidence?.observationReferences ?? [], 'Not available.'),
      ),
      definitionListRow(
        'Derived finding references',
        list(
          details.evidence?.derivedFindingReferences ?? [],
          'Not available.',
        ),
      ),
    );
    dialog.showModal();
  }
}

if (!customElements.get('regex-compatibility')) {
  customElements.define('regex-compatibility', RegexCompatibilityElement);
}
