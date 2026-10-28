<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Textos exatos das regras de negócio (architecture.md → Business Rules)
|--------------------------------------------------------------------------
|
| Fonte única dos textos que o usuário lê. Cada chave é o id da BR; o valor é a mensagem, ou uma lista quando a regra
| tem mais de uma. Os marcadores {assim} (N, X, {nome}, {min}…) são trocados por quem lança a mensagem.
|
| O teste `LangTest` confere este arquivo contra a tabela do architecture.md: se o documento mudar um texto, o teste
| falha. O frontend repete só as mensagens que ele mesmo mostra, na validação do formulário (shared/messages.ts), e um
| teste de lá confere cada uma contra este arquivo.
|
*/

return [

    'BR-001' => 'Para enviar, você precisa concordar com a Política de Privacidade.',
    'BR-003' => 'Muitas tentativas. Tente novamente em alguns minutos.',
    'BR-004' => [
        'Informe seu nome.',
        'Informe um telefone válido com DDD.',
        'Informe um e-mail válido.',
        'Escreva sua mensagem (mínimo de 5 caracteres).',
    ],
    'BR-005' => 'Informe um telefone ou um e-mail para retorno.',
    'BR-006' => ['Ministério inválido.', 'Grupo inválido.'],
    'BR-007' => 'Contato não encontrado.',
    'BR-008' => 'Mudança de status não permitida.',
    'BR-009' => 'Escolha um responsável com acesso a este tipo de contato.',
    'BR-010' => 'Aguardando atendimento há N dias',
    'BR-011' => 'O tipo X não tem destinatário de e-mail. Os contatos chegam só pelo painel.',
    'BR-012' => 'Responsável inativo. Reatribua este contato.',
    'BR-013' => 'A anotação pode ter no máximo 1.000 caracteres.',
    'BR-020' => 'As inscrições para este evento estão encerradas.',
    'BR-021' => 'Vagas esgotadas para este evento.',
    'BR-022' => 'Esta pessoa já está inscrita neste evento com este telefone.',
    'BR-023' => 'Informe os dados do responsável legal e marque a autorização.',
    'BR-024' => [
        'Este campo é obrigatório.',
        'Escolha uma das opções.',
        'Informe um número entre {min} e {max}.',
        'Use no máximo {max} caracteres.',
        'Use pelo menos {min} caracteres.',
        'Informe uma data válida.',
        'Informe uma resposta válida.',
        'Informe um número a partir de {min}.',
        'Informe um número de até {max}.',
    ],
    'BR-025' => 'O término precisa ser depois do início.',
    'BR-026' => 'O prazo de inscrição precisa terminar antes do início do evento.',
    'BR-027' => 'Já existem N inscritos; o número de vagas não pode ser menor.',
    'BR-028' => 'Este evento tem inscrições e não pode ser excluído. Despublique-o.',
    'BR-029' => 'Este campo já tem respostas. As respostas existentes serão mantidas com o rótulo atual. Confirmar?',
    'BR-030' => 'Evento não encontrado.',
    'BR-031' => [
        'O formulário pode ter no máximo 30 campos.',
        'Já existe um campo com a chave X.',
        'Informe de 2 a 30 opções diferentes.',
    ],
    'BR-032' => 'Já existe um item com este endereço. Escolha outro.',
    'BR-033' => 'O prazo de inscrição já passou; o evento será publicado com inscrições encerradas.',
    'BR-034' => 'A inscrição de {nome} será excluída definitivamente e a vaga liberada. Confirmar?',
    'BR-040' => 'Já existe um boletim com a edição N.',
    'BR-041' => ['O arquivo precisa ser um PDF.', 'O PDF pode ter no máximo 10 MB.'],
    'BR-044' => 'Informe um link do YouTube.',
    'BR-045' => [
        'A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.',
        'O QR Code precisa ser PNG ou JPEG, com até 1 MB.',
    ],
    'BR-046' => 'Parte da formatação não é permitida e foi removida.',
    'BR-047' => 'Este item está vinculado a eventos, contatos ou usuários. Desative-o em vez de excluir.',
    'BR-049' => ['Informe dia e horário.', 'Informe o bairro.'],
    'BR-051' => 'Informe até 10 e-mails válidos.',
    'BR-060' => 'Senha incorreta. Os dados PIX não foram alterados.',
    'BR-061' => 'Informe um CNPJ válido.',
    'BR-062' => 'O código Pix Copia e Cola é inválido. Copie-o novamente do aplicativo do banco.',
    'BR-063' => 'Alteração bloqueada: os destinatários do alerta de PIX não estão configurados no servidor. Fale com o administrador técnico.',
    'BR-070' => 'E-mail ou senha inválidos.',
    'BR-071' => 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'BR-072' => 'Link inválido ou expirado. Solicite um novo.',
    'BR-073' => [
        'A senha precisa ter pelo menos 12 caracteres.',
        'A senha é longa demais.',
        'Esta senha apareceu em vazamentos de dados. Escolha outra.',
    ],
    'BR-074' => 'Sua sessão expirou. Entre novamente.',
    'BR-075' => 'Você não tem permissão para esta ação.',
    'BR-076' => 'Você não tem permissão para esta ação.',
    'BR-081' => 'Esta exclusão é definitiva e não pode ser desfeita. Confirmar?',
    'BR-083' => 'Para continuar, autorize o uso das informações de saúde.',

];
