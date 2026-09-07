# Lop’s Barbearia

Site estático em português, com HTML, CSS e JavaScript sem dependências de execução.

## Executar

`python -m http.server 4173 --bind 127.0.0.1`

Abra http://127.0.0.1:4173. Também é possível abrir index.html diretamente.

## Verificar e preparar publicação

- `npm test`: verifica referências locais e lógica do menu e agendamento, sem enviar mensagens.
- `npm run build`: copia apenas arquivos públicos utilizados para dist/.

## Contato

O agendamento monta uma mensagem para o WhatsApp 5581987576755. O cliente deve enviar a mensagem e combinar o horário com a barbearia; não existe reserva automática ou agenda de disponibilidade.

O contato por e-mail preserva o destinatário do projeto original via FormSubmit. A ativação da caixa e a entrega devem ser confirmadas pelo responsável. O envio real não faz parte dos testes automatizados.

Telefone, endereço e horários foram preservados do projeto original. Atualize index.html e o número em js/script.js se necessário. Não foram inventados preços ou avaliações. As fotografias foram reaproveitadas do projeto e são ilustrativas.

A imagem studio-optimized.jpg é uma versão reduzida de studio.jpg; o original foi preservado.
