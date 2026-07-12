"use client";

import { useState } from "react";
import { Button } from "./Button";
import ScuolaCascadeFields, { SCUOLA_ALTRO, type ScuolaCascadeValue } from "./ScuolaCascadeFields";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { ETA_MINIMA, calcolaAnnoDiploma, calcolaEta } from "@/lib/registrazione";
import { AREE } from "@/data/aree";

const CLASSI = [
  { value: "3", label: "3° anno" },
  { value: "4", label: "4° anno" },
  { value: "5", label: "5° anno" },
];

const MAX_AREE_INTERESSE = 3;

type StatoCodice = "idle" | "verificando" | "valido" | "non_valido";

export default function RegistrazioneForm() {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dataNascita, setDataNascita] = useState("");
  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [classe, setClasse] = useState("");
  const [scuolaValue, setScuolaValue] = useState<ScuolaCascadeValue>({
    provincia: "",
    indirizzo: "",
    scuola: "",
    scuolaAltro: "",
  });
  const [privacy, setPrivacy] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [areeInteresse, setAreeInteresse] = useState<string[]>([]);

  const [codiceClasse, setCodiceClasse] = useState("");
  const [statoCodice, setStatoCodice] = useState<StatoCodice>("idle");
  const [messaggioCodice, setMessaggioCodice] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);

  const etaSottoMinimo = dataNascita !== "" && calcolaEta(dataNascita) < ETA_MINIMA;
  const codiceValido = statoCodice === "valido";

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleScuolaChange(patch: Partial<ScuolaCascadeValue>) {
    setScuolaValue((prev) => ({ ...prev, ...patch }));
    Object.keys(patch).forEach((field) => clearError(field));
  }

  function toggleArea(slug: string) {
    setAreeInteresse((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_AREE_INTERESSE) return prev;
      return [...prev, slug];
    });
  }

  async function verificaCodiceClasse() {
    const codice = codiceClasse.trim().toUpperCase();
    if (!codice) {
      setStatoCodice("idle");
      setMessaggioCodice(null);
      return;
    }

    setStatoCodice("verificando");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("check_class_code", { p_codice: codice });
      const risultato = Array.isArray(data) ? data[0] : data;

      if (error || !risultato?.valido) {
        setStatoCodice("non_valido");
        setMessaggioCodice(risultato?.messaggio ?? "Codice non valido.");
        return;
      }

      setStatoCodice("valido");
      setMessaggioCodice(`Codice valido: sarai collegato alla classe ${risultato.classe} della tua scuola.`);
    } catch {
      setStatoCodice("non_valido");
      setMessaggioCodice("Non siamo riusciti a verificare il codice. Riprova tra qualche istante.");
    }
  }

  function validate() {
    const next: Record<string, string> = {};

    if (!nome.trim()) next.nome = "Inserisci il tuo nome.";
    if (!cognome.trim()) next.cognome = "Inserisci il tuo cognome.";

    if (!email.trim()) {
      next.email = "Inserisci la tua email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Inserisci un indirizzo email valido.";
    }

    if (!dataNascita) {
      next.dataNascita = "Inserisci la tua data di nascita.";
    } else if (calcolaEta(dataNascita) < ETA_MINIMA) {
      next.dataNascita = `Per registrarti su KIREO devi avere almeno ${ETA_MINIMA} anni. Se hai meno di ${ETA_MINIMA} anni, chiedi a un genitore o tutore di scrivere a KIREO tramite la pagina Contatti.`;
    }

    if (!password) {
      next.password = "Scegli una password.";
    } else if (password.length < 8) {
      next.password = "La password deve avere almeno 8 caratteri.";
    }
    if (confermaPassword !== password) next.confermaPassword = "Le password non coincidono.";

    if (!classe) next.classe = "Seleziona la classe che frequenti.";

    if (!codiceValido) {
      if (!scuolaValue.provincia) next.provincia = "Seleziona la provincia della tua scuola.";
      if (!scuolaValue.indirizzo) next.indirizzo = "Seleziona il tipo di istituto.";

      if (!scuolaValue.scuola) {
        next.scuola = "Seleziona la tua scuola.";
      } else if (scuolaValue.scuola === SCUOLA_ALTRO) {
        next.scuola = "Per ora la registrazione richiede una scuola presente nell'elenco. Scrivici da Contatti se non la trovi.";
      }
    }

    if (!privacy) next.privacy = "Devi accettare la privacy policy per continuare.";

    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroreGenerale(null);
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setCaricamento(true);
    try {
      const supabase = createClient();
      const annoDiploma = calcolaAnnoDiploma(Number(classe));

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: {
            ruolo: "studente",
            nome: nome.trim(),
            cognome: cognome.trim(),
            telefono: telefono.trim() || null,
            data_nascita: dataNascita,
            anno_diploma: annoDiploma,
            newsletter,
            aree_interesse: areeInteresse,
            ...(codiceValido
              ? { codice_classe: codiceClasse.trim().toUpperCase() }
              : { school_code: scuolaValue.scuola, classe: CLASSI.find((c) => c.value === classe)?.label ?? classe }),
          },
        },
      });

      if (error) {
        setErroreGenerale(
          error.message.includes("already registered") || error.message.includes("already exists")
            ? "Esiste già un profilo con questa email. Prova ad accedere."
            : "Non siamo riusciti a completare la registrazione. Riprova.",
        );
        return;
      }

      setInviato(true);
    } catch {
      setErroreGenerale("Qualcosa è andato storto durante la registrazione. Riprova tra qualche istante.");
    } finally {
      setCaricamento(false);
    }
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h2 className="py-0.5 font-heading text-xl font-semibold leading-[1.25] text-kireo-light">
          Controlla la tua email
        </h2>
        <p className="mt-2 text-sm text-kireo-muted">
          Ti abbiamo inviato un link di conferma: aprilo per attivare il tuo profilo KIREO.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {erroreGenerale && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erroreGenerale}</p>
      )}

      <div>
        <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          autoComplete="given-name"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            clearError("nome");
          }}
          aria-invalid={Boolean(errors.nome)}
          aria-describedby={errors.nome ? "nome-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.nome))}`}
          placeholder="Il tuo nome"
        />
        {errors.nome && (
          <p id="nome-error" className="mt-1.5 text-sm text-red-400">
            {errors.nome}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="cognome" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Cognome
        </label>
        <input
          id="cognome"
          name="cognome"
          type="text"
          autoComplete="family-name"
          value={cognome}
          onChange={(e) => {
            setCognome(e.target.value);
            clearError("cognome");
          }}
          aria-invalid={Boolean(errors.cognome)}
          aria-describedby={errors.cognome ? "cognome-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.cognome))}`}
          placeholder="Il tuo cognome"
        />
        {errors.cognome && (
          <p id="cognome-error" className="mt-1.5 text-sm text-red-400">
            {errors.cognome}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-kireo-light">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.email))}`}
          placeholder="nome@esempio.it"
        />
        {errors.email && (
          <p id="email-error" className="mt-1.5 text-sm text-red-400">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="telefono" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Telefono (facoltativo)
        </label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className={`${inputClass} ${fieldBorder(false)}`}
          placeholder="Il tuo numero di telefono"
        />
      </div>

      <div>
        <label htmlFor="dataNascita" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Data di nascita
        </label>
        <input
          id="dataNascita"
          name="dataNascita"
          type="date"
          autoComplete="bday"
          value={dataNascita}
          onChange={(e) => {
            setDataNascita(e.target.value);
            clearError("dataNascita");
          }}
          aria-invalid={Boolean(errors.dataNascita)}
          aria-describedby={errors.dataNascita ? "dataNascita-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.dataNascita))}`}
        />
        {errors.dataNascita && (
          <p id="dataNascita-error" className="mt-1.5 text-sm text-red-400">
            {errors.dataNascita}
          </p>
        )}
        {!errors.dataNascita && etaSottoMinimo && (
          <p className="mt-1.5 text-sm text-red-400">
            Per registrarti su KIREO devi avere almeno {ETA_MINIMA} anni. Se hai meno di {ETA_MINIMA} anni, chiedi a un
            genitore o tutore di scrivere a KIREO tramite la pagina{" "}
            <a href="/contatti" className="underline underline-offset-2">
              Contatti
            </a>
            .
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
          }}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.password))}`}
          placeholder="Almeno 8 caratteri"
        />
        {errors.password && (
          <p id="password-error" className="mt-1.5 text-sm text-red-400">
            {errors.password}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="confermaPassword" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Conferma password
        </label>
        <input
          id="confermaPassword"
          name="confermaPassword"
          type="password"
          autoComplete="new-password"
          value={confermaPassword}
          onChange={(e) => {
            setConfermaPassword(e.target.value);
            clearError("confermaPassword");
          }}
          aria-invalid={Boolean(errors.confermaPassword)}
          aria-describedby={errors.confermaPassword ? "confermaPassword-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.confermaPassword))}`}
          placeholder="Ripeti la password"
        />
        {errors.confermaPassword && (
          <p id="confermaPassword-error" className="mt-1.5 text-sm text-red-400">
            {errors.confermaPassword}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="classe" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Classe frequentata
        </label>
        <select
          id="classe"
          name="classe"
          value={classe}
          onChange={(e) => {
            setClasse(e.target.value);
            clearError("classe");
          }}
          aria-invalid={Boolean(errors.classe)}
          aria-describedby={errors.classe ? "classe-error" : undefined}
          className={`${inputClass} ${fieldBorder(Boolean(errors.classe))}`}
        >
          <option value="" disabled>
            Seleziona la classe
          </option>
          {CLASSI.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.classe && (
          <p id="classe-error" className="mt-1.5 text-sm text-red-400">
            {errors.classe}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="codiceClasse" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Hai un codice della tua scuola? (facoltativo)
        </label>
        <input
          id="codiceClasse"
          name="codiceClasse"
          type="text"
          value={codiceClasse}
          onChange={(e) => {
            setCodiceClasse(e.target.value);
            setStatoCodice("idle");
            setMessaggioCodice(null);
          }}
          onBlur={verificaCodiceClasse}
          className={`${inputClass} ${fieldBorder(statoCodice === "non_valido")}`}
          placeholder="Es. KIREO-AB12"
        />
        {statoCodice === "verificando" && <p className="mt-1.5 text-sm text-kireo-muted">Verifica in corso…</p>}
        {statoCodice === "valido" && <p className="mt-1.5 text-sm text-kireo-green-light">{messaggioCodice}</p>}
        {statoCodice === "non_valido" && <p className="mt-1.5 text-sm text-red-400">{messaggioCodice}</p>}
        {!codiceValido && (
          <p className="mt-1.5 text-xs text-kireo-muted">Se non hai un codice, seleziona la scuola qui sotto.</p>
        )}
      </div>

      {!codiceValido && <ScuolaCascadeFields value={scuolaValue} onChange={handleScuolaChange} errors={errors} />}

      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-kireo-light">Quali mondi ti incuriosiscono?</p>
            <p className="text-sm text-kireo-muted">Scegline fino a {MAX_AREE_INTERESSE} — potrai sempre cambiarli.</p>
          </div>
          <span className="flex-none whitespace-nowrap text-sm text-kireo-muted">
            {areeInteresse.length}/{MAX_AREE_INTERESSE} selezionate
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {AREE.map((area) => {
            const selezionata = areeInteresse.includes(area.slug);
            const disabilitata = !selezionata && areeInteresse.length >= MAX_AREE_INTERESSE;
            return (
              <button
                key={area.slug}
                type="button"
                onClick={() => toggleArea(area.slug)}
                disabled={disabilitata}
                aria-pressed={selezionata}
                className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selezionata ? "border-kireo-green bg-kireo-green/10" : "border-white/10 hover:border-white/20"
                }`}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-kireo-orange/40 font-heading text-xs font-bold text-kireo-orange">
                  {area.icona}
                </span>
                <span className="text-sm font-medium leading-[1.25] text-kireo-light">{area.nome}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-kireo-muted">
          Facoltativo: puoi anche saltare questo passaggio e sceglierle in un secondo momento.
        </p>
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="privacy"
            name="privacy"
            type="checkbox"
            checked={privacy}
            onChange={(e) => {
              setPrivacy(e.target.checked);
              clearError("privacy");
            }}
            aria-invalid={Boolean(errors.privacy)}
            aria-describedby={errors.privacy ? "privacy-error" : undefined}
            className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
          />
          <label htmlFor="privacy" className="text-sm text-kireo-muted">
            Ho letto e accetto la{" "}
            <a href="/privacy" className="text-kireo-orange underline underline-offset-2">
              Privacy Policy
            </a>
          </label>
        </div>
        {errors.privacy && (
          <p id="privacy-error" className="mt-1.5 text-sm text-red-400">
            {errors.privacy}
          </p>
        )}
      </div>

      <div className="flex items-start gap-3">
        <input
          id="newsletter"
          name="newsletter"
          type="checkbox"
          checked={newsletter}
          onChange={(e) => setNewsletter(e.target.checked)}
          className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
        />
        <label htmlFor="newsletter" className="text-sm text-kireo-muted">
          Voglio ricevere aggiornamenti sulle attività di orientamento
        </label>
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={caricamento || etaSottoMinimo}>
        {caricamento ? "Creazione in corso…" : "Crea il mio profilo"}
      </Button>
    </form>
  );
}
