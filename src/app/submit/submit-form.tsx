'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import type { ControllerFamily } from '@/lib/data/public'
import {
  ANDROID_VERSIONS,
  CONNECTION_LABELS,
  CONNECTION_TYPES,
  CONTROLLER_MODE_SUGGESTIONS,
  CONTROL_LABELS,
  CONTROLS,
} from '@/lib/domain'
import { FieldError } from '@/components/field-error'
import { submitTest, type SubmitState } from './actions'

type Props = {
  games: { slug: string; name: string }[]
  families: ControllerFamily[]
  versions: Record<string, string[]>
  defaults: { game: string; controller: string }
  today: string
}

const RESULT_OPTION_LABELS = { works: 'Works', broken: 'Broken', not_tested: 'Not tested' } as const

const FIELD_ORDER = [
  'form',
  'game',
  'gameVersion',
  'controller',
  'controllerOther',
  'connection',
  'controllerMode',
  'deviceName',
  'deviceModel',
  'androidVersion',
  'results',
  ...CONTROLS.map((c) => `result_${c}`),
  'testedOn',
  'notes',
]

export function SubmitForm(props: Props) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitTest, { status: 'idle' })

  if (state.status === 'done') {
    const game = props.games.find((g) => g.slug === state.gameSlug)
    return (
      <div className="notice" role="status">
        <h2>Test received</h2>
        <p>
          It will appear on GameProbe after review.
          {state.reference && (
            <>
              {' '}
              Reference: <span className="nowrap">{state.reference.slice(0, 8)}</span>
            </>
          )}
        </p>
        <p>
          <a href="/submit">Submit another test</a>
          {game && (
            <>
              {' · '}
              <Link href={`/games/${game.slug}`}>Back to {game.name}</Link>
            </>
          )}
        </p>
      </div>
    )
  }

  const errors = state.status === 'error' ? state.errors : {}
  const values = state.status === 'error' ? state.values : {}
  // Remount after each failed attempt so fields show what was submitted.
  const key = state.status === 'error' ? state.attempt : 0
  return <TestForm key={key} {...props} action={action} pending={pending} errors={errors} values={values} />
}

