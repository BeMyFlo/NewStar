// src/components/ui/dialog.tsx
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const DialogContext = React.createContext<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>({});

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => onOpenChange?.(false)}
          />
          {children}
        </div>
      )}
    </DialogContext.Provider>
  );
};

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext);
  
  return (
    <div
      ref={ref}
      className={cn(
        "relative z-50 w-full max-w-lg border border-border bg-card p-6 shadow-lg duration-200 rounded-lg animate-in fade-in zoom-in-95 text-white",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left mb-4",
      className
    )}
    {...props}
  />
);

const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6",
      className
    )}
    {...props}
  />
);

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  onClose?: () => void;
}

const DialogTitle: React.FC<DialogTitleProps> = ({
  className,
  children,
  onClose,
  ...props
}) => {
  const { onOpenChange } = React.useContext(DialogContext);
  const handleClose = onClose || (() => onOpenChange?.(false));

  return (
    <div className="flex items-center justify-between w-full">
      <h2
        className={cn(
          "text-lg font-semibold leading-none tracking-tight text-white",
          className
        )}
        {...props}
      >
        {children}
      </h2>
      <button
        type="button"
        onClick={handleClose}
        className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none cursor-pointer p-1 text-zinc-400 hover:text-white"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
};

const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p
    className={cn("text-sm text-zinc-400 mt-1.5", className)}
    {...props}
  />
);

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
