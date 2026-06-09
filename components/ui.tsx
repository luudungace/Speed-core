import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-panel p-6", className)} {...props} />;
}

export function Button({
  className,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
        variant === "default" && "bg-brand-sky text-white hover:bg-brand-sky/85 shadow-md shadow-brand-sky/10 hover:shadow-brand-sky/20",
        variant === "ghost" && "border border-border bg-[#0b1220] text-white hover:bg-brand-navy/10 hover:border-brand-sky/40",
        variant === "danger" && "border border-red-900/70 bg-red-950/40 text-red-200 hover:bg-red-900/40 active:scale-95",
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 rounded-lg border border-[#1b283d] bg-[#080d17] px-3 text-sm text-white outline-none placeholder:text-muted/60 transition-all duration-200 focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/10",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-32 resize-y rounded-lg border border-[#1b283d] bg-[#080d17] px-3 py-3 font-mono text-sm text-white outline-none placeholder:text-muted/60 transition-all duration-200 focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/10",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 rounded-lg border border-[#1b283d] bg-[#080d17] px-3 text-sm text-white outline-none transition-all duration-200 focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/10",
        props.className,
      )}
    />
  );
}
