import { Component, type ErrorInfo, type ReactNode } from 'react';
import { announceCrash, stopEverything } from '../drivers/crashGuard';
import { t } from '../i18n';
import { CrashScreen } from './CrashScreen';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — React class component catching rendering errors in children.
 *
 * Requirements:
 * - On error, call stopEverything() to cease all vibration and speech immediately.
 * - Call announceCrash(t('crash.message')) to inform the user audibly once.
 * - Render CrashScreen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      stopEverything();
      announceCrash(t('crash.message'));
    } catch {
      // Crash handling must never throw
    }
    this.props.onError?.(error, errorInfo);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <CrashScreen />;
    }
    return this.props.children;
  }
}
