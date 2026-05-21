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
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" && "bg-primary text-black hover:bg-emerald-400",
        variant === "ghost" && "border border-border bg-[#0b111b] text-white hover:bg-[#111b29]",
        variant === "danger" && "border border-red-900/70 bg-red-950/40 text-red-200 hover:bg-red-900/40",
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
        "h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none placeholder:text-muted focus:border-primary/70",
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
        "min-h-32 resize-y rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 py-3 font-mono text-sm text-white outline-none placeholder:text-muted focus:border-primary/70",
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
        "h-9 rounded-md border border-[#1f2b3a] bg-[#0d141d] px-3 text-sm text-white outline-none focus:border-primary/70",
        props.className,
      )}
    />
  );
}
