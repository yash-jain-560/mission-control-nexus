'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface ModalContextType {
  openModal: (id: string, content: React.ReactNode, options?: ModalOptions) => void;
  closeModal: (id?: string) => void;
  closeAllModals: () => void;
  getTopModalId: () => string | null;
  isModalOpen: (id: string) => boolean;
  getModalCount: () => number;
}

interface ModalOptions {
  /** Close when clicking outside the modal */
  closeOnOutsideClick?: boolean;
  /** Close when pressing ESC key */
  closeOnEsc?: boolean;
  /** Custom z-index */
  zIndex?: number;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether to close other modals when opening this one */
  exclusive?: boolean;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Focus trap - keep focus within modal */
  focusTrap?: boolean;
}

interface ModalState {
  id: string;
  content: React.ReactNode;
  options: Required<ModalOptions>;
}

const defaultOptions: Required<ModalOptions> = {
  closeOnOutsideClick: true,
  closeOnEsc: true,
  zIndex: 50,
  size: 'md',
  exclusive: true,
  onClose: () => {},
  focusTrap: true,
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modals, setModals] = useState<ModalState[]>([]);
  const modalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const openModal = useCallback((id: string, content: React.ReactNode, options: ModalOptions = {}) => {
    const mergedOptions = { ...defaultOptions, ...options };
    
    setModals(prev => {
      // If exclusive mode, close all other modals
      if (mergedOptions.exclusive) {
        prev.forEach(modal => {
          modal.options.onClose?.();
        });
        return [{ id, content, options: mergedOptions }];
      }
      
      // If modal already exists, bring it to front
      const existingIndex = prev.findIndex(m => m.id === id);
      if (existingIndex >= 0) {
        const newModals = [...prev];
        const [modal] = newModals.splice(existingIndex, 1);
        return [...newModals, { ...modal, content, options: mergedOptions }];
      }
      
      return [...prev, { id, content, options: mergedOptions }];
    });
    
    // Store previously focused element for focus restoration
    if (document.activeElement instanceof HTMLElement) {
      previouslyFocusedElement.current = document.activeElement;
    }
  }, []);

  const closeModal = useCallback((id?: string) => {
    setModals(prev => {
      if (!id) {
        // Close top modal
        const topModal = prev[prev.length - 1];
        if (topModal) {
          topModal.options.onClose?.();
        }
        const newModals = prev.slice(0, -1);
        
        // Restore focus when all modals are closed
        if (newModals.length === 0 && previouslyFocusedElement.current) {
          setTimeout(() => {
            previouslyFocusedElement.current?.focus();
          }, 0);
        }
        
        return newModals;
      }
      
      // Close specific modal
      const modalToClose = prev.find(m => m.id === id);
      modalToClose?.options.onClose?.();
      
      const newModals = prev.filter(m => m.id !== id);
      
      // Restore focus when all modals are closed
      if (newModals.length === 0 && previouslyFocusedElement.current) {
        setTimeout(() => {
          previouslyFocusedElement.current?.focus();
        }, 0);
      }
      
      return newModals;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(prev => {
      prev.forEach(modal => {
        modal.options.onClose?.();
      });
      return [];
    });
    
    // Restore focus
    if (previouslyFocusedElement.current) {
      setTimeout(() => {
        previouslyFocusedElement.current?.focus();
      }, 0);
    }
  }, []);

  const getTopModalId = useCallback(() => {
    return modals[modals.length - 1]?.id || null;
  }, [modals]);

  const isModalOpen = useCallback((id: string) => {
    return modals.some(m => m.id === id);
  }, [modals]);

  const getModalCount = useCallback(() => {
    return modals.length;
  }, [modals]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const topModal = modals[modals.length - 1];
        if (topModal?.options.closeOnEsc) {
          e.preventDefault();
          closeModal();
        }
      }
    };

    if (modals.length > 0) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (modals.length === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [modals, closeModal]);

  // Focus trap for top modal
  useEffect(() => {
    const topModal = modals[modals.length - 1];
    if (!topModal?.options.focusTrap) return;

    const modalElement = modalRefs.current.get(topModal.id);
    if (!modalElement) return;

    // Find all focusable elements
    const focusableElements = modalElement.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstFocusable?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    modalElement.addEventListener('keydown', handleTabKey);
    return () => {
      modalElement.removeEventListener('keydown', handleTabKey);
    };
  }, [modals]);

  const value: ModalContextType = {
    openModal,
    closeModal,
    closeAllModals,
    getTopModalId,
    isModalOpen,
    getModalCount,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
      {/* Modal Portal */}
      {modals.length > 0 && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          {modals.map((modal, index) => (
            <div
              key={modal.id}
              ref={el => {
                if (el) modalRefs.current.set(modal.id, el);
                else modalRefs.current.delete(modal.id);
              }}
              className="pointer-events-auto"
              style={{ 
                zIndex: modal.options.zIndex + index,
                position: 'fixed',
                inset: 0,
              }}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/70 transition-opacity duration-200"
                onClick={() => {
                  if (modal.options.closeOnOutsideClick) {
                    closeModal(modal.id);
                  }
                }}
              />
              {/* Modal Content Container */}
              <div 
                className="absolute inset-0 flex items-center justify-center p-4 overflow-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget && modal.options.closeOnOutsideClick) {
                    closeModal(modal.id);
                  }
                }}
              >
                <div 
                  className={`relative bg-slate-900 border border-slate-800 rounded-lg shadow-2xl transform transition-all duration-200 ${
                    modal.options.size === 'sm' ? 'max-w-sm w-full' :
                    modal.options.size === 'md' ? 'max-w-2xl w-full' :
                    modal.options.size === 'lg' ? 'max-w-4xl w-full' :
                    modal.options.size === 'xl' ? 'max-w-6xl w-full' :
                    'w-full h-full'
                  }`}
                  style={{
                    maxHeight: modal.options.size === 'full' ? '100vh' : '90vh',
                  }}
                >
                  {modal.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

// Hook for creating a simple modal
export function useSimpleModal(id: string) {
  const { openModal, closeModal, isModalOpen } = useModal();
  
  const open = useCallback((content: React.ReactNode, options?: ModalOptions) => {
    openModal(id, content, options);
  }, [id, openModal]);
  
  const close = useCallback(() => {
    closeModal(id);
  }, [id, closeModal]);
  
  const isOpen = isModalOpen(id);
  
  return { open, close, isOpen };
}

// Higher-order component for modal content
export function withModalClose<P extends object>(
  Component: React.ComponentType<P & { onClose: () => void }>
): React.FC<P & { modalId?: string }> {
  return function WithModalClose({ modalId, ...props }: P & { modalId?: string }) {
    const { closeModal } = useModal();
    
    const handleClose = useCallback(() => {
      if (modalId) {
        closeModal(modalId);
      } else {
        closeModal();
      }
    }, [modalId, closeModal]);
    
    return <Component {...(props as P)} onClose={handleClose} />;
  };
}

export default ModalProvider;