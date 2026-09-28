import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  QUESTION_EXPLORER_PAGE_SIZE_COOKIE,
  QUESTION_EXPLORER_PAGE_SIZES,
  QUESTION_EXPLORER_SORT_COOKIE,
  QUESTION_EXPLORER_SORTS,
} from "@/modules/question-bank/presentation/question-explorer-search-params";
import {
  changePasswordAction,
  saveRankingVisibilityAction,
  signOutEverywhereAction,
} from "@/modules/study/presentation/actions/account-actions";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { loadStudyPreferences } from "@/modules/study/infrastructure/queries/study-preferences";
import { DEFAULT_STUDY_PREFERENCES } from "@/modules/study/domain/study-preferences";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "../perfil/account.module.css";
import { DisplaySettings } from "./display-settings";

export const dynamic = "force-dynamic";

type SettingsPageProps = Readonly<{
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

const SUCCESS: Readonly<Record<string, string>> = {
  privacidade: "Preferência de privacidade salva.",
  senha: "Senha alterada.",
};

const ERRORS: Readonly<Record<string, string>> = {
  "senha-curta": "A nova senha precisa ter de 8 a 128 caracteres.",
  "senha-diferente": "A confirmação não confere com a nova senha.",
  "senha-atual": "A senha atual está incorreta.",
  "senha-falhou": "Não foi possível alterar a senha. Tente outra senha.",
};

export default async function SettingsPage(props: SettingsPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await props.searchParams;
  const profileId = await findStudentProfileId(user.id);
  const preferences = profileId ? await loadStudyPreferences(profileId) : DEFAULT_STUDY_PREFERENCES;
  const cookieStore = await cookies();
  const savedSize = Number(cookieStore.get(QUESTION_EXPLORER_PAGE_SIZE_COOKIE)?.value);
  const savedSort = cookieStore.get(QUESTION_EXPLORER_SORT_COOKIE)?.value ?? "";

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Conta" title="Configurações" description="Aparência, lista de questões, privacidade e segurança da conta." />

      {params.ok && SUCCESS[params.ok] ? (
        <div className={styles.noticeSuccess} role="status">
          {SUCCESS[params.ok]}
        </div>
      ) : null}
      {params.error && ERRORS[params.error] ? (
        <div className={styles.noticeError} role="alert">
          {ERRORS[params.error]}
        </div>
      ) : null}

      <DisplaySettings
        pageSize={QUESTION_EXPLORER_PAGE_SIZES.find((size) => size === savedSize) ?? 20}
        sort={Object.hasOwn(QUESTION_EXPLORER_SORTS, savedSort) ? savedSort : "recentes"}
      />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2>Privacidade</h2>
          <p>O ranking mostra só seu nome de exibição e seus números da semana — nunca seu e-mail.</p>
        </div>
        <form action={saveRankingVisibilityAction} className={styles.form}>
          <label className={`${styles.toggle} ${styles.full}`}>
            <input type="checkbox" name="showInRanking" defaultChecked={preferences.showInRanking} />
            <span>Aparecer no ranking de estudantes</span>
          </label>
          <div className={styles.actions}>
            <button type="submit" className={styles.secondary}>
              Salvar privacidade
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2>Alterar senha</h2>
          <p>Confirme a senha atual e escolha uma nova com pelo menos 8 caracteres.</p>
        </div>
        <form action={changePasswordAction} className={styles.form}>
          <label className={`${styles.field} ${styles.full}`}>
            <span>Senha atual</span>
            <input name="currentPassword" type="password" required autoComplete="current-password" />
          </label>
          <label className={styles.field}>
            <span>Nova senha</span>
            <input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
          </label>
          <label className={styles.field}>
            <span>Confirme a nova senha</span>
            <input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
          </label>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>
              Alterar senha
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2>Sessões</h2>
          <p>Encerra o acesso em todos os aparelhos onde sua conta está conectada, inclusive este.</p>
        </div>
        <form action={signOutEverywhereAction}>
          <button type="submit" className={styles.danger}>
            Sair de todos os dispositivos
          </button>
        </form>
        <Link href="/app/perfil" className={styles.linkButton}>
          Voltar ao perfil
        </Link>
      </section>
    </div>
  );
}
