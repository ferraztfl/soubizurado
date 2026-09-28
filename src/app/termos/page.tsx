import type { Metadata } from "next";
import Link from "next/link";

import styles from "../privacidade/legal.module.css";

export const metadata: Metadata = {
  title: "Termos de uso",
  alternates: { canonical: "/termos" },
};

/* Initial version — to be reviewed by a lawyer before going live. */
export default function TermsPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← Sou Bizurado
      </Link>
      <h1>Termos de uso</h1>
      <p className={styles.meta}>Versão inicial — última atualização: 28/09/2026.</p>

      <h2>1. O serviço</h2>
      <p>
        O Sou Bizurado é uma plataforma de estudo para concursos públicos e ENEM, com banco de questões, sessões de
        estudo, simulados, estatísticas de desempenho e, quando contratados, planos e combos pagos.
      </p>

      <h2>2. Conta</h2>
      <p>
        Para usar recursos como histórico, revisão e planos pagos é preciso criar uma conta com e-mail válido. Você é
        responsável por manter sua senha em sigilo e pelas atividades feitas na sua conta. A conta é pessoal e
        intransferível; o compartilhamento de acesso pode levar ao bloqueio.
      </p>

      <h2>3. Plano gratuito e planos pagos</h2>
      <p>
        Sem conta, é possível responder 1 questão por dia; com conta gratuita, 10 questões por dia. Os planos pagos
        (Premium e combos) liberam o uso ilimitado pelo período descrito na oferta, contado a partir da confirmação do
        pagamento. Compras novas somam tempo ao Premium já ativo.
      </p>

      <h2>4. Pagamento</h2>
      <p>
        Os pagamentos são processados pelo Mercado Pago (Pix, cartão ou boleto). Não armazenamos dados de cartão. O
        acesso é liberado quando o Mercado Pago confirma o pagamento; Pix e cartão costumam ser confirmados na hora e o
        boleto em até 3 dias úteis.
      </p>

      <h2>5. Direito de arrependimento e reembolso</h2>
      <p>
        Conforme o art. 49 do Código de Defesa do Consumidor, você pode desistir da compra em até 7 (sete) dias a contar
        da confirmação do pagamento, com reembolso integral pelo mesmo meio de pagamento. Após o reembolso, o acesso
        correspondente é encerrado.
      </p>

      <h2>6. Conteúdo</h2>
      <p>
        As questões de provas de concursos são reproduzidas com a indicação da banca, do órgão e do ano. Os comentários,
        a organização por matérias e os materiais próprios do Sou Bizurado não podem ser copiados, revendidos ou
        redistribuídos sem autorização.
      </p>

      <h2>7. Uso adequado</h2>
      <p>
        É proibido tentar burlar limites de uso, extrair o conteúdo em massa por robôs, interferir no funcionamento da
        plataforma ou usá-la para fins ilícitos. Contas que violarem estes termos podem ser suspensas.
      </p>

      <h2>8. Disponibilidade e alterações</h2>
      <p>
        Trabalhamos para manter o serviço sempre disponível, mas podem ocorrer interrupções para manutenção. Estes termos
        podem ser atualizados; mudanças relevantes serão avisadas na plataforma.
      </p>

      <h2>9. Privacidade</h2>
      <p>
        O tratamento dos seus dados pessoais está descrito na <Link href="/privacidade">Política de privacidade</Link>.
      </p>
    </main>
  );
}
