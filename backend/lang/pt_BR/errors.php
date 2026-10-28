<?php

declare(strict_types=1);

/*
| Mensagens do envelope de erro (architecture.md → Error Handling Strategy).
| O texto exato de cada regra de negócio (BR-xxx) fica nos arquivos de cada módulo; aqui só as categorias genéricas.
*/

return [
    'validation' => 'Confira os campos destacados.',
    'unauthenticated' => 'Sua sessão expirou. Entre novamente.',
    'forbidden' => 'Você não tem permissão para esta ação.',
    'not_found' => 'Não encontramos o que você procurou.',
    'method_not_allowed' => 'Este endereço não aceita esse tipo de requisição.',
    'csrf' => 'A página ficou aberta por muito tempo. Recarregue e tente novamente.',
    'too_many_requests' => 'Muitas tentativas. Tente novamente em alguns minutos.',
    'payload_too_large' => 'O arquivo é grande demais.',
    'conflict' => 'A operação não pôde ser concluída.',
    'service_unavailable' => 'O site está com instabilidade. Tente novamente em instantes ou fale conosco pelo WhatsApp.',
    'lead_assignee_state' => 'O responsável só vale para contatos em atendimento.',
    'palavra_viva_empty_body' => 'Escreva o texto da mensagem.',
    'event_empty_description' => 'Escreva a descrição do evento.',
    'pix_qr_required' => 'Envie o QR Code do PIX.',
    'ministry_description_too_long' => 'A descrição pode ter no máximo 5.000 caracteres.',
    'settings_pix_forbidden' => 'Os dados PIX mudam só na tela do PIX, com a confirmação da sua senha.',
    'settings_empty' => 'Envie ao menos uma configuração.',
    'settings_unknown_key' => 'Esta configuração não existe.',
    'settings_notice_text_required' => 'Escreva o texto do aviso ou desligue-o.',
    'internal' => 'Algo deu errado do nosso lado. Tente novamente em instantes. Código do erro: :trace_id',
];
