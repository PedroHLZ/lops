# Caixa da Lop’s — uso no celular

## Abrir

Depois de publicar no endereço definitivo da Vercel, abra `/caixa/` no celular, sempre no mesmo navegador. O rodapé do site também tem o link **Caixa da barbearia**.

Na primeira abertura, toque em **Começar neste celular**. O sistema começa vazio, sem preços ou movimentações de exemplo. Ele não exige uma conta; qualquer pessoa com acesso a este navegador consegue abrir o caixa.

## Rotina

1. Em **Serviços**, cadastre o nome e o preço de cada serviço.
2. Em **Resumo**, os serviços cadastrados aparecem como botões grandes. Toque no serviço realizado: uma janela desliza de trás do botão e mostra **Pix**, **Dinheiro**, **Débito** e **Crédito**. Escolher o pagamento registra uma unidade pelo preço da tabela, na data de hoje, e fecha a janela. Apenas abrir ou fechar a janela não cria lançamento. Só uma janela fica aberta por vez; você pode tocar novamente no serviço, em **Fechar**, fora dele ou pressionar Escape para fechá-la. **Desfazer último registro** cancela o último lançamento rápido, preservando o histórico. Para vários serviços juntos, datas anteriores ou descontos, use **Atendimento com mais opções**.
3. Em **Registrar despesa**, informe o que foi pago, a categoria, o valor e a forma de pagamento.
4. Em **Resumo**, consulte Hoje, Este mês ou um intervalo de datas. Entradas são recebimentos; despesas são pagamentos registrados; resultado é a diferença. Não representa automaticamente lucro contábil nem saldo bancário.
5. Em **Histórico**, filtre e abra um lançamento para ver os detalhes. Para corrigir um erro, cancele com um motivo e registre novamente. O cancelamento não apaga o histórico.
6. Ao terminar o dia, abra **Ajustes → Baixar backup** e guarde o arquivo JSON em Downloads ou em outro local de sua escolha. Verifique que ele foi baixado.

## Backup e troca de aparelho

Os registros ficam no IndexedDB do navegador. Eles **não ficam no GitHub, na Vercel ou em uma conta online**. Mudar de domínio, navegador ou aparelho abre um armazenamento diferente. Limpar os dados do site pode apagar os registros. O backup manual é a forma de recuperação.

Para transferir: baixe o backup no aparelho antigo, copie o arquivo para o novo, abra o caixa no endereço definitivo e use **Ajustes → Restaurar backup**. Confira o resumo antes de confirmar. A restauração aceita backups JSON de até 20 MB e adiciona somente registros ausentes; os já existentes são preservados, inclusive cancelamentos e preços atuais. O arquivo CSV serve para consulta em planilhas, não para restauração.

O navegador pode aceitar armazenamento persistente, solicitado na ativação, mas isso não substitui o backup. Não use navegação anônima para o caixa. O carregamento inicial da página requer acesso ao site; esta versão não oferece instalação ou funcionamento offline garantido.

## Publicação na Vercel

O projeto mantém o fluxo GitHub → Vercel. `vercel.json` configura `npm run build` e a saída `dist`. O caixa é estático; não necessita chave de API, banco online ou variável de ambiente. Os arquivos de testes, documentação e backups não são copiados para `dist`.

Referência oficial: [Build e diretório de saída na Vercel](https://vercel.com/docs/project-configuration).

## Verificações

`npm test` verifica o site existente, valores em centavos, períodos, descontos, resumos, cancelamentos, exportação, gravação no IndexedDB simulado, duplicação de salvamento, preservação de preços e restauração. `npm run build` prepara os arquivos públicos.

A simulação usa fake-indexeddb e não substitui validar downloads e restauração no navegador real do celular. Nenhuma movimentação real foi criada durante os testes.
