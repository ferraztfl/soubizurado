import { BRAZIL_STATES } from "@/modules/blog/domain/blog";
import { CONTEST_STATUSES, EDUCATION_LEVELS } from "@/modules/contests/domain/contest";

import styles from "../loja/loja.module.css";
import { saveContestAction } from "./actions";

export type ContestFormValues = Readonly<{
  id: string | null;
  name: string;
  slug: string;
  organizationName: string;
  stateCode: string | null;
  status: string;
  vacancies: string;
  hasReserveList: boolean;
  salaryMin: string;
  salaryMax: string;
  educationLevels: readonly string[];
  positions: string;
  summary: string;
  registrationStart: string;
  registrationEnd: string;
  examDate: string;
  noticeUrl: string;
  boardId: string | null;
  careerCategoryId: string | null;
  relatedOfferId: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  hasLogo: boolean;
}>;

type Option = Readonly<{ id: string; name: string }>;

export function ContestForm({
  values,
  organizations,
  boards,
  careers,
  offers,
}: Readonly<{
  values: ContestFormValues;
  organizations: readonly string[];
  boards: readonly Option[];
  careers: readonly Option[];
  offers: readonly Option[];
}>) {
  return (
    <form action={saveContestAction} className={styles.form}>
      {values.id ? <input type="hidden" name="contestId" value={values.id} /> : null}

      <label className={`${styles.field} ${styles.full}`}>
        <span>Nome do concurso</span>
        <input name="name" defaultValue={values.name} required minLength={3} maxLength={200} placeholder="Concurso PMPE 2027" />
      </label>
      <label className={styles.field}>
        <span>Órgão (igual ao do banco de questões, se existir)</span>
        <input
          name="organizationName"
          defaultValue={values.organizationName}
          list="contest-organizations"
          required
          maxLength={200}
          placeholder="Polícia Militar de Pernambuco (PMPE)"
        />
        <datalist id="contest-organizations">
          {organizations.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className={styles.field}>
        <span>Endereço (slug)</span>
        <input name="slug" defaultValue={values.slug} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="gerado a partir do nome" />
      </label>

      <label className={styles.field}>
        <span>Situação</span>
        <select name="status" defaultValue={values.status}>
          {Object.entries(CONTEST_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>UF</span>
        <select name="stateCode" defaultValue={values.stateCode ?? ""}>
          <option value="">Nacional</option>
          {Object.entries(BRAZIL_STATES).map(([code, name]) => (
            <option key={code} value={code}>
              {code} — {name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Banca (do catálogo)</span>
        <select name="boardId" defaultValue={values.boardId ?? ""}>
          <option value="">A definir</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Carreira / editoria</span>
        <select name="careerCategoryId" defaultValue={values.careerCategoryId ?? ""}>
          <option value="">Nenhuma</option>
          {careers.map((career) => (
            <option key={career.id} value={career.id}>
              {career.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Vagas (vazio = a definir)</span>
        <input name="vacancies" defaultValue={values.vacancies} inputMode="numeric" maxLength={12} placeholder="2.400" />
      </label>
      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="hasReserveList" defaultChecked={values.hasReserveList} /> Cadastro reserva (CR)
        </label>
      </div>
      <label className={styles.field}>
        <span>Salário inicial mínimo (R$, opcional)</span>
        <input name="salaryMin" defaultValue={values.salaryMin} inputMode="decimal" maxLength={20} placeholder="3.000,00" />
      </label>
      <label className={styles.field}>
        <span>Salário máximo (R$)</span>
        <input name="salaryMax" defaultValue={values.salaryMax} inputMode="decimal" maxLength={20} placeholder="5.197,50" />
      </label>

      <div className={`${styles.checks} ${styles.full}`}>
        <span>Escolaridade:</span>
        {Object.entries(EDUCATION_LEVELS).map(([value, label]) => (
          <label key={value}>
            <input type="checkbox" name="educationLevels" value={value} defaultChecked={values.educationLevels.includes(value)} /> {label}
          </label>
        ))}
      </div>

      <label className={styles.field}>
        <span>Início das inscrições</span>
        <input name="registrationStart" type="date" defaultValue={values.registrationStart} />
      </label>
      <label className={styles.field}>
        <span>Fim das inscrições</span>
        <input name="registrationEnd" type="date" defaultValue={values.registrationEnd} />
      </label>
      <label className={styles.field}>
        <span>Data da prova</span>
        <input name="examDate" type="date" defaultValue={values.examDate} />
      </label>
      <label className={styles.field}>
        <span>Link do edital oficial (https)</span>
        <input name="noticeUrl" type="url" defaultValue={values.noticeUrl} maxLength={500} placeholder="https://…" />
      </label>

      <label className={`${styles.field} ${styles.full}`}>
        <span>Cargos (um resumo, ex.: Soldado; Oficial)</span>
        <textarea name="positions" defaultValue={values.positions} rows={2} maxLength={1000} />
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Resumo — escrito por nós (situação, requisitos, etapas). Não copie texto de outros sites.</span>
        <textarea name="summary" defaultValue={values.summary} rows={8} maxLength={20000} />
      </label>

      <label className={styles.field}>
        <span>Logo / brasão do órgão (PNG com fundo transparente é o ideal){values.hasLogo ? " — já tem; envie outra para trocar" : ""}</span>
        <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
      </label>
      {values.hasLogo ? (
        <div className={styles.checks}>
          <label>
            <input type="checkbox" name="removeLogo" /> Remover a logo
          </label>
        </div>
      ) : (
        <p className={styles.hint}>Sem logo, o cartão mostra a sigla do órgão.</p>
      )}

      <label className={styles.field}>
        <span>Combo da Loja para este concurso</span>
        <select name="relatedOfferId" defaultValue={values.relatedOfferId ?? ""}>
          <option value="">Nenhum</option>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} /> Mais procurado (destaque)
        </label>
        <label>
          <input type="checkbox" name="isPublished" defaultChecked={values.isPublished} /> Publicado no site
        </label>
      </div>

      <div className={styles.full}>
        <button type="submit" className={styles.primary}>
          {values.id ? "Salvar concurso" : "Criar concurso"}
        </button>
      </div>
    </form>
  );
}
