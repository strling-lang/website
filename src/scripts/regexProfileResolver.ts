import type { ProfileReleaseIdentity } from '@/lib/regex-conformance/contracts';
import {
  answerProfileQuestion,
  resolveProfiles,
  selectedProfileSummary,
  type ProfileResolverState,
} from '@/lib/regex-profiles';

export class RegexProfileResolverElement extends HTMLElement {
  #profiles: ProfileReleaseIdentity[] = [];
  #selected: ProfileReleaseIdentity[] = [];
  #resolverState: ProfileResolverState | null = null;
  #answerOrder: string[] = [];
  #dialog: HTMLDialogElement | null = null;

  get selectedProfiles(): readonly ProfileReleaseIdentity[] {
    return this.#selected;
  }

  connectedCallback(): void {
    this.#dialog = this.querySelector('[data-profile-dialog]');
    this.querySelector('[data-profile-open]')?.addEventListener('click', () =>
      this.open(),
    );
    this.querySelector('[data-profile-close]')?.addEventListener('click', () =>
      this.#dialog?.close(),
    );
    this.querySelector('[data-profile-done]')?.addEventListener('click', () =>
      this.#dialog?.close(),
    );
    this.querySelector('[data-profile-back]')?.addEventListener('click', () =>
      this.#back(),
    );
    const dialog = this.#dialog;
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  setProfiles(
    profiles: readonly ProfileReleaseIdentity[],
    selectedProfileReleaseIds: readonly string[] = [],
  ): void {
    this.#profiles = [...profiles];
    const requested = new Set(selectedProfileReleaseIds);
    this.#selected = this.#profiles.filter((profile) =>
      requested.has(profile.profileReleaseId),
    );
    if (this.#selected.length === 0 && this.#profiles[0]) {
      this.#selected = [this.#profiles[0]];
    }
    if (!this.multiple && this.#selected.length > 1) {
      this.#selected = this.#selected.slice(0, 1);
    }
    this.#renderSummary();
  }

  selectProfiles(profileReleaseIds: readonly string[]): void {
    this.setProfiles(this.#profiles, profileReleaseIds);
    this.#dispatchSelection();
  }

  open(): void {
    if (this.#profiles.length === 0 || !this.#dialog) return;
    this.#answerOrder = [];
    this.#resolverState = resolveProfiles(this.#availableProfiles());
    this.#renderQuestion();
    this.#dialog.showModal();
  }

  get multiple(): boolean {
    return this.dataset.multiple === 'true';
  }

  #availableProfiles(): ProfileReleaseIdentity[] {
    if (!this.multiple) return this.#profiles;
    const selected = new Set(
      this.#selected.map((profile) => profile.profileReleaseId),
    );
    const remaining = this.#profiles.filter(
      (profile) => !selected.has(profile.profileReleaseId),
    );
    return remaining.length > 0 ? remaining : this.#profiles;
  }

  #back(): void {
    if (!this.#resolverState || this.#answerOrder.length === 0) return;
    const dimensionId = this.#answerOrder.pop();
    if (!dimensionId) return;
    const selections = { ...this.#resolverState.selections };
    delete selections[dimensionId];
    this.#resolverState = resolveProfiles(
      this.#availableProfiles(),
      selections,
    );
    this.#renderQuestion();
  }

