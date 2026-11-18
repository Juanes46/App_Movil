import { useCallback, useState } from "react";

/**
 * Estado para pull-to-refresh.
 *   const { refreshing, onRefresh } = useRefresh(refreshProducts);
 *   <Screen refreshing={refreshing} onRefresh={onRefresh}>
 * Muestra el indicador al menos 400 ms para que se note la recarga.
 */
export function useRefresh(...tasks: (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const wait = new Promise((r) => setTimeout(r, 400));
    await Promise.allSettled([...tasks.map((t) => t()), wait]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, tasks);
  return { refreshing, onRefresh };
}
