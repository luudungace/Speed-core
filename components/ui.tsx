import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-panel p-6 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-primary/30 hover:shadow-[0_8px_32px_rgba(0,209,125,0.08)]",
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" && "bg-gradient-to-r from-primary to-secondary text-white shadow-[0_0_15px_rgba(0,209,125,0.25)] hover:shadow-[0_0_25px_rgba(0,209,125,0.45)] hover:brightness-110",
        variant === "ghost" && "border border-border bg-panel2 text-white hover:bg-panel hover:border-primary/30",
        variant === "danger" && "border border-red-950/70 bg-red-950/20 text-red-200 hover:bg-red-950/40 hover:border-red-500/30",
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
        "h-9 rounded-lg border border-border bg-panel2 px-3 text-sm text-white outline-none placeholder:text-muted/60 transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/25",
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
        "min-h-32 resize-y rounded-lg border border-border bg-panel2 px-3 py-3 font-mono text-sm text-white outline-none placeholder:text-muted/60 transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/25",
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
        "h-9 rounded-lg border border-border bg-panel2 px-3 text-sm text-white outline-none transition-all focus:border-primary/50",
        props.className,
      )}
    />
  );
}
