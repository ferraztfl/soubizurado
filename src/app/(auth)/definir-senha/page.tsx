import styles from "../auth.module.css";
import { SetPasswordForm } from "./set-password-form";

export const metadata = {
  title: "Definir senha",
  robots: { index: false },
};

export default function SetPasswordPage() {
  return (
    <>
      <header className={styles.header}>
        <h1>Defina sua senha</h1>
        <p>Escolha a senha que você vai usar para entrar na plataforma.</p>
      </header>

      <SetPasswordForm />
    </>
  );
}
