// Rajada de inscrições em um evento com vagas limitadas (T180, T194, E-02, E-04, SC-013, BR-021).
//
// Critério: com N vagas e mais de N tentativas, exatamente N inscrições são aceitas (201); as demais recebem 409
// EVENT_FULL. Nenhuma resposta fora de 201/409 (e de 429, se o limite de envios por IP agir).
//
// Uso (contra a homologação, com FEATURE_EVENTS=true e um evento publicado de SPOTS vagas, sem inscrições):
//   k6 run -e BASE_URL=https://homolog.pibls.com -e SLUG=retiro-de-jovens -e SPOTS=250 load/registration-burst.js
//   k6 run -e BASE_URL=... -e SLUG=... -e SPOTS=250 -e AUTH=usuario:senha load/registration-burst.js   # Basic Auth da homologação
//   k6 run -e BASE_URL=http://localhost:8080 -e SLUG=teste -e SPOTS=5 -e ATTEMPTS=20 -e MODE=burst load/registration-burst.js
//
// Variáveis:
//   SLUG      endereço do evento (obrigatório)
//   SPOTS     vagas do evento (obrigatório)
//   ATTEMPTS  tentativas (padrão 300)
//   DURATION  janela em segundos no modo `spread` (padrão 900 = 15 min, o ensaio de T194)
//   MODE      `spread` (padrão): tentativas distribuídas na janela; `burst`: todas de uma vez
//   HAS_MINORS=1 envia o responsável legal (evento com menores)
//   ALLOW_THROTTLE=1 aceita que o limite `registration-submit` (60 por IP em 10 min) barre tentativas: então o total aceito
//                    precisa só ser <= SPOTS. Sem isso, qualquer 429 reprova a execução.
//
// O limite por IP é do Wi-Fi da igreja (60 em 10 min): de uma máquina só, 300 tentativas em 15 min passam dele. Rode de
// mais de um IP ou use ALLOW_THROTTLE=1 e confira em `registrations_throttled` quantas foram barradas.
//
// Os dados são fictícios: nome "Teste Carga N" e telefone 319 + 8 dígitos. Depois da rodada, apague as inscrições pelo
// painel (cancelar) ou despublique e remova o evento de teste.
import http from 'k6/http';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const SLUG = __ENV.SLUG;
const SPOTS = Number(__ENV.SPOTS);
const ATTEMPTS = Number(__ENV.ATTEMPTS || 300);
const DURATION_S = Number(__ENV.DURATION || 900);
const MODE = __ENV.MODE || 'spread';
const ALLOW_THROTTLE = __ENV.ALLOW_THROTTLE === '1';

if (!SLUG || !Number.isInteger(SPOTS) || SPOTS < 1) {
  fail('Informe -e SLUG=<endereço do evento> e -e SPOTS=<vagas do evento>.');
}

const created = new Counter('registrations_created');
const full = new Counter('registrations_full');
const throttled = new Counter('registrations_throttled');
const unexpected = new Counter('registrations_unexpected');

const scenarios = {
  spread: {
    executor: 'constant-arrival-rate',
    rate: ATTEMPTS,
    timeUnit: `${DURATION_S}s`,
    duration: `${DURATION_S}s`,
    preAllocatedVUs: 20,
    maxVUs: 60,
  },
  burst: {
    executor: 'shared-iterations',
    vus: Math.min(ATTEMPTS, 50),
    iterations: ATTEMPTS,
    maxDuration: '5m',
  },
};

export const options = {
  scenarios: { rajada: scenarios[MODE] },
  thresholds: {
    // O que importa: nunca mais que as vagas; e, sem limite de envios no caminho, exatamente as vagas.
    registrations_created: ALLOW_THROTTLE || ATTEMPTS < SPOTS ? [`count<=${SPOTS}`] : [`count==${SPOTS}`],
    registrations_unexpected: ['count==0'],
    ...(ALLOW_THROTTLE ? {} : { registrations_throttled: ['count==0'] }),
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
if (__ENV.AUTH) {
  headers.Authorization = `Basic ${encoding.b64encode(__ENV.AUTH)}`;
}

function xsrfToken() {
  const cookies = http.cookieJar().cookiesForURL(`${BASE_URL}/`);
  const value = cookies['XSRF-TOKEN'] && cookies['XSRF-TOKEN'][0];
  return value ? decodeURIComponent(value) : '';
}

export function setup() {
  const event = http.get(`${BASE_URL}/api/public/events/${SLUG}`, { headers });
  if (event.status !== 200) {
    fail(`GET /api/public/events/${SLUG} respondeu ${event.status}: o evento existe, está publicado e a flag está ligada?`);
  }
  const { registration } = event.json('data');
  if (registration.spots_total !== SPOTS) {
    fail(`O evento tem ${registration.spots_total} vagas, não ${SPOTS}.`);
  }
  if (registration.spots_left !== SPOTS) {
    fail(`O evento já tem inscrições (${registration.spots_left} vagas livres de ${SPOTS}). Use um evento sem inscrições.`);
  }
  return { hasForm: event.json('data.form_schema').length };
}

export default function (data) {
  if (!xsrfToken()) {
    http.get(`${BASE_URL}/sanctum/csrf-cookie`, { headers });
  }

  const n = exec.scenario.iterationInTest + 1;
  const body = {
    participant_name: `Teste Carga ${n}`,
    phone: `319${String(10000000 + n)}`,
    answers: {},
    consent: true,
  };
  if (__ENV.HAS_MINORS === '1') {
    Object.assign(body, { guardian_name: `Responsavel Carga ${n}`, guardian_phone: `319${String(20000000 + n)}`, guardian_consent: true });
  }

  const response = http.post(`${BASE_URL}/api/public/events/${SLUG}/register`, JSON.stringify(body), {
    headers: { ...headers, 'X-XSRF-TOKEN': xsrfToken() },
    tags: { name: 'POST /api/public/events/{slug}/register' },
  });

  if (response.status === 201) {
    created.add(1);
  } else if (response.status === 409 && response.json('error.code') === 'EVENT_FULL') {
    full.add(1);
  } else if (response.status === 429) {
    throttled.add(1);
  } else {
    unexpected.add(1);
    console.error(`Resposta inesperada: ${response.status} ${response.body}`);
  }

  check(response, { 'sem erro de servidor': (r) => r.status < 500 });
}

export function teardown() {
  const event = http.get(`${BASE_URL}/api/public/events/${SLUG}`, { headers });
  check(event, {
    'as vagas livres nunca ficam negativas': (r) => r.json('data.registration.spots_left') >= 0,
    'o total de inscritos nunca passa das vagas': (r) => r.json('data.registration.spots_total') - r.json('data.registration.spots_left') <= SPOTS,
  });
  console.log(`Vagas livres no fim: ${event.json('data.registration.spots_left')} de ${SPOTS}`);
}
