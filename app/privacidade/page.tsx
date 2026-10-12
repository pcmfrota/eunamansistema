export const metadata = {
  title: "Política de Privacidade — EUNAMAN PCM",
  description: "Política de privacidade do aplicativo EUNAMAN PCM.",
};

export default function PoliticaDePrivacidadePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-800">
      <div className="max-w-3xl mx-auto px-5 py-12 space-y-8">
        <header className="space-y-2 border-b border-zinc-200 pb-6">
          <h1 className="text-2xl font-black text-zinc-900">Política de Privacidade</h1>
          <p className="text-sm text-zinc-500">Aplicativo EUNAMAN PCM — Sistema de Gestão de Frota e PCM</p>
          <p className="text-xs text-zinc-400">Última atualização: 12 de outubro de 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">1. Sobre este aplicativo</h2>
          <p className="text-sm leading-relaxed">
            O EUNAMAN PCM é um sistema interno de gestão de frota e manutenção (PCM) usado
            exclusivamente por colaboradores e prestadores autorizados da EUNAMAN para registrar
            ordens de serviço, preventivas, abastecimentos, checklists e demais informações
            operacionais da frota. Não é um aplicativo de uso público: o acesso exige login
            fornecido pela empresa, e não há cadastro aberto ao público em geral.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">2. Quais dados coletamos</h2>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-2">
            <li>
              <strong>Dados de conta:</strong> e-mail, nome e cargo do colaborador que acessa o
              sistema, usados para login e controle de permissões.
            </li>
            <li>
              <strong>Dados operacionais da frota:</strong> placas, equipamentos, ordens de
              serviço, preventivas, horímetros, abastecimentos, checklists, custos de manutenção
              e demais registros inseridos pelos próprios colaboradores no exercício do trabalho.
            </li>
            <li>
              <strong>Dados de outros colaboradores:</strong> nome e matrícula de motoristas,
              mecânicos e demais funcionários mencionados nos registros acima (ex: quem assinou
              uma ficha, quem executou um serviço), cadastrados pela própria empresa.
            </li>
            <li>
              <strong>Fotos e assinaturas:</strong> fotos tiradas pela câmera do aparelho (ex:
              evidência de serviço, placa de equipamento, horímetro) e assinaturas digitais
              coletadas em tela, anexadas aos registros correspondentes.
            </li>
            <li>
              <strong>Arquivos:</strong> o aplicativo pode salvar relatórios (PDF/Excel) gerados
              pelo próprio usuário na pasta de Downloads do aparelho.
            </li>
          </ul>
          <p className="text-sm leading-relaxed">
            Não coletamos localização (GPS), contatos, histórico de navegação fora do aplicativo,
            nem dados de pagamento. O aplicativo não exibe anúncios e não usa SDKs de publicidade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">3. Como usamos esses dados</h2>
          <p className="text-sm leading-relaxed">
            Os dados são usados exclusivamente para operar o sistema de gestão de frota da
            EUNAMAN: autenticar o acesso, registrar e consultar o histórico de manutenção e
            abastecimento, calcular indicadores (custos, consumo, disponibilidade de frota) e
            gerar relatórios/exportações para controle interno e prestação de contas a clientes
            da EUNAMAN (quando aplicável, ex: planilhas no formato exigido por um cliente).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">4. Armazenamento e funcionamento offline</h2>
          <p className="text-sm leading-relaxed">
            O aplicativo foi projetado para funcionar em áreas sem sinal de internet: os dados
            digitados offline ficam salvos localmente no aparelho (em um banco de dados do
            próprio navegador/aplicativo) até que a conexão volte, quando são enviados
            automaticamente para os servidores da EUNAMAN. Os dados em trânsito e armazenados nos
            servidores são protegidos com autenticação e controle de acesso por cargo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">5. Compartilhamento com terceiros</h2>
          <p className="text-sm leading-relaxed">
            Não vendemos nem compartilhamos os dados coletados com terceiros para fins de
            publicidade ou marketing. Os dados podem ser processados por prestadores de
            infraestrutura (hospedagem e banco de dados) contratados pela EUNAMAN unicamente para
            operar o sistema, e podem ser compartilhados com um cliente da EUNAMAN quando o
            próprio serviço contratado exigir prestação de contas sobre a frota alocada a ele.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">6. Retenção e exclusão de dados</h2>
          <p className="text-sm leading-relaxed">
            Os dados operacionais são mantidos pelo tempo necessário para fins de gestão,
            histórico de manutenção e obrigações contratuais/fiscais da EUNAMAN. Um colaborador
            que deixe a empresa pode solicitar a remoção dos seus dados de conta entrando em
            contato pelo canal abaixo, respeitadas eventuais obrigações legais de retenção de
            registros operacionais já vinculados a ordens de serviço.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">7. Permissões do aplicativo Android</h2>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li><strong>Câmera:</strong> para fotografar evidências de serviço, placas e equipamentos.</li>
            <li><strong>Armazenamento/Fotos:</strong> para anexar fotos já existentes e salvar relatórios gerados.</li>
            <li><strong>Internet e estado da rede:</strong> para sincronizar dados com o servidor e detectar quando o aparelho está offline.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-900">8. Contato</h2>
          <p className="text-sm leading-relaxed">
            Dúvidas sobre esta política ou solicitações relacionadas aos seus dados podem ser
            enviadas para{" "}
            <a href="mailto:contato@eunaman.com.br" className="text-indigo-600 underline">
              contato@eunaman.com.br
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
