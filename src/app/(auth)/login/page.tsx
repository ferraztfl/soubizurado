import Link from "next/link";

import { loginAction } from "@/modules/identity/presentation/actions/auth-actions";

import styles from "../auth.module.css";

type LoginPageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  const hasError = Boolean(params.error);

  return (
    <>
      <header className={styles.header}>
        <h1>Bem-vindo de volta</h1>
        <p>
          Entre na sua conta e continue sua preparação.
        </p>
      </header>

      {params.created === "1" ? (
        <p className={`${styles.message} ${styles.success}`}>
          Conta criada com sucesso. Confira seu e-mail para
          confirmar o cadastro.
        </p>
      ) : null}

      {hasError ? (
        <p className={`${styles.message} ${styles.error}`}>
          Não foi possível entrar. Confira seu e-mail e senha.
        </p>
      ) : null}

      <form action={loginAction} className={styles.form}>
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
            autoComplete="current-password"
            placeholder="Digite sua senha"
          />
        </div>

        <button className={styles.submit} type="submit">
          Entrar
        </button>
      </form>

      <p className={styles.alternative}>
        Ainda não possui uma conta?{" "}
        <Link href="/cadastro">
          Criar conta gratuitamente
        </Link>
      </p>
    </>
  );
}