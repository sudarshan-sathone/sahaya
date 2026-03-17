import { useState } from "react";

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="card">
      <button
        className="collapse-header"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <div className="collapse-header-left">
          <div className="collapse-title">{title}</div>
          {subtitle && <div className="collapse-subtitle">{subtitle}</div>}
        </div>
        <div className="collapse-icon">{open ? "▾" : "▸"}</div>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </section>
  );
}

