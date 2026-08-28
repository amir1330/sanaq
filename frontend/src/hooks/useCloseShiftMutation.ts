import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";

export function useCloseShiftMutation(
  shiftId: number | null | undefined,
  closingCash: string,
  onSuccess: (result: Awaited<ReturnType<typeof api.closeShift>>) => void,
) {
  return useMutation({
    mutationFn: (force: boolean) => api.closeShift(shiftId!, Number(closingCash || 0), force),
    onSuccess,
  });
}
