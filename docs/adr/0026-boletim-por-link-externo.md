# ADR-026 — Boletim publicado por PDF ou por link externo

- **Status:** Aceita
- **Data:** 2026-11-01 (pedido do responsável)

## Contexto

Até aqui o boletim tinha sempre um PDF enviado pelo painel, de até 10 MB (BR-041). O responsável pediu a opção de publicar o boletim por um link, como um flipbook do Heyzine (`https://heyzine.com/flip-book/4954dbb36f.html`), que fica hospedado fora do site e não depende do limite de upload da hospedagem.

## Decisão

**Cada boletim tem um PDF ou um link externo, nunca os dois e nunca nenhum (BR-084).**

- Nova coluna `bulletins.external_url`, VARCHAR(500). `pdf_path` e `pdf_size_bytes` passam a aceitar `NULL` (migration *expand*: os boletins que já existem não mudam).
- A CHECK `ck_bulletins_pdf_or_link` garante a regra no MySQL 8.0.16+. O MySQL 5.7 aceita a CHECK, mas a ignora; nele, a regra fica só na aplicação (`StoreBulletinRequest`, `UpdateBulletin` e `ReplaceBulletinPdf`).
- **Vale qualquer serviço, sem lista de domínios permitidos.** O link precisa ser `https`, ter um domínio de verdade (sem `localhost` nem IP) e não trazer usuário ou senha.
- O servidor **nunca acessa** o link, e o site **nunca o embute**: ele só vira o destino de "Ler boletim", em nova aba, com `rel="noopener noreferrer"`. Por isso não muda a CSP (nada novo em `frame-src`) e a regra de não embutir leitor (FR-039) continua valendo.
- **API:** `POST /api/admin/bulletins` aceita `pdf` (multipart) ou `external_url` (JSON ou multipart). `PATCH` com `external_url` faz o boletim passar a usar o link e apaga o PDF do disco, depois do commit. `POST …/pdf` faz o caminho de volta e limpa o link. As respostas e `data/home.json` ganham `external_url`, e `pdf_url` e `pdf_size_bytes` podem vir `null`.
- **Site:** o boletim por link só tem "Ler boletim". "Baixar PDF" não aparece, porque não há arquivo nosso para baixar.
- **Painel:** a escolha fica em "Arquivo ou link do boletim", no formato de "Quando publicar". Na edição, um aviso antecipa o que acontece ao salvar: o PDF é apagado, ou o link sai.

## Alternativas consideradas

- **Aceitar só o Heyzine:** mais restrito, mas trocar de serviço de flipbook exigiria alterar o código. Quem cadastra é a equipe autenticada, com `boletins.write`, e todo cadastro fica na auditoria.
- **Guardar o PDF e o link no mesmo boletim:** o card poderia oferecer as duas ações, mas abriria a dúvida de qual é a versão oficial e deixaria um arquivo antigo no ar sem ninguém perceber.
- **Baixar o conteúdo do link no servidor:** o servidor passaria a acessar endereços informados por um usuário (SSRF) e a depender do serviço externo na hora do cadastro.
- **Embutir o flipbook no site (`iframe`):** contraria o FR-039 e exigiria abrir a CSP para um domínio de terceiros.

## Consequências

- *Positivas:* a Comunicação pode publicar edições maiores que 10 MB e com leitura em formato de revista, sem alterar o que já existe nem a página de quem publica por PDF.
- *Negativas:* o conteúdo fica fora do nosso controle e do nosso backup: se o serviço sair do ar, apagar o flipbook ou o link expirar, "Ler boletim" para de funcionar, e o sistema não detecta isso. O link também leva quem lê a um site de terceiro, com a política de privacidade dele.
- *A observar:* se os links quebrarem com frequência, avaliar uma verificação periódica ou voltar a exigir o PDF como cópia, numa ADR nova.
