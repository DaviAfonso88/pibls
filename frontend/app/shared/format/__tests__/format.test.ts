import { describe, expect, it } from "vitest";
import {
  formatCep,
  formatCnpj,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatFileSize,
  formatInteger,
  formatIsoDateLong,
  formatMonthYear,
  formatPhone,
  formatScheduleTime,
  formatTime,
  isValidCep,
  isValidCnpj,
  isValidPhone,
  maskCep,
  maskCnpj,
  maskPhone,
  toApiDateTime,
  toDateInput,
  toDateTimeLocal,
  sundaysAround,
  toE164,
  yearsSince,
} from "..";

describe("datas e horas no horário de Brasília", () => {
  it("mostra a data e a hora de São Paulo, não as do navegador", () => {
    // 13:10 UTC é 10:10 em Brasília (UTC-3)
    expect(formatDate("2026-11-08T13:10:00Z")).toBe("08/11/2026");
    expect(formatTime("2026-11-08T13:10:00Z")).toBe("10h10");
    expect(formatDateTime("2026-11-08T13:10:00Z")).toBe("08/11/2026 às 10h10");
  });

  it("vira o dia quando a hora UTC já é a madrugada seguinte", () => {
    // 02:30 UTC de 9/11 ainda é 23:30 de 8/11 em Brasília
    expect(formatDate("2026-11-09T02:30:00Z")).toBe("08/11/2026");
    expect(formatTime("2026-11-09T02:30:00Z")).toBe("23h30");
    expect(formatTime("2026-11-09T03:00:00Z")).toBe("00h00");
  });

  it("escreve a data por extenso e o mês e ano em português", () => {
    expect(formatDateLong("2026-11-08T13:10:00Z")).toBe("domingo, 8 de novembro de 2026");
    expect(formatMonthYear("2026-11-08T13:10:00Z")).toBe("novembro de 2026");
  });

  it("recusa uma data que não existe", () => {
    expect(() => formatDate("ontem")).toThrow(RangeError);
  });

  it("escreve os horários do quadro de cultos como 10h10 e 20h00", () => {
    expect(formatScheduleTime("10:10")).toBe("10h10");
    expect(formatScheduleTime("20:00")).toBe("20h00");
    expect(formatScheduleTime("09:05")).toBe("09h05");
    expect(formatScheduleTime("24:00")).toBe("24:00");
    expect(formatScheduleTime("de manhã")).toBe("de manhã");
  });

  it("converte o campo datetime-local para ISO com o deslocamento de Brasília", () => {
    expect(toApiDateTime("2026-11-08T10:10")).toBe("2026-11-08T10:10:00-03:00");
    expect(toApiDateTime("2026-11-08T10:10:30")).toBe("2026-11-08T10:10:30-03:00");
    expect(new Date(toApiDateTime("2026-11-08T10:10")).toISOString()).toBe(
      "2026-11-08T13:10:00.000Z",
    );
  });

  it("aplica o horário de verão quando a data é de um ano em que ele existia", () => {
    // O horário de verão acabou em 2019; em janeiro de 2018 Brasília estava em UTC-2
    expect(toApiDateTime("2018-01-15T10:00")).toBe("2018-01-15T10:00:00-02:00");
  });

  it("recusa um valor que não é data e hora", () => {
    expect(() => toApiDateTime("08/11/2026 10:10")).toThrow(RangeError);
  });

  it("volta do ISO para o campo datetime-local e para o campo de data", () => {
    expect(toDateTimeLocal("2026-11-08T13:10:00Z")).toBe("2026-11-08T10:10");
    expect(toDateInput("2026-11-09T02:30:00Z")).toBe("2026-11-08");
    expect(toDateTimeLocal(toApiDateTime("2026-11-08T10:10"))).toBe("2026-11-08T10:10");
  });

  it("conta os anos completos pela data de Brasília", () => {
    expect(yearsSince("1999-11-08T12:00:00Z", "2026-11-08T12:00:00Z")).toBe(27);
    expect(yearsSince("1999-11-09T12:00:00Z", "2026-11-08T12:00:00Z")).toBe(26);
    expect(yearsSince("1999-12-01T12:00:00Z", "2026-11-08T12:00:00Z")).toBe(26);
  });
});

