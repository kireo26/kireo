-- Tipi enumerati per l'area privata KIREO.

create type public.profile_role as enum ('studente', 'docente', 'referente_scuola');
create type public.tipo_istituto as enum ('Liceo', 'Tecnico', 'Professionale');
create type public.convention_status as enum ('attiva', 'in_attesa', 'scaduta');
create type public.student_activity_status as enum ('assegnata', 'in_corso', 'completata');
