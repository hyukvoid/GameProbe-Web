import type { ControllerFamily } from '@/lib/data/public'

/** Catalog controller picker. Value encoding: "family:<id>", "variant:<id>" or "". */
export function ControllerSelect({
  id,
  name,
  families,
  defaultValue,
  emptyLabel,
  describedBy,
  invalid,
}: {
  id: string
  name: string
  families: ControllerFamily[]
  defaultValue: string
  emptyLabel: string
  describedBy?: string
  invalid?: boolean
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
      <option value="">{emptyLabel}</option>
      {families.map((f) => (
        <optgroup key={f.id} label={f.name}>
          <option value={`family:${f.id}`}>{f.name}, model not specified</option>
          {f.variants.map((v) => (
            <option key={v.id} value={`variant:${v.id}`}>
              {v.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
