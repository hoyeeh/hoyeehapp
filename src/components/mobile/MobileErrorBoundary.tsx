import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MobileErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[MobileErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MobileErrorBoundary] Error details:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-6">
            <AlertTriangle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Something went wrong
            </h1>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              We're sorry, but something unexpected happened. Please try again.
            </p>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mb-6 p-4 bg-destructive/10 rounded-lg text-left max-w-sm">
              <p className="text-xs text-destructive font-mono break-all">
                {this.state.error.message}
              </p>
            </div>
          )}

          <Button
            onClick={this.handleRetry}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
