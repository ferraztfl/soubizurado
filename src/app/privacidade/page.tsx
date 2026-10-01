import type { Metadata } from "next";
import Link from "next/link";

import styles from "./legal.module.css";

export const metadata: Metadata = {
  title: "Política de privacidade",
  alternates: { canonical: "/privacidade" },
};

/* Initial version — to be reviewed by a lawyer before going live. Reflects what the system actually stores. */
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← Sou Bizurado
      </Link>
      <h1>Política de privacidade</h1>
      <p className={styles.meta}>Última atualização: 01/10/2026. Em conformidade com a LGPD (Lei 13.709/2018).</p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome de exibição, e-mail e senha (a senha é guardada pelo nosso provedor de
          autenticação, nunca em texto).
        </li>
        <li>
          <strong>Estudo:</strong> suas respostas, tempo de resposta, favoritos, anotações, sessões, simulados, metas e
          preferências (tema, tamanho do texto).
        </li>
        <li>
          <strong>Compras:</strong> pedidos, valores e a situação do pagamento. Dados de cartão ficam com o Mercado Pago
          — não os recebemos.
        </li>
        <li>
          <strong>Visitantes sem conta:</strong> para o limite de 1 questão por dia, guardamos apenas códigos
          irreversíveis (hash) de um cookie aleatório e do endereço IP — nunca o IP em si.
        </li>
        <li>
          <strong>Materiais gratuitos (edital verticalizado em PDF):</strong> nome, e-mail e WhatsApp informados no
          pedido, o material solicitado e um código irreversível (hash) do endereço IP, para evitar abusos. Usamos esses
          dados para liberar o material. Só enviamos novidades e ofertas por e-mail ou WhatsApp a quem marcar essa opção,
          que é separada e não é exigida para baixar; você pode pedir para sair da lista a qualquer momento.
        </li>
      </ul>

      <h2>2. Para que usamos</h2>
      <p>
        Para fornecer o serviço (corrigir respostas, montar revisões, estatísticas, missões e ranking), liberar o acesso
        comprado, dar suporte, prevenir fraudes e abusos e cumprir obrigações legais e fiscais.
      </p>

      <h2>3. Ranking</h2>
      <p>
        O ranking mostra apenas o seu nome de exibição e seus números do período — nunca o e-mail. Você pode sair do
        ranking a qualquer momento em Configurações.
      </p>

      <h2>4. Compartilhamento</h2>
      <p>
        Compartilhamos dados apenas com prestadores necessários ao serviço: Supabase (hospedagem, banco de dados e
        autenticação) e Mercado Pago (pagamentos). Não vendemos dados pessoais.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Usamos cookies essenciais para manter sua sessão, lembrar preferências de leitura e aplicar o limite diário
        gratuito. Não usamos cookies de publicidade.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos, pelo nosso
        canal de contato. Alguns dados podem ser mantidos pelo prazo exigido em lei (por exemplo, registros de compras).
      </p>

      <h2>7. Segurança</h2>
      <p>
        Os dados trafegam com criptografia (HTTPS), o acesso administrativo é restrito e auditado e o banco de dados usa
        controle de acesso por linha. Nenhum sistema é 100% invulnerável; em caso de incidente relevante, os titulares e a
        ANPD serão comunicados.
      </p>

      <p className={styles.meta}>
        Veja também os <Link href="/termos">Termos de uso</Link>.
      </p>
    </main>
  );
}
