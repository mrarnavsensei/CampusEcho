'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  message?: string;
  trigger?: React.ReactNode;
  onCancel?: () => void;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  message,
  trigger,
  onCancel,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(!trigger);
  const [error, setError] = useState('');
  const isLoading = loading || internalLoading;
  const dialogOpen = open ?? internalOpen;
  const setDialogOpen = onOpenChange ?? ((next: boolean) => { setInternalOpen(next); if (!next) onCancel?.(); });

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    try {
      setInternalLoading(true);
      await onConfirm();
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The action could not be completed.');
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <>
      {trigger && <span onClick={() => setDialogOpen(true)}>{trigger}</span>}
    <AlertDialog open={dialogOpen} onOpenChange={isLoading ? undefined : setDialogOpen}>
      <AlertDialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[#A3A3A3]">
            {description ?? message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel 
            disabled={isLoading}
            className="bg-transparent border-[#2A2A2A] text-white hover:bg-[#202020] hover:text-white focus:ring-0"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "focus:ring-0 transition-colors",
              destructive 
                ? "bg-[#E50914] hover:bg-[#ff0a16] text-white" 
                : "bg-white text-black hover:bg-[#e5e5e5]"
            )}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