  #answer(valueId: string): void {
    if (!this.#resolverState?.nextQuestion) return;
    this.#answerOrder.push(this.#resolverState.nextQuestion.dimensionId);
    this.#resolverState = answerProfileQuestion(
      this.#availableProfiles(),
      this.#resolverState,
      valueId,
    );
    if (this.#resolverState.resolvedProfile) {
      this.#choose(this.#resolverState.resolvedProfile);
      return;
    }
    this.#renderQuestion();
  }

  #choose(profile: ProfileReleaseIdentity): void {
    if (this.multiple) {
      const selected = new Map(
        this.#selected.map((item) => [item.profileReleaseId, item]),
      );
      selected.set(profile.profileReleaseId, profile);
      this.#selected = [...selected.values()];
    } else {
      this.#selected = [profile];
    }
    this.#renderSummary();
    this.#dispatchSelection();
    if (this.multiple && this.#selected.length < this.#profiles.length) {
      this.#answerOrder = [];
      this.#resolverState = resolveProfiles(this.#availableProfiles());
      this.#renderQuestion();
    } else {
      this.#dialog?.close();
    }
  }

  #remove(profileReleaseId: string): void {
    this.#selected = this.#selected.filter(
      (profile) => profile.profileReleaseId !== profileReleaseId,
    );
    if (this.#selected.length === 0 && !this.multiple && this.#profiles[0]) {
      this.#selected = [this.#profiles[0]];
    }
    this.#renderSummary();
    this.#dispatchSelection();
  }

  #dispatchSelection(): void {
    this.dispatchEvent(
      new CustomEvent('profile-selection-change', {
        bubbles: true,
        detail: { profiles: [...this.#selected] },
      }),
    );
  }

  #renderSummary(): void {
    const name = this.querySelector('[data-profile-name]');
    const path = this.querySelector('[data-profile-path]');
    const open = this.querySelector<HTMLButtonElement>('[data-profile-open]');
    const details = this.querySelector<HTMLElement>('[data-profile-details]');
    const selectedContainer = this.querySelector<HTMLElement>(
      '[data-profile-selected]',
    );
    const technical = this.querySelector<HTMLElement>(
      '[data-profile-technical]',
    );
    const done = this.querySelector<HTMLButtonElement>('[data-profile-done]');
    const dialogTitle = this.querySelector<HTMLElement>(
      '[data-profile-dialog-title]',
    );
    if (open) open.disabled = this.#profiles.length === 0;
    if (done) done.hidden = !this.multiple;
    if (dialogTitle) {
      dialogTitle.textContent = this.multiple
        ? 'Add comparison environment'
        : 'Change environment';
    }
    if (!name || !path || !details || !technical || !selectedContainer) return;

    if (this.#profiles.length === 0) {
      name.textContent = 'No certified profile available';
      path.textContent = 'Waiting for an eligible Conformance checkpoint.';
      details.hidden = true;
      selectedContainer.hidden = true;
      return;
    }

    if (this.multiple) {
      name.textContent =
        this.#selected.length === 0
          ? 'Choose environments'
          : `${this.#selected.length} exact environment${this.#selected.length === 1 ? '' : 's'}`;
      path.textContent =
        this.#selected.length === 0
          ? 'No comparison environments selected.'
          : 'Comparison uses only the exact profiles shown below.';
      selectedContainer.replaceChildren();
      for (const profile of this.#selected) {
        const chip = document.createElement('span');
        chip.className = 'profile-selected-chip';
        const chipLabel = document.createElement('span');
        chipLabel.textContent = selectedProfileSummary(profile);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove ${profile.displayName}`);
        remove.addEventListener('click', () =>
          this.#remove(profile.profileReleaseId),
        );
        chip.append(chipLabel, remove);
        selectedContainer.append(chip);
      }
      selectedContainer.hidden = this.#selected.length === 0;
    } else {
      const profile = this.#selected[0];
      name.textContent = profile?.displayName ?? 'Choose an exact environment';
      path.textContent = profile
        ? selectedProfileSummary(profile)
        : 'Choose an exact profile to continue.';
      selectedContainer.hidden = true;
    }

    technical.replaceChildren();
    for (const profile of this.#selected) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = profile.displayName;
      const value = document.createElement('dd');
      const code = document.createElement('code');
      code.textContent = `${profile.profileReleaseId} · ${profile.technicalLabel}`;
      value.append(code);
      group.append(term, value);
      technical.append(group);
    }
    details.hidden = this.#selected.length === 0;
  }

  #renderQuestion(): void {
    const state = this.#resolverState;
    const question = this.querySelector<HTMLElement>('[data-profile-question]');
    const answers = this.querySelector<HTMLElement>('[data-profile-answers]');
    const back = this.querySelector<HTMLButtonElement>('[data-profile-back]');
    if (!state || !question || !answers || !back) return;
    question.replaceChildren();
    answers.replaceChildren();
    back.disabled = this.#answerOrder.length === 0;

    for (const dimensionId of this.#answerOrder) {
      const valueId = state.selections[dimensionId];
      const profile = state.candidates[0];
      const dimension = profile?.dimensions.find(
        (item) => item.dimensionId === dimensionId && item.valueId === valueId,
      );
      if (!dimension) continue;
      const answer = document.createElement('span');
      answer.className = 'profile-answer-chip';
      answer.textContent = dimension.valueLabel;
      answers.append(answer);
    }
    for (const implied of state.impliedAnswers) {
      const answer = document.createElement('span');
      answer.className = 'profile-answer-chip profile-answer-chip--implied';
      answer.textContent = implied.valueLabel;
      answer.title = 'Already determined by earlier choices';
      answers.append(answer);
    }

    if (state.nextQuestion) {
      const heading = document.createElement('h3');
      heading.textContent = state.nextQuestion.question;
      const options = document.createElement('div');
      options.className = 'profile-question-options';
      for (const option of state.nextQuestion.options) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'profile-question-option';
        button.textContent = option.valueLabel;
        button.addEventListener('click', () => this.#answer(option.valueId));
        options.append(button);
      }
      question.append(heading, options);
      return;
    }

    const message = document.createElement('p');
    message.className = 'tool-empty-message';
    message.textContent =
      state.ambiguousProfiles.length > 0
        ? 'These profiles cannot be distinguished with the supplied metadata.'
        : 'No additional environment is available.';
    question.append(message);
  }
}

if (!customElements.get('regex-profile-resolver')) {
  customElements.define('regex-profile-resolver', RegexProfileResolverElement);
}
