import { createContext, useContext } from "react";

export type AppointmentSheetApi = {
  /** Opens the appointment sheet for this appointment id. */
  openAppointment: (id: string) => void;
  /** Opens the client card for this customer id. */
  openCustomer: (id: string) => void;
};

export const AppointmentSheetContext = createContext<AppointmentSheetApi>({
  openAppointment: () => {},
  openCustomer: () => {},
});

/** Open an appointment (or a client card) from anywhere inside the app shell. */
export function useAppointmentSheet(): AppointmentSheetApi {
  return useContext(AppointmentSheetContext);
}