describe("telefone", () => {
  it("formata celular (11 dígitos) e fixo (10 dígitos), com ou sem +55", () => {
    expect(formatPhone("31999998888")).toBe("(31) 99999-8888");
    expect(formatPhone("+5531999998888")).toBe("(31) 99999-8888");
    expect(formatPhone("(31) 3688-1234")).toBe("(31) 3688-1234");
    expect(formatPhone("553136881234")).toBe("(31) 3688-1234");
  });

  it("devolve como veio o que não é telefone", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("")).toBe("");
  });

  it("grava no formato E.164 e recusa o inválido", () => {
    expect(toE164("(31) 99999-8888")).toBe("+5531999998888");
    expect(toE164("+55 31 3688-1234")).toBe("+553136881234");
    expect(toE164("0999998888")).toBeNull();
    expect(toE164("319999")).toBeNull();
  });

  it("BR-004 exige 10 ou 11 dígitos e DDD entre 11 e 99", () => {
    expect(isValidPhone("31999998888")).toBe(true);
    expect(isValidPhone("3136881234")).toBe(true);
    expect(isValidPhone("10999998888")).toBe(false);
    expect(isValidPhone("319999988889")).toBe(false);
    expect(isValidPhone("999998888")).toBe(false);
  });

  it("não confunde o DDD 55 com o código do país", () => {
    expect(toE164("55999998888")).toBe("+5555999998888");
    expect(toE164("+5555999998888")).toBe("+5555999998888");
  });

  it("monta a máscara enquanto a pessoa digita", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("3")).toBe("(3");
    expect(maskPhone("31")).toBe("(31");
    expect(maskPhone("319")).toBe("(31) 9");
    expect(maskPhone("31999")).toBe("(31) 999");
    expect(maskPhone("3199999")).toBe("(31) 9999-9");
    expect(maskPhone("3136881234")).toBe("(31) 3688-1234");
    expect(maskPhone("31999998888")).toBe("(31) 99999-8888");
  });

  it("corta o excesso e aceita colar com +55 e máscara", () => {
    expect(maskPhone("319999988889999")).toBe("(31) 99999-8888");
    expect(maskPhone("+55 (31) 99999-8888")).toBe("(31) 99999-8888");
    expect(maskPhone("abc")).toBe("");
  });
});

describe("CEP", () => {
  it("formata e mascara", () => {
    expect(formatCep("33400000")).toBe("33400-000");
    expect(formatCep("33400-000")).toBe("33400-000");
    expect(formatCep("334")).toBe("334");
    expect(maskCep("33400")).toBe("33400");
    expect(maskCep("334000")).toBe("33400-0");
    expect(maskCep("33400000999")).toBe("33400-000");
  });

  it("exige 8 dígitos", () => {
    expect(isValidCep("33400-000")).toBe(true);
    expect(isValidCep("3340-000")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("BR-061 aceita o CNPJ da igreja com dígitos verificadores certos", () => {
    expect(isValidCnpj("20.969.119/0001-84")).toBe(true);
    expect(isValidCnpj("20969119000184")).toBe(true);
  });

  it("BR-061 recusa dígito verificador errado, tamanho errado e sequências repetidas", () => {
    expect(isValidCnpj("20969119000185")).toBe(false);
    expect(isValidCnpj("2096911900018")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });

  it("formata e mascara", () => {
    expect(formatCnpj("20969119000184")).toBe("20.969.119/0001-84");
    expect(formatCnpj("123")).toBe("123");
    expect(maskCnpj("")).toBe("");
    expect(maskCnpj("20")).toBe("20");
    expect(maskCnpj("20969")).toBe("20.969");
    expect(maskCnpj("20969119")).toBe("20.969.119");
    expect(maskCnpj("209691190001")).toBe("20.969.119/0001");
    expect(maskCnpj("2096911900018")).toBe("20.969.119/0001-8");
    expect(maskCnpj("20969119000184999")).toBe("20.969.119/0001-84");
  });
});

describe("tamanho de arquivo e números", () => {
  it("mostra o tamanho como o sistema operacional, com espaço sem quebra", () => {
    const nbsp = String.fromCharCode(0x00a0);

    expect(formatFileSize(512)).toBe(`512${nbsp}B`);
    expect(formatFileSize(2048)).toBe(`2${nbsp}KB`);
    expect(formatFileSize(1_843_200)).toBe(`1,8${nbsp}MB`);
    expect(formatFileSize(10 * 1024 * 1024)).toBe(`10${nbsp}MB`);
  });

  it("separa os milhares com ponto", () => {
    expect(formatInteger(1234)).toBe("1.234");
  });
});

describe("datas do calendário, sem fuso", () => {
  it("formatIsoDateLong mostra o dia da semana certo, sem recuar um dia no horário de Brasília", () => {
    expect(formatIsoDateLong("2026-10-25")).toBe("Domingo, 25 de outubro");
    expect(formatIsoDateLong("2026-10-18")).toBe("Domingo, 18 de outubro");
    expect(formatIsoDateLong("sem data")).toBe("sem data");
  });

  it("sundaysAround acha o último e o próximo domingo pela data de Brasília", () => {
    // quarta, 21/10/2026
    expect(sundaysAround("2026-10-21T15:00:00Z")).toEqual({
      last: "2026-10-18",
      next: "2026-10-25",
    });
    // domingo é os dois
    expect(sundaysAround("2026-10-25T15:00:00Z")).toEqual({
      last: "2026-10-25",
      next: "2026-10-25",
    });
    // 01:00 UTC de segunda ainda é domingo à noite em Brasília
    expect(sundaysAround("2026-10-26T01:00:00Z")).toEqual({
      last: "2026-10-25",
      next: "2026-10-25",
    });
    // sábado
    expect(sundaysAround("2026-10-24T15:00:00Z")).toEqual({
      last: "2026-10-18",
      next: "2026-10-25",
    });
  });
});
