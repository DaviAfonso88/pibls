<?php

// Ponteiro da release ativa (ADR-010). Fica em private/<app>/current.php e é trocado de forma atômica (arquivo
// temporário + rename) pelo ativador, a cada deploy ou rollback. NÃO edite à mão, a não ser no rollback manual do
// runbook (docs/runbooks/rollback.md): troque só o id da release, mantendo o formato exato abaixo.
//
// O front controller (public_html/index.php) e o wrapper do artisan leem este arquivo e só aceitam o formato
// 'releases/AAAA.MM.N'.
return 'releases/AAAA.MM.N';