function TestForm({
  games,
  families,
  versions,
  defaults,
  today,
  action,
  pending,
  errors,
  values,
}: Props & {
  action: (f: FormData) => void
  pending: boolean
  errors: Record<string, string>
  values: Record<string, string>
}) {
  const [game, setGame] = useState(values.game ?? defaults.game)
  const [controller, setController] = useState(values.controller ?? defaults.controller)
  const summaryRef = useRef<HTMLDivElement>(null)
  const errorKeys = FIELD_ORDER.filter((k) => errors[k])

  useEffect(() => {
    if (errorKeys.length > 0) summaryRef.current?.focus()
  }, [errorKeys.length])

  const err = (name: string) =>
    errors[name]
      ? { 'aria-invalid': true as const, 'aria-describedby': `${name}-error` }
      : ({} as Record<string, never>)
  const v = (name: string, fallback = '') => values[name] ?? fallback

  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      {errorKeys.length > 0 && (
        <div className="error-summary" ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="error-summary-title">
          <h2 id="error-summary-title">The test was not submitted</h2>
          <ul>
            {errorKeys.map((k) => (
              <li key={k}>
                {k === 'form' ? errors[k] : <a href={`#${k === 'results' ? 'result_menu' : k}`}>{errors[k]}</a>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset>
        <legend>Game</legend>
        <div className="field-row">
          <div className="field">
            <label htmlFor="game">Game</label>
            <select id="game" name="game" required value={game} onChange={(e) => setGame(e.target.value)} {...err('game')}>
              <option value="">Choose a game</option>
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
            <FieldError id="game-error" message={errors.game} />
          </div>
          <div className="field">
            <label htmlFor="gameVersion">Game version (optional)</label>
            <input
              id="gameVersion"
              name="gameVersion"
              type="text"
              inputMode="decimal"
              list="game-versions"
              defaultValue={v('gameVersion')}
              autoComplete="off"
              aria-describedby={errors.gameVersion ? 'gameVersion-error' : 'gameVersion-hint'}
              aria-invalid={errors.gameVersion ? true : undefined}
            />
            <datalist id="game-versions">
              {(versions[game] ?? []).map((ver) => (
                <option key={ver} value={ver} />
              ))}
            </datalist>
            <p id="gameVersion-hint" className="hint">
              Exactly as the game shows it, e.g. 2.8.1. Leave empty if you don’t know.
            </p>
            <FieldError id="gameVersion-error" message={errors.gameVersion} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Controller</legend>
        <div className="field">
          <label htmlFor="controller">Controller</label>
          <select
            id="controller"
            name="controller"
            required
            value={controller}
            onChange={(e) => setController(e.target.value)}
            {...err('controller')}
          >
            <option value="">Choose a controller</option>
            {families.map((f) => (
              <optgroup key={f.id} label={f.name}>
                <option value={`family:${f.id}`}>{f.name}, not sure which model</option>
                {f.variants.map((variant) => (
                  <option key={variant.id} value={`variant:${variant.id}`}>
                    {variant.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="other">Other (type the name below)</option>
          </select>
          <FieldError id="controller-error" message={errors.controller} />
        </div>
        {controller === 'other' && (
          <div className="field">
            <label htmlFor="controllerOther">Controller name</label>
            <input id="controllerOther" name="controllerOther" type="text" defaultValue={v('controllerOther')} {...err('controllerOther')} />
            <FieldError id="controllerOther-error" message={errors.controllerOther} />
          </div>
        )}
        <div className="field" role="group" aria-labelledby="connection-label">
          <span id="connection-label" className="label">
            Connection
          </span>
          <div className="options">
            {CONNECTION_TYPES.map((c) => (
              <label key={c}>
                <input type="radio" name="connection" value={c} defaultChecked={v('connection') === c} /> {CONNECTION_LABELS[c]}
              </label>
            ))}
            <label>
              <input type="radio" name="connection" value="" defaultChecked={!v('connection')} /> Not sure
            </label>
          </div>
          <FieldError id="connection-error" message={errors.connection} />
        </div>
        <div className="field">
          <label htmlFor="controllerMode">Controller mode (optional)</label>
          <input
            id="controllerMode"
            name="controllerMode"
            type="text"
            list="controller-modes"
            defaultValue={v('controllerMode')}
            aria-describedby={errors.controllerMode ? 'controllerMode-error' : 'controllerMode-hint'}
            aria-invalid={errors.controllerMode ? true : undefined}
          />
          <datalist id="controller-modes">
            {CONTROLLER_MODE_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <p id="controllerMode-hint" className="hint">
            Only if your controller has a mode switch and you know which one was set.
          </p>
          <FieldError id="controllerMode-error" message={errors.controllerMode} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Device</legend>
        <div className="field-row">
          <div className="field">
            <label htmlFor="deviceName">Phone or tablet (optional)</label>
            <input id="deviceName" name="deviceName" type="text" defaultValue={v('deviceName')} placeholder="e.g. Galaxy S25" {...err('deviceName')} />
            <FieldError id="deviceName-error" message={errors.deviceName} />
          </div>
          <div className="field">
            <label htmlFor="deviceModel">Model number (optional)</label>
            <input
              id="deviceModel"
              name="deviceModel"
              type="text"
              defaultValue={v('deviceModel')}
              placeholder="e.g. SM-S931B"
              aria-describedby={errors.deviceModel ? 'deviceModel-error' : 'deviceModel-hint'}
              aria-invalid={errors.deviceModel ? true : undefined}
            />
            <p id="deviceModel-hint" className="hint">
              Settings › About phone › Model
            </p>
            <FieldError id="deviceModel-error" message={errors.deviceModel} />
          </div>
          <div className="field">
            <label htmlFor="androidVersion">Android version</label>
            <select id="androidVersion" name="androidVersion" defaultValue={v('androidVersion')} {...err('androidVersion')}>
              <option value="">Not sure</option>
              {ANDROID_VERSIONS.map((a) => (
                <option key={a} value={a}>
                  Android {a}
                </option>
              ))}
            </select>
            <FieldError id="androidVersion-error" message={errors.androidVersion} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Results</legend>
        <p className="hint" id="results-hint">
          Mark each control you tried in the game. Leave the rest as Not tested.
        </p>
        {errors.results && (
          <p id="results-error" className="error-text">
            {errors.results}
          </p>
        )}
        <table className="result-grid" aria-describedby="results-hint">
          <thead>
            <tr>
              <th scope="col">Control</th>
              <th scope="col">Works</th>
              <th scope="col">Broken</th>
              <th scope="col">Not tested</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map((c) => {
              const current = v(`result_${c}`, 'not_tested')
              return (
                <tr key={c}>
                  <th scope="row">{CONTROL_LABELS[c]}</th>
                  {(['works', 'broken', 'not_tested'] as const).map((r) => (
                    <td key={r}>
                      <label>
                        <input
                          type="radio"
                          id={r === 'works' ? `result_${c}` : undefined}
                          name={`result_${c}`}
                          value={r}
                          defaultChecked={current === r}
                          aria-label={`${CONTROL_LABELS[c]}: ${RESULT_OPTION_LABELS[r]}`}
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </fieldset>

      <fieldset>
        <legend>Details</legend>
        <div className="field">
          <label htmlFor="testedOn">Test date</label>
          <input id="testedOn" name="testedOn" type="date" max={today} defaultValue={v('testedOn', today)} {...err('testedOn')} />
          <FieldError id="testedOn-error" message={errors.testedOn} />
        </div>
        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            name="notes"
            maxLength={2000}
            defaultValue={v('notes')}
            aria-describedby={errors.notes ? 'notes-error' : 'notes-hint'}
            aria-invalid={errors.notes ? true : undefined}
          />
          <p id="notes-hint" className="hint">
            What exactly happened, e.g. “RT does nothing in combat, works in menus”. Notes may be published.
          </p>
          <FieldError id="notes-error" message={errors.notes} />
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </fieldset>

      <div>
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit test'}
        </button>
      </div>
    </form>
  )
}
