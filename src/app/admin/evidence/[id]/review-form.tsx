'use client'

import { useActionState } from 'react'
import { ControllerSelect } from '@/components/controller-select'
import type { EvidenceDetail } from '@/lib/data/admin'
import type { ControllerFamily, Game } from '@/lib/data/public'
import {
  ANDROID_VERSIONS,
  CONNECTION_LABELS,
  CONNECTION_TYPES,
  CONTROL_LABELS,
  CONTROLS,
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
} from '@/lib/domain'
import { FieldError } from '@/components/field-error'
import type { FormState } from '../../actions'

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>
  source: EvidenceDetail
  games: Game[]
  families: ControllerFamily[]
}

export function ReviewForm({ action, source, games, families }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null)
  const errors = state?.errors ?? {}
  const values = state?.values
  const claimResult = (c: string) => source.claims.find((x) => x.control === c)?.result ?? ''
  const initial: Record<string, string> = values ?? {
    isReport: source.isReport === null ? '' : source.isReport ? 'yes' : 'no',
    sourceType: source.sourceType,
    title: source.title ?? '',
    publishedOn: source.publishedOn ?? '',
    gameId: source.gameId ?? '',
    controller: source.controllerVariantId
      ? `variant:${source.controllerVariantId}`
      : source.controllerFamilyId
        ? `family:${source.controllerFamilyId}`
        : '',
    controllerAsWritten: source.controllerAsWritten ?? '',
    deviceAsWritten: source.deviceAsWritten ?? '',
    deviceModel: source.deviceModelCode ?? '',
    androidVersion: source.androidVersion ?? '',
    gameVersion: source.gameVersion ?? '',
    connection: source.connectionType ?? '',
    controllerMode: source.controllerMode ?? '',
    claimSummary: source.claimSummary ?? '',
    reviewNotes: source.reviewNotes ?? '',
    duplicateOf: source.duplicateOfUrl ?? '',
    ...Object.fromEntries(CONTROLS.map((c) => [`result_${c}`, claimResult(c)])),
  }
  const v = (k: string) => initial[k] ?? ''
  const inv = (k: string) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `r-${k}-error` } : {})
  const errorList = Object.entries(errors)

  return (
    <form key={state?.attempt ?? 0} action={formAction} className="form" noValidate aria-busy={pending}>
      {errorList.length > 0 && (
        <div className="error-summary" role="alert">
          <strong>Not saved</strong>
          <ul>
            {errorList.map(([k, msg]) => (
              <li key={k}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset>
        <legend>Is this a report?</legend>
        <div className="options" role="radiogroup" aria-describedby="isReport-hint">
          <label>
            <input type="radio" name="isReport" value="yes" defaultChecked={v('isReport') === 'yes'} /> Yes, someone describes
            what happened when they played
          </label>
          <label>
            <input type="radio" name="isReport" value="no" defaultChecked={v('isReport') === 'no'} /> No, it’s a question or
            general discussion
          </label>
          <label>
            <input type="radio" name="isReport" value="" defaultChecked={v('isReport') === ''} /> Not assessed yet
          </label>
        </div>
        <p id="isReport-hint" className="hint">
          Only reports can be published. A question like “Does DualSense work?” is never evidence.
        </p>
        <FieldError id="r-isReport-error" message={errors.isReport} />
      </fieldset>

      <fieldset>
        <legend>Source</legend>
        <div className="field-row">
          <div className="field">
            <label htmlFor="r-title">Title</label>
            <input id="r-title" name="title" type="text" maxLength={300} defaultValue={v('title')} />
          </div>
          <div className="field">
            <label htmlFor="r-type">Source type</label>
            <select id="r-type" name="sourceType" defaultValue={v('sourceType')}>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SOURCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-published">Published or observed on</label>
            <input id="r-published" name="publishedOn" type="date" defaultValue={v('publishedOn')} {...inv('publishedOn')} />
            <FieldError id="r-publishedOn-error" message={errors.publishedOn} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>What the source says</legend>
        <p className="hint">Record only what the source states. Leave a field empty when it isn’t stated.</p>
        <div className="field-row">
          <div className="field">
            <label htmlFor="r-game">Game</label>
            <select id="r-game" name="gameId" defaultValue={v('gameId')} {...inv('gameId')}>
              <option value="">Not identified</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <FieldError id="r-gameId-error" message={errors.gameId} />
          </div>
          <div className="field">
            <label htmlFor="r-version">Game version</label>
            <input id="r-version" name="gameVersion" type="text" defaultValue={v('gameVersion')} placeholder="e.g. 2.8.1" {...inv('gameVersion')} />
            <p className="hint">Never “latest”. Leave empty unless an exact version is stated.</p>
            <FieldError id="r-gameVersion-error" message={errors.gameVersion} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="r-written">Controller, as written in the source</label>
            <input id="r-written" name="controllerAsWritten" type="text" maxLength={160} defaultValue={v('controllerAsWritten')} placeholder="e.g. 8BitDo Ultimate" />
          </div>
          <div className="field">
            <label htmlFor="r-controller">Controller in catalog</label>
            <ControllerSelect
              id="r-controller"
              name="controller"
              families={families}
              defaultValue={v('controller')}
              emptyLabel="Not identified"
              describedBy={errors.controller ? 'r-controller-error' : 'r-controller-hint'}
              invalid={Boolean(errors.controller)}
            />
            <p id="r-controller-hint" className="hint">
              Choose a model only if the source names the exact product. Otherwise pick “model not specified”.
            </p>
            <FieldError id="r-controller-error" message={errors.controller} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="r-conn">Connection</label>
            <select id="r-conn" name="connection" defaultValue={v('connection')}>
              <option value="">Not stated</option>
              {CONNECTION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {CONNECTION_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-mode">Controller mode</label>
            <input id="r-mode" name="controllerMode" type="text" maxLength={60} defaultValue={v('controllerMode')} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="r-device">Device, as written</label>
            <input id="r-device" name="deviceAsWritten" type="text" maxLength={160} defaultValue={v('deviceAsWritten')} />
          </div>
          <div className="field">
            <label htmlFor="r-model">Device model number</label>
            <input id="r-model" name="deviceModel" type="text" maxLength={40} defaultValue={v('deviceModel')} {...inv('deviceModel')} />
            <FieldError id="r-deviceModel-error" message={errors.deviceModel} />
          </div>
          <div className="field">
            <label htmlFor="r-android">Android version</label>
            <select id="r-android" name="androidVersion" defaultValue={v('androidVersion')}>
              <option value="">Not stated</option>
              {ANDROID_VERSIONS.map((a) => (
                <option key={a} value={a}>
                  Android {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Stated results</legend>
        {errors.results && <p className="error-text">{errors.results}</p>}
        <table className="result-grid">
          <thead>
            <tr>
              <th scope="col">Control</th>
              <th scope="col">Works</th>
              <th scope="col">Broken</th>
              <th scope="col">Not stated</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map((c) => (
              <tr key={c}>
                <th scope="row">{CONTROL_LABELS[c]}</th>
                {(['works', 'broken', ''] as const).map((r) => (
                  <td key={r || 'none'}>
                    <label>
                      <input
                        type="radio"
                        name={`result_${c}`}
                        value={r}
                        defaultChecked={v(`result_${c}`) === r}
                        aria-label={`${CONTROL_LABELS[c]}: ${r === '' ? 'Not stated' : r === 'works' ? 'Works' : 'Broken'}`}
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="field">
          <label htmlFor="r-claim">Reviewed claim (public)</label>
          <textarea
            id="r-claim"
            name="claimSummary"
            maxLength={280}
            defaultValue={v('claimSummary')}
            style={{ minHeight: '4rem' }}
            aria-describedby={errors.claimSummary ? 'r-claimSummary-error' : 'r-claim-hint'}
            aria-invalid={errors.claimSummary ? true : undefined}
          />
          <p id="r-claim-hint" className="hint">
            In your own words, one or two sentences. Don’t add details the source doesn’t give.
          </p>
          <FieldError id="r-claimSummary-error" message={errors.claimSummary} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Decision</legend>
        <div className="field">
          <label htmlFor="r-notes">Review notes (private)</label>
          <textarea id="r-notes" name="reviewNotes" maxLength={4000} defaultValue={v('reviewNotes')} />
        </div>
        <div className="field">
          <label htmlFor="r-dup">Original source, if this is a duplicate</label>
          <input
            id="r-dup"
            name="duplicateOf"
            type="text"
            defaultValue={v('duplicateOf')}
            placeholder="URL or inbox ID of the original"
            {...inv('duplicateOf')}
          />
          <FieldError id="r-duplicateOf-error" message={errors.duplicateOf} />
        </div>
        <div className="moderation-actions">
          <button className="button" type="submit" name="action" value="publish" disabled={pending}>
            Publish limited external claim
          </button>
          <button className="button secondary" type="submit" name="action" value="needs_direct_test" disabled={pending}>
            Needs direct test
          </button>
          <button className="button secondary" type="submit" name="action" value="lead" disabled={pending}>
            Keep as research lead
          </button>
          <button className="button secondary" type="submit" name="action" value="duplicate" disabled={pending}>
            Merge duplicate
          </button>
          <button className="button danger" type="submit" name="action" value="reject" disabled={pending}>
            Reject
          </button>
        </div>
        <p className="hint">
          Publishing and “Needs direct test” replace this source’s public claims. Every other decision removes them.
        </p>
      </fieldset>
    </form>
  )
}
