import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, LogOut } from "lucide-react";

interface SessionConflictDialogProps {
  open: boolean;
  onContinueHere: () => void;
  onSignOut: () => void;
}

export const SessionConflictDialog = ({
  open,
  onContinueHere,
  onSignOut,
}: SessionConflictDialogProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Session Active Elsewhere
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Your account has been signed in on another device. For security, only one active session is allowed at a time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onContinueHere}
            className="w-full gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Continue Here
          </Button>
          <Button
            onClick={onSignOut}
            variant="outline"
            className="w-full gap-2 border-muted-foreground/20"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
