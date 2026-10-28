<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Dados obrigatórios (seed de produção, lido pelas migrations `…_seed_*.php`)
|--------------------------------------------------------------------------
|
| Fonte: architecture.md → Database Strategy → Migrations & Seed; docs/conteudo-institucional.md
| (Guia Institucional e site atual) e Apêndice A do PRD. A Secretaria confere cada valor em homologação.
|
| Regra: o que NÃO consta nas fontes continua pendente (TBD-11) e fica marcado com o marcador `TODO` seguido de
| `(TBD-` e do número da pendência. O job de produção do deploy falha enquanto existir esse marcador neste diretório (T021):
| conteúdo provisório nunca vai para produção. Usuários reais nunca entram por migration.
|
*/

return [

    // Catálogo de permissões (Requisitos Funcionais → Matriz de permissões): chave => [descrição, escopo próprio?]
    'permissions' => [
        'boletins.write' => ['Criar, editar e excluir boletins', false],
        'mensagens.write' => ['Criar, editar e excluir mensagens Palavra Viva', false],
        'eventos.write' => ['Gerenciar eventos de qualquer ministério', false],
        'eventos.write.own' => ['Gerenciar eventos do próprio ministério', true],
        'eventos.inscricoes.read' => ['Ver e exportar inscritos de qualquer evento', false],
        'eventos.inscricoes.read.own' => ['Ver e exportar inscritos dos eventos do próprio ministério', true],
        'leads.read' => ['Ver contatos de visitante, membro, fale conosco e ministério', false],
        'leads.manage' => ['Alterar status, responsável e anotações desses contatos', false],
        'leads.oracao.read' => ['Ver pedidos de oração', false],
        'leads.oracao.manage' => ['Alterar status, responsável e anotações de pedidos de oração', false],
        'ministerios.write' => ['Gerenciar ministérios, grupos e Células de CL', false],
        'settings.write' => ['Gerenciar configurações gerais', false],
        'pix.write' => ['Gerenciar dados PIX', false],
        'users.read' => ['Ver o diretório de usuários', false],
    ],

    // Papéis de referência (papel => permissões). ADMIN_TECNICO tem só `users.read` na aplicação (menor privilégio).
    'role_templates' => [
        'COMUNICACAO' => [
            'boletins.write',
            'mensagens.write',
            'eventos.write',
            'eventos.inscricoes.read',
            'ministerios.write',
            'settings.write',
        ],
        'SECRETARIA' => [
            'eventos.inscricoes.read',
            'leads.read',
            'leads.manage',
            'ministerios.write',
            'settings.write',
        ],
        'TESOURARIA' => [
            'pix.write',
        ],
        'ORACAO' => [
            'leads.oracao.read',
            'leads.oracao.manage',
        ],
        'PASTORAL' => [
            'mensagens.write',
            'leads.read',
            'leads.oracao.read',
            'users.read',
        ],
        'LIDER_MINISTERIO' => [
            'eventos.write.own',
            'eventos.inscricoes.read.own',
        ],
        'ADMIN_TECNICO' => [
            'users.read',
        ],
    ],

    // `site_settings`: chave => [is_public, value]. Só as chaves públicas saem pela API e pelos snapshots (BR-050).
    'site_settings' => [
        // Programação regular (Apêndice A). A Ceia do Senhor é um aviso manual à parte (Clarificação 2).
        'schedule' => [true, [
            ['day' => 'Quinta-feira', 'recurrence' => 'semanal', 'activity' => 'Culto de Oração', 'time' => '20:00', 'mode' => 'Presencial e online'],
            ['day' => 'Domingo', 'recurrence' => 'semanal', 'activity' => 'EBD (Escola Bíblica Dominical)', 'time' => '09:00', 'mode' => 'Presencial (classes por faixa etária)'],
            ['day' => 'Domingo', 'recurrence' => 'semanal', 'activity' => 'Culto Matinal', 'time' => '10:10', 'mode' => 'Presencial e YouTube'],
            ['day' => 'Domingo', 'recurrence' => 'semanal', 'activity' => 'Culto Noturno', 'time' => '19:30', 'mode' => 'Presencial e YouTube'],
            ['day' => 'Sexta-feira', 'recurrence' => '1ª sexta-feira do mês', 'activity' => 'Culto Salt (Juventude)', 'time' => '19:30', 'mode' => 'Presencial'],
        ]],

        // Campanha "Estamos Construindo" (conteudo-institucional.md → Campanha)
        'campaign_notice' => [true, [
            'active' => true,
            'title' => 'Estamos Construindo',
            'text' => 'Em 2018 o templo desabou. Estamos construindo um novo local para reuniões, classes e encontros, equipado com tudo de que precisamos para levar o Evangelho de forma eficiente. Você pode nos ajudar!',
        ]],

        // Aviso da Ceia: manual. Fica desligado; a Secretaria liga na semana da Ceia.
        'lords_supper_notice' => [true, [
            'active' => false,
            'text' => 'Ceia do Senhor neste domingo, nos cultos. Membros da igreja e de outras igrejas da mesma denominação podem participar.',
        ]],

        // Q-03, informado pelo responsável em 2026-10-23.
        'address' => [true, [
            'street' => 'Rua Jair Gonçalves Bastos',
            'number' => '64',
            'complement' => null,
            'neighborhood' => 'Jardim Ipê',
            'city' => 'Lagoa Santa',
            'state' => 'MG',
            'zip' => '33239800',
        ]],

        // Links montados a partir do endereço. O mapa incorporado (`embed_url`) precisa do link de "Compartilhar ›
        // Incorporar um mapa" do Google Maps, que não dá para gerar fora dele: a Secretaria cola pelo painel.
        'map_links' => [true, [
            'google_maps_url' => 'https://www.google.com/maps/search/?api=1&query=Rua+Jair+Gon%C3%A7alves+Bastos%2C+64+-+Jardim+Ip%C3%AA%2C+Lagoa+Santa+-+MG%2C+33239-800',
            'waze_url' => 'https://waze.com/ul?q=Rua%20Jair%20Gon%C3%A7alves%20Bastos%2C%2064%20-%20Jardim%20Ip%C3%AA%2C%20Lagoa%20Santa%20-%20MG&navigate=yes',
            'embed_url' => null,
        ]],

        // Número da secretaria, informado pelo responsável em 2026-10-23 (substitui o do site antigo, de 8 dígitos).
        'whatsapp' => [true, [
            'phone' => '+553172561985',
            'default_text' => 'Olá! Gostaria de mais informações sobre a PIBLS.',
        ]],

        // Canal "Batista em Lagoa Santa". `/live` do canal abre a transmissão em andamento no YouTube.
        'youtube_links' => [true, [
            'channel_url' => 'https://www.youtube.com/channel/UCrq1VyMf5AhR5bLXR80PLCw',
            'live_url' => 'https://www.youtube.com/channel/UCrq1VyMf5AhR5bLXR80PLCw/live',
        ]],

        // Instagram da igreja. As contas Salt, MCM e Mini PIB pertencem aos respectivos grupos.
        'social_links' => [true, [
            ['network' => 'instagram', 'url' => 'https://www.instagram.com/pib_ls/'],
        ]],

        // Privada (BR-050). E-mail da igreja, informado pelo responsável em 2026-10-23, para todos os tipos. O aviso diz
        // só que chegou um contato novo; os dados ficam no painel. A Secretaria ajusta por tipo em /admin/configuracoes.
        'notification_recipients' => [false, [
            'VISITANTE' => ['pibls@pibls.com'],
            'MEMBRO' => ['pibls@pibls.com'],
            'ORACAO' => ['pibls@pibls.com'],
            'CONTATO' => ['pibls@pibls.com'],
            'MINISTERIO' => ['pibls@pibls.com'],
        ]],

        // PIX (Apêndice A). O QR Code vem do arquivo original, pelo painel (/admin/pix).
        'pix' => [true, [
            'pix_key' => '20969119000184',
            'beneficiary_name' => 'Primeira Igreja Batista em Lagoa Santa',
            'qr_image_path' => null,
            'copy_paste_code' => null,
        ]],
    ],

    // Catálogo inicial: [categoria, nome, horário (GRUPO/CELULA)]. A ordem de exibição segue a ordem da lista.
    // Q-04: a lista é a do Guia Institucional (aba 02, ministérios e liderança), confirmada pelo responsável em
    // 2026-10-23. Sem `contact_email`: os avisos usam a lista de destinatários acima. As Células de CL (bairro e
    // horário: terças ou quartas, 20h) não constam nas fontes e entram pelo painel.
    // Cada item: [categoria, nome, horário (GRUPO/CELULA), liderança exibida]. A liderança é a do Guia (tabela
    // "Ministérios da igreja e liderança atual"), publicada com a autorização do responsável em 2026-10-23: cargos
    // e nomes, separados por " · " quando há mais de um cargo; nada de telefone, e-mail ou endereço de pessoa.
    // O endereço residencial das células nunca entra no seed nem no público (BR-048).
    'ministries_groups' => [
        ['MINISTERIO', 'Comunicação', null, 'Pedro Ernandes Costa Santos, Lívia Luciano Nascimento e Ana Julia dos Santos Viana'],
        ['MINISTERIO', 'Oração', null, 'Dirce Rodrigues Pinheiro'],
        ['MINISTERIO', 'Apoio à Tesouraria', null, 'Thayssa Vitória Silvestre Souza e Luiz Sávio Nascimento Cordeiro'],
        ['MINISTERIO', 'Diáconos', null, 'Presidência: Maria Flor de Maio Dias e Eustáquio Rosa Dias'],
        ['MINISTERIO', 'Patrimônio', null, 'Coordenador: Reynaldo Afonso Chaves · Vice: Carlos Roberto Soares'],
        ['MINISTERIO', 'Recepção / Acolhimento', null, 'Coordenadores: Pr. Davi Franco Fonseca e Isabela Martins Sangy'],
        ['MINISTERIO', 'Juventude (Salt)', null, 'Coordenador Geral: Pr. Davi Franco Fonseca'],
        ['MINISTERIO', 'Música', null, 'Paola Amorim da Silva e Thiago Silva Cândido Oliveira'],
        ['MINISTERIO', 'Sonoplastia', null, 'Thiago S. C. Oliveira'],
        ['MINISTERIO', 'Multimídia', null, 'Victor Teixeira de Paula'],
        ['MINISTERIO', 'Transmissão pelas mídias sociais', null, 'Altamir Peixoto de Magalhães'],
        ['MINISTERIO', 'Evangelismo e Missões', null, 'Coordenadores: Heloi Alves Rodrigues e Carlos Roberto Soares'],
        ['MINISTERIO', 'Cantina', null, 'Osileia Felícia de Paulo Pereira e Betânia Cristina S. Dantas'],
        ['MINISTERIO', 'Programas Especiais', null, 'Diretoria da MCM'],
        ['MINISTERIO', 'Ação Social', null, 'Coordenadora: Luciana Regina dos Santos Viana'],
        ['MINISTERIO', 'Educação Cristã', null, 'Idélia Santana de Sena e Cristiano Soares'],
        ['MINISTERIO', 'Escola Bíblica Dominical (EBD)', null, 'Simone Soares Campos'],
        ['MINISTERIO', 'Departamento Infantil (Mini PIB)', null, 'Larissa Lacerda Franco'],
        ['MINISTERIO', 'MCM (Mulher Cristã em Missões)', null, 'Simone Sampaio de Amorim e Luciana R. S. Viana'],
        ['MINISTERIO', 'UMHBB (União Missionária de Homens Batistas do Brasil)', null, 'Pr. Geremias Ribeiro Santos e Leonardo Pereira Gomes'],
        ['MINISTERIO', 'Embaixadores do Rei', null, 'Lucas Samaniego Vicente e Pedro Lustosa'],
        ['MINISTERIO', 'Mensageiras do Rei', null, 'Osileia F. P. Pereira, Anna Carolina F. P. Pereira, Betânia C. S. Dantas, Djane A. Q. Dias Gomes e Elisiane'],
        // Grupos "Para Você" (Apêndice A)
        ['GRUPO', 'Homens (UMHBB)', 'Último sábado do mês, 20h', null],
        ['GRUPO', 'Mulheres (MCM)', '3º sábado do mês, 17h30', null],
        ['GRUPO', 'Jovens e Adolescentes (Salt)', 'Ver programação da Juventude', null],
        // Guia, aba 03: "EBD Infantil todos os domingos às 9h e Culto Infantil todos os domingos às 19h30".
        ['GRUPO', 'Crianças (Mini PIB)', 'EBD Infantil aos domingos, 9h; Culto Infantil aos domingos, 19h30', null],
    ],

];
