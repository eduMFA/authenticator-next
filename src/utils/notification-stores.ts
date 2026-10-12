import { usePushRequestStore } from "@/stores/push-request";
import { useTokenStore } from "@/stores/token";

export async function waitForNotificationStores(): Promise<void> {
  await Promise.all(
    [useTokenStore.persist, usePushRequestStore.persist].map((persist) =>
      persist.hasHydrated()
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const unsubscribe = persist.onFinishHydration(() => {
              unsubscribe();
              resolve();
            });
          }),
    ),
  );
}
