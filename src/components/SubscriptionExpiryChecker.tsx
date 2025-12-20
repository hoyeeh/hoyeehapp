import { useSubscriptionExpiryWarning } from "@/hooks/useSubscriptionExpiryWarning";

export const SubscriptionExpiryChecker = () => {
  useSubscriptionExpiryWarning();
  return null;
};
