import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TipModal } from "./TipModal";

interface TipButtonProps {
  creatorId: string;
  creatorName: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
}

export function TipButton({ 
  creatorId, 
  creatorName,
  size = "default",
  variant = "outline" 
}: TipButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className="gap-2"
      >
        <Gift className="h-4 w-4" />
        Send Tip
      </Button>

      <TipModal
        open={showModal}
        onOpenChange={setShowModal}
        creatorId={creatorId}
        creatorName={creatorName}
      />
    </>
  );
}
