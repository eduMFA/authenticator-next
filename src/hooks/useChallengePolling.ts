import { pollAllChallenges } from "@/services/challengePollingService";
import { usePushRequestStore } from "@/store/pushRequestStore";
import { useTokenStore } from "@/store/tokenStore";
import { useCallback, useRef, useState } from "react";

export interface UseChallengePollingResult {
  isPolling: boolean;
  lastPollTime: number | null;
  pollChallenges: () => Promise<void>;
  error: Error | null;
}

/**
 * Hook for polling challenges for all tokens
 * Handles deduplication and adds new challenges to the push request store
 */
export function useChallengePolling(): UseChallengePollingResult {
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const pollingRef = useRef(false);

  const tokens = useTokenStore((state) => state.tokens);
  const addPushRequest = usePushRequestStore((state) => state.addPushRequest);

  const pollChallenges = useCallback(async () => {
    // Prevent concurrent polling
    if (pollingRef.current) {
      console.log("Polling already in progress, skipping...");
      return;
    }

    if (tokens.length === 0) {
      console.log("No tokens available to poll");
      return;
    }

    pollingRef.current = true;
    setIsPolling(true);
    setError(null);

    try {
      console.log(`Starting challenge polling for ${tokens.length} tokens`);
      const result = await pollAllChallenges(tokens);

      if (result.error) {
        console.warn("Polling completed with errors:", result.error);
        setError(result.error);
      }

      // Add new challenges to the store (deduplication is handled by the store)
      let addedCount = 0;
      for (const challenge of result.challenges) {
        if (addPushRequest(challenge)) {
          addedCount++;
        }
      }

      console.log(
        `Polling complete. Found ${result.challenges.length} challenges, added ${addedCount} new`,
      );
      setLastPollTime(Date.now());
    } catch (err) {
      console.error("Polling failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      pollingRef.current = false;
      setIsPolling(false);
    }
  }, [tokens, addPushRequest]);

  return {
    isPolling,
    lastPollTime,
    pollChallenges,
    error,
  };
}
