// Simple labeled form field. Supports a single-line input or a multiline
// textarea via the `textarea` prop. Large touch target, clear focus ring.
//
// A discriminated union on `textarea` keeps the typing exact: callers get
// input props when it's omitted and textarea props when it's `true`, so the
// onChange event element is always correct.

type BaseProps = { label: string; hint?: string };

type InputFieldProps = BaseProps & { textarea?: false } & React.ComponentProps<"input">;
type TextareaFieldProps = BaseProps & { textarea: true } & React.ComponentProps<"textarea">;
type FieldProps = InputFieldProps | TextareaFieldProps;

const inputBase =
  "w-full rounded-2xl border border-hairline bg-surface px-4 text-[16px] text-ink placeholder:text-muted/60 transition focus:border-pi-300 focus:outline-none focus:ring-4 focus:ring-pi-50";

export function Field(props: FieldProps) {
  if (props.textarea) {
    const { label, hint, textarea: _t, className, ...rest } = props;
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <textarea
          {...rest}
          className={`${inputBase} min-h-[96px] resize-y py-3 leading-relaxed ${className ?? ""}`}
        />
        {hint ? <span className="text-[12px] text-muted/80">{hint}</span> : null}
      </label>
    );
  }

  const { label, hint, textarea: _t, className, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <input {...rest} className={`${inputBase} h-14 py-3 ${className ?? ""}`} />
      {hint ? <span className="text-[12px] text-muted/80">{hint}</span> : null}
    </label>
  );
}
