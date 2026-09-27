/** Inline validation message. Its id is referenced by the field's aria-describedby. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={id} className="error">
      {message}
    </p>
  )
}
