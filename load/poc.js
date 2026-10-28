// PoC de desempenho do Laravel 13 sem OPcache (F0-03, T013/T014, TBD-05, ADR-005).
//
// Critério: p95 <= 500 ms com 10 requisições concorrentes em GET /api/poc/read
// (Eloquent + join + Resource, `php artisan optimize` e classmap autoritativo).
//
// Uso (contra a homologação, na janela de manutenção; ver docs/runbooks/poc-desempenho.md):
//   k6 run -e BASE_URL=https://homolog.pibls.com load/poc.js
//   k6 run -e BASE_URL=https://homolog.pibls.com -e AUTH=usuario:senha load/poc.js   # Basic Auth da homologação
//   k6 run -e BASE_URL=http://localhost:8080 -e DURATION=20s load/poc.js             # ensaio local
//
// Sem pausa entre as requisições: são sempre 10 em andamento ao mesmo tempo (pior caso do critério).
// Mantido depois da T015 só como referência.
import http from 'k6/http';
import encoding from 'k6/encoding';
import { check } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const P95_LIMIT_MS = 500;
// O critério é o p95, mas uma cauda muito longa (p99) indica fila por limite de processos
// (entry processes, erro 508) ou travamento. Não reprova, porém exige investigação.
const TAIL_WARNING_MS = 2000;

export const options = {
  scenarios: {
    // Aquecimento: abre a conexão com o banco e esquenta o cache de arquivos do servidor.
    // Fora da medição (tag phase:warmup).
    warmup: {
      executor: 'constant-vus',
      vus: 2,
      duration: '5s',
      exec: 'warmup',
      tags: { phase: 'warmup' },
    },
    medicao: {
      executor: 'constant-vus',
      vus: 10,
      duration: __ENV.DURATION || '60s',
      startTime: '6s',
      exec: 'medicao',
      tags: { phase: 'medicao' },
    },
  },
  thresholds: {
    'http_req_duration{phase:medicao}': [`p(95)<${P95_LIMIT_MS}`],
    'http_req_failed{phase:medicao}': ['rate<0.01'],
    'checks{phase:medicao}': ['rate>0.99'],
    // Sem um threshold, o k6 não cria a sub-métrica e o resumo perde a contagem de requisições.
    'http_reqs{phase:medicao}': ['count>0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function headers() {
  const h = { Accept: 'application/json' };
  if (__ENV.AUTH) {
    h.Authorization = `Basic ${encoding.b64encode(__ENV.AUTH)}`;
  }
  return h;
}

function request() {
  const res = http.get(`${BASE_URL}/api/poc/read`, { headers: headers() });
  check(res, {
    'status 200': (r) => r.status === 200,
    'corpo traz data[]': (r) => {
      try {
        return Array.isArray(r.json('data'));
      } catch (e) {
        return false;
      }
    },
  });
}

export function warmup() {
  request();
}

export function medicao() {
  request();
}

function fmt(value) {
  return value === undefined ? 'n/d' : `${value.toFixed(1)} ms`;
}

export function handleSummary(data) {
  const duration = data.metrics['http_req_duration{phase:medicao}'];
  const failed = data.metrics['http_req_failed{phase:medicao}'];
  const reqs = data.metrics['http_reqs{phase:medicao}'];
  const p95 = duration ? duration.values['p(95)'] : undefined;
  const pass = p95 !== undefined && p95 <= P95_LIMIT_MS;

  const resultado = {
    base_url: BASE_URL,
    criterio_p95_ms: P95_LIMIT_MS,
    passou: pass,
    p95_ms: p95,
    p99_ms: duration ? duration.values['p(99)'] : undefined,
    media_ms: duration ? duration.values.avg : undefined,
    max_ms: duration ? duration.values.max : undefined,
    requisicoes: reqs ? reqs.values.count : undefined,
    requisicoes_por_segundo: reqs ? reqs.values.rate : undefined,
    taxa_de_falha: failed ? failed.values.rate : undefined,
  };

  const cauda = resultado.p99_ms !== undefined && resultado.p99_ms > TAIL_WARNING_MS;
  resultado.cauda_longa = cauda;

  const texto = [
    '',
    'PoC F0-03: GET /api/poc/read com 10 requisições concorrentes',
    `  alvo:        ${BASE_URL}`,
    `  p95:         ${fmt(p95)}   (critério: <= ${P95_LIMIT_MS} ms)`,
    `  p99 / média: ${fmt(resultado.p99_ms)} / ${fmt(resultado.media_ms)}`,
    `  máximo:      ${fmt(resultado.max_ms)}`,
    `  requisições: ${resultado.requisicoes ?? 'n/d'} (${(resultado.requisicoes_por_segundo ?? 0).toFixed(1)}/s)`,
    `  falhas:      ${((resultado.taxa_de_falha ?? 0) * 100).toFixed(2)}%`,
    `  RESULTADO:   ${pass ? 'PASSOU, ADR-005 pode ir para Aceita' : 'NÃO PASSOU, abrir a ADR do plano B (Slim 4)'}`,
    ...(cauda
      ? [
          `  ATENÇÃO:     p99 acima de ${TAIL_WARNING_MS} ms. Mesmo com o p95 dentro do critério, investigue`,
          '               fila de processos (erro 508 / entry processes) antes de aceitar a ADR.',
        ]
      : []),
    '',
  ].join('\n');

  return {
    stdout: texto,
    'poc-resultado.json': JSON.stringify(resultado, null, 2),
  };
}
