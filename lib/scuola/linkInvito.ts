// Il link di un invito a un tutor: una forma sola per il riquadro verde di
// `InvitaTutorForm` e per «Copia il link» sulle righe in attesa.
export function linkInvitoTutor(origine: string, codice: string): string {
  return `${origine}/scuola/invito?codice=${encodeURIComponent(codice)}`;
}
