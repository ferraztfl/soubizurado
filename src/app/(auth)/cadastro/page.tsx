import Link from "next/link";

import { signUpAction } from "@/modules/identity/presentation/actions/auth-actions";

import styles from "../auth.module.css";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignUpPage({
  searchParams,
}: SignUpPageProps) {
  const params = await searchParams;

  return (
    <>
      <header className={styles.header}>
        <h1>Comece sua preparação</h1>
        <p>
          Crie sua conta gratuitamente e comece a resolver
          questões no Sou Bizurado.
        </p>
      </header>

      {params.error ? (
        <p className={`${styles.message} ${styles.error}`}>
          Não foi possível criar sua conta. Revise os dados
          informados e tente novamente.
        </p>
      ) : null}

      <form action={signUpAction} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="displayName">
            Como podemos chamar você?
          </label>

          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            placeholder="Seu nome"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>

          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Senha</label>

          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Crie uma senha segura"
          />

          <span className={styles.hint}>
            Use pelo menos 8 caracteres.
          </span>
        </div>

        <button className={styles.submit} type="submit">
          Criar minha conta
        </button>
      </form>

      <p className={styles.alternative}>
        Já possui uma conta?{" "}
        <Link href="/login">
          Entrar
        </Link>
      </p>
    </>
  );
}