import { useState, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isDestructive?: boolean;
    confirmText?: string;
  }>({
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const confirm = useCallback((
    title: string,
    description: string,
    onConfirm: () => void,
    options?: { isDestructive?: boolean; confirmText?: string; onCancel?: () => void }
  ) => {
    setConfig({
      title,
      description,
      onConfirm,
      onCancel: options?.onCancel,
      isDestructive: options?.isDestructive ?? false,
      confirmText: options?.confirmText ?? 'Đồng ý',
    });
    setIsOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    if (config.onCancel) config.onCancel();
    setIsOpen(false);
  }, [config]);

  const handleConfirm = useCallback(() => {
    config.onConfirm();
    setIsOpen(false);
  }, [config]);

  const ConfirmComponent = useCallback(() => (
    <ConfirmDialog
      isOpen={isOpen}
      title={config.title}
      description={config.description}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      isDestructive={config.isDestructive}
      confirmText={config.confirmText}
    />
  ), [isOpen, config, handleConfirm, handleCancel]);

  return { confirm, ConfirmComponent };
}
