"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { createSupabaseBrowserClient } from "@/shared/infrastructure/supabase/client";

import styles from "../auth.module.css";

type Status =
  | Readonly<{ kind: "checking" }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "ready"; email: string | null }>
  | Readonly<{ kind: "saving"; email: string | null }>;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

/**
 * Landing of invitation and password recovery links. The link carries a
 * one-time session (URL fragment or code); the person then chooses their
 * own password, which only they and Supabase ever see.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function openSession() {
      const supabase = createSupabaseBrowserClient();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = new URLSearchParams(window.location.search).get("code");

      if (hash.get("error_description")) {
        if (!cancelled) setStatus({ kind: "invalid", message: "Este link expirou ou já foi usado. Peça um novo convite." });
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      // Only a link from the e-mail opens the form: an existing session
      // alone must not be enough to change the password.
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        if (!cancelled) setStatus({ kind: "invalid", message: "Abra esta página pelo link recebido por e-mail." });
        return;
      }

      // Tokens must not stay in the address bar or browser history.
      if (accessToken || code) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data } = await supabase.auth.getUser();

      if (cancelled) return;

      setStatus(
        data.user
          ? { kind: "ready", email: data.user.email ?? null }
          : { kind: "invalid", message: "Link inválido ou expirado. Peça um novo convite ou uma nova redefinição de senha." },
      );
    }

    void openSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status.kind !== "ready") return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      setError(`A senha precisa ter de ${MIN_PASSWORD} a ${MAX_PASSWORD} caracteres.`);
      return;
    }

    if (password !== confirmation) {
      setError("As senhas não conferem.");
      return;
    }

    setError(null);
    setStatus({ kind: "saving", email: status.email });

    const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password });

    if (updateError) {
      setError("Não foi possível salvar a senha. Tente outra senha ou peça um novo link.");
      setStatus({ kind: "ready", email: status.email });
      return;
    }

    // The new session cookies go with the next server request.
    router.replace("/app");
    router.refresh();
  }

  if (status.kind === "checking") {
    return <p className={styles.message}>Validando o link…</p>;
  }

  if (status.kind === "invalid") {
    return <p className={`${styles.message} ${styles.error}`}>{status.message}</p>;
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {status.email ? (
        <p className={styles.hint}>
          Conta: <strong>{status.email}</strong>
        </p>
      ) : null}

      {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}

      <div className={styles.field}>
        <label htmlFor="password">Nova senha</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          maxLength={MAX_PASSWORD}
          autoComplete="new-password"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="confirmation">Confirme a senha</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          required
          minLength={MIN_PASSWORD}
          maxLength={MAX_PASSWORD}
          autoComplete="new-password"
        />
      </div>

      <button className={styles.submit} type="submit" disabled={status.kind === "saving"}>
        {status.kind === "saving" ? "Salvando…" : "Salvar senha e entrar"}
      </button>
    </form>
  );
}
