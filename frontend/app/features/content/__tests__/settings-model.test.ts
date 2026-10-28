import { describe, expect, it } from "vitest";
import type { AdminSettings } from "../settings-api";
import {
  changedSections,
  toFormValues,
  toPatch,
  validateSections,
  type SettingsFormValues,
} from "../settings-model";

const SAVED: AdminSettings = {
  schedule: [{ day: "Domingo", recurrence: "semanal", activity: "Culto", time: "10:10", mode: "" }],
  campaign_notice: { active: true, title: "Campanha", text: "Ajude." },
  lords_supper_notice: { active: false, text: "" },
  address: {
    street: "Rua A",
    number: "1",
    complement: "",
    neighborhood: "Centro",
    city: "Lagoa Santa",
    state: "MG",
    zip: "33400000",
  },
  map_links: { google_maps_url: "", waze_url: "", embed_url: "" },
  whatsapp: { phone: "+5531991234567", default_text: "" },
  youtube_links: { channel_url: "", live_url: "" },
  social_links: [],
  notification_recipients: { VISITANTE: [], MEMBRO: [], ORACAO: [], CONTATO: [], MINISTERIO: [] },
};

function values(overrides: Partial<SettingsFormValues> = {}): SettingsFormValues {
  return { ...toFormValues(SAVED), ...overrides };
}

describe("toFormValues", () => {
  it("mostra o CEP e o telefone com máscara", () => {
    const form = toFormValues(SAVED);

    expect(form.address.zip).toBe("33400-000");
    expect(form.whatsapp.phone).toBe("(31) 99123-4567");
  });

  it("deixa como está um valor provisório que não é CEP nem telefone", () => {
    const form = toFormValues({
      ...SAVED,
      address: { ...SAVED.address, zip: "TODO(TBD-11)" },
      whatsapp: { phone: "", default_text: "" },
    });

    expect(form.address.zip).toBe("TODO(TBD-11)");
    expect(form.whatsapp.phone).toBe("");
  });
});

describe("changedSections", () => {
  it("é vazio quando nada mudou", () => {
    expect(changedSections(values(), toFormValues(SAVED))).toEqual([]);
  });

  it("aponta só as seções diferentes", () => {
    const changed = changedSections(
      values({
        lords_supper_notice: { active: true, text: "Ceia." },
        social_links: [{ network: "instagram", url: "https://www.instagram.com/x/" }],
      }),
      toFormValues(SAVED),
    );

    expect(changed).toEqual(["lords_supper_notice", "social_links"]);
  });
});

describe("validateSections", () => {
  it("valida só as seções pedidas", () => {
    const broken = values({ address: { ...SAVED.address, zip: "12", state: "M" } });

    expect(validateSections(broken, ["schedule"])).toEqual([]);
    expect(validateSections(broken, ["address"]).map((issue) => issue.path)).toEqual([
      "address.state",
      "address.zip",
    ]);
  });

  it("devolve o caminho de cada campo, inclusive nas listas", () => {
    const issues = validateSections(
      values({
        schedule: [
          { day: "Domingo", time: "9h", activity: "", recurrence: "", mode: "" },
          { day: "Domingo", time: "10:10", activity: "Culto", recurrence: "", mode: "" },
        ],
      }),
      ["schedule"],
    );

    expect(issues.map((issue) => issue.path)).toEqual(["schedule.0.time", "schedule.0.activity"]);
  });

  it("recusa mais de 20 horários e mais de 10 e-mails por tipo (BR-051)", () => {
    const schedule = Array.from({ length: 21 }, () => ({
      day: "Domingo",
      time: "10:00",
      activity: "Culto",
      recurrence: "",
      mode: "",
    }));
    const recipients = Array.from({ length: 11 }, (_, index) => `p${index}@example.com`);

    expect(validateSections(values({ schedule }), ["schedule"])).toHaveLength(1);
    expect(
      validateSections(
        values({
          notification_recipients: {
            ...toFormValues(SAVED).notification_recipients,
            MEMBRO: recipients,
          },
        }),
        ["notification_recipients"],
      ).map((issue) => issue.message),
    ).toEqual(["Informe até 10 e-mails válidos."]);
  });

  it("só aceita https nos links e exige texto num aviso ligado", () => {
    const issues = validateSections(
      values({
        map_links: { google_maps_url: "http://maps.example.com", waze_url: "", embed_url: "" },
        campaign_notice: { active: true, title: "", text: "  " },
      }),
      ["map_links", "campaign_notice"],
    );

    expect(issues.map((issue) => issue.path)).toEqual([
      "map_links.google_maps_url",
      "campaign_notice.text",
    ]);
  });
});

describe("toPatch", () => {
  it("manda só as seções pedidas, limpas", () => {
    const patch = toPatch(
      values({
        address: { ...SAVED.address, zip: "33400-100", state: " sp ", street: " Rua B " },
        schedule: [
          { day: "Domingo", time: "10:10", activity: " Culto ", recurrence: "", mode: "" },
        ],
      }),
      ["address", "schedule"],
    );

    expect(Object.keys(patch)).toEqual(["address", "schedule"]);
    expect(patch.address).toMatchObject({ zip: "33400100", state: "SP", street: "Rua B" });
    expect(patch.schedule?.[0]?.activity).toBe("Culto");
  });
});
