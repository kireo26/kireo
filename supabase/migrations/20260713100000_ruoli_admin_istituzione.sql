-- Aggiunge i ruoli "istituzione" e "admin" a profile_role. Isolata in una
-- migration propria: Postgres non permette di usare un nuovo valore enum
-- nella stessa transazione in cui è stato aggiunto — le migration
-- successive (applicate separatamente via psql) possono già riferirsi a
-- questi valori senza problemi.
alter type public.profile_role add value 'istituzione';
alter type public.profile_role add value 'admin';
