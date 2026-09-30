import type { CatalogArea, CatalogDiscipline } from "../../domain/canonical-taxonomy-catalog";

import { area, topic } from "./concursos-taxonomy-additions";
import { SAUDE } from "./concursos-taxonomy-v7";

/*
 * v8: specific knowledge of the health positions of police and firefighter
 * exams (military doctors and dentists, e.g. PMPE QOM/QOD) and health
 * management. Same editing rules: names are stable, only additions; board
 * section names go in aliases.
 */

/** v8 areas added to existing disciplines (any catalog version), keyed by discipline name. */
export const V8_AREAS_FOR_EXISTING: Readonly<Record<string, readonly CatalogArea[]>> = {
  "Saúde Pública": [
    area(
      "Gestão em Saúde",
      [
        topic("Políticas de Saúde no Brasil", [], ["Evolução das políticas de saúde no Brasil"]),
        topic("Organização do SUS e Regionalização", [], ["Decreto nº 7.508/2011", "COAP"]),
        topic("Planejamento, Monitoramento e Avaliação em Saúde", [], ["Indicadores de saúde"]),
        topic("Sistemas de Informação em Saúde"),
        topic("Gestão de Pessoas em Saúde"),
        topic("Gestão de Materiais, Custos e Projetos em Saúde"),
        topic("Humanização e Direitos dos Usuários", [], ["Política Nacional de Humanização"]),
      ],
      ["Gestão de Saúde"],
    ),
  ],
};

export const V8_DISCIPLINES: readonly CatalogDiscipline[] = [
  {
    name: "Clínica Médica",
    knowledgeAreaSlug: SAUDE,
    aliases: ["Medicina Interna", "Clínica Geral", "Conhecimentos Específicos - Clínica Geral"],
    areas: [
      area("Fundamentos da Prática Clínica", [
        topic("Cuidados Gerais com o Paciente"),
        topic("Exames Complementares"),
        topic("Farmacologia Clínica"),
        topic("Medicina Baseada em Evidências"),
        topic("Ética Médica e Legislação Profissional", [], ["Código de Ética Médica"]),
        topic("Psicologia Médica"),
        topic("Controle de Infecção Hospitalar"),
      ]),
      area("Doenças por Sistema", [
        topic("Doenças Cardiovasculares", ["Hipertensão arterial", "Cardiopatia isquêmica", "Arritmias cardíacas"]),
        topic("Doenças Pulmonares"),
        topic("Doenças Gastrointestinais e Hepáticas"),
        topic("Doenças Renais"),
        topic("Doenças Endócrinas", ["Diabetes mellitus", "Doenças da tireoide"]),
        topic("Doenças Reumáticas"),
        topic("Doenças Neurológicas"),
        topic("Doenças Infecciosas e Antibioticoterapia"),
      ]),
      area("Urgências Clínicas", [
        topic("Distúrbios Hidroeletrolíticos e Ácido-Básicos"),
        topic("Intoxicações Exógenas"),
        topic("Emergências Psiquiátricas"),
      ]),
    ],
  },
  {
    name: "Cirurgia Geral",
    knowledgeAreaSlug: SAUDE,
    aliases: ["Clínica Cirúrgica", "Conhecimentos Específicos - Cirurgia Geral"],
    areas: [
      area("Princípios da Cirurgia", [
        topic("Avaliação e Preparo do Paciente Cirúrgico", [], ["Pré e pós-operatório"]),
        topic("Anestesia Local e Locorregional"),
        topic("Suturas, Curativos e Antimicrobianos em Cirurgia"),
        topic("Complicações Cirúrgicas"),
        topic("Resposta Metabólica ao Trauma"),
        topic("Imunologia e Transplantes"),
        topic("Videolaparoscopia"),
      ]),
      area("Trauma e Urgências Cirúrgicas", [
        topic("Atendimento ao Politraumatizado", [], ["ATLS"]),
        topic("Trauma Abdominal, Torácico e Cervical"),
        topic("Traumatismo Cranioencefálico e Raquimedular"),
        topic("Choque"),
        topic("Queimaduras"),
        topic("Abdome Agudo"),
        topic("Hemorragia Digestiva"),
        topic("Suporte Avançado de Vida", [], ["SAVC", "ACLS"]),
      ]),
      area("Cirurgia do Aparelho Digestivo e da Parede Abdominal", [
        topic("Parede Abdominal e Hérnias"),
        topic("Doenças das Vias Biliares"),
        topic("Hipertensão Portal e Cirrose"),
      ]),
      area("Cirurgia no Ciclo Gravídico-Puerperal", [topic("Cirurgia Geral na Gestante")]),
    ],
  },
  {
    name: "Odontologia",
    knowledgeAreaSlug: SAUDE,
    aliases: ["Conhecimentos de Odontologia", "Conhecimentos Específicos - Odontologia", "Cirurgião-Dentista"],
    areas: [
      area("Saúde Bucal Coletiva", [
        topic("Epidemiologia e Prevenção em Saúde Bucal"),
        topic("Política Nacional de Saúde Bucal", [], ["Brasil Sorridente", "CEO"]),
        topic("Fluorterapia e Fluorose"),
        topic("Biossegurança em Odontologia"),
        topic("Ética Odontológica e Documentação", [], ["Código de Ética Odontológica", "Laudos e atestados"]),
      ]),
      area("Diagnóstico", [
        topic("Anatomia e Histologia Dentária"),
        topic("Semiologia Odontológica"),
        topic("Radiologia Odontológica"),
        topic("Estomatologia e Patologia Bucal"),
      ]),
      area("Clínica Odontológica", [
        topic("Cariologia"),
        topic("Dentística", [], ["Clareamento dental", "Lesões não cariosas"]),
        topic("Oclusão"),
        topic("Periodontia"),
        topic("Endodontia"),
        topic("Prótese Dentária"),
        topic("Cirurgia Oral Menor"),
        topic("Anestesiologia Odontológica"),
        topic("Farmacologia Odontológica"),
        topic("Odontopediatria"),
        topic("Pacientes com Necessidades Especiais"),
        topic("Urgências e Emergências em Odontologia"),
      ]),
    ],
  },
];
