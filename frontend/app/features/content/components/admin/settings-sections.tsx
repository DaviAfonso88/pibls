import { PlusIcon, Trash2Icon } from "lucide-react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { maskCep, maskPhone } from "~/shared/format";
import { Button } from "~/shared/ui/button";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { Switch } from "~/shared/ui/switch";
import {
  MAX_SCHEDULE_ITEMS,
  MAX_SOCIAL_LINKS,
  WEEKDAYS,
  settingsMessages as text,
} from "../../settings-messages";
import type { SettingsFormValues } from "../../settings-model";
import { FormSection } from "./form-parts";

type Form = UseFormReturn<SettingsFormValues>;

/** Os dias da semana; um dia fora da lista (conteúdo antigo) continua escolhido até a pessoa trocar. */
function dayOptions(current: string): readonly string[] {
  return current === "" || WEEKDAYS.some((day) => day === current)
    ? WEEKDAYS
    : [...WEEKDAYS, current];
}

/** Horários dos cultos (design: AdminConfiguracoes, "Horários dos cultos"; até 20 itens). */
export function ScheduleSection({ form }: { form: Form }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "schedule" });
  const full = fields.length >= MAX_SCHEDULE_ITEMS;

  return (
    <FormSection title={text.schedule.title} id="t-horarios">
      <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
        {text.schedule.count(fields.length)}
      </p>

      {fields.length === 0 ? (
        <p className="m-0 text-muted-foreground">{text.schedule.empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {fields.map((field, index) => {
            const row = errors.schedule?.[index];
            const position = index + 1;
            const name = form.getValues(`schedule.${index}.activity`);
            return (
              <li
                key={field.id}
                className="grid grid-cols-1 items-start gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0 md:grid-cols-[10rem_8rem_1fr_44px]"
              >
                <FormField
                  id={`schedule-${index}-day`}
                  label={text.schedule.day}
                  error={row?.day?.message}
                >
                  {(control) => (
                    <NativeSelect
                      {...control}
                      className="w-full"
                      aria-label={text.schedule.rowLabel(text.schedule.day, position)}
                      {...register(`schedule.${index}.day`)}
                    >
                      {dayOptions(form.getValues(`schedule.${index}.day`)).map((day) => (
                        <NativeSelectOption key={day} value={day}>
                          {day}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>

                <FormField
                  id={`schedule-${index}-time`}
                  label={text.schedule.time}
                  error={row?.time?.message}
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="time"
                      aria-label={text.schedule.rowLabel(text.schedule.time, position)}
                      {...register(`schedule.${index}.time`)}
                      autoComplete="off"
                    />
                  )}
                </FormField>

                <div className="flex flex-col gap-3">
                  <FormField
                    id={`schedule-${index}-activity`}
                    label={text.schedule.activity}
                    error={row?.activity?.message}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="text"
                        maxLength={80}
                        aria-label={text.schedule.rowLabel(text.schedule.activity, position)}
                        {...register(`schedule.${index}.activity`)}
                        autoComplete="off"
                      />
                    )}
                  </FormField>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      id={`schedule-${index}-recurrence`}
                      label={text.schedule.recurrence}
                      optionalLabel={text.optional}
                      error={row?.recurrence?.message}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          type="text"
                          maxLength={60}
                          placeholder={text.schedule.recurrencePlaceholder}
                          {...register(`schedule.${index}.recurrence`)}
                          autoComplete="off"
                        />
                      )}
                    </FormField>
                    <FormField
                      id={`schedule-${index}-mode`}
                      label={text.schedule.mode}
                      optionalLabel={text.optional}
                      error={row?.mode?.message}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          type="text"
                          maxLength={80}
                          placeholder={text.schedule.modePlaceholder}
                          {...register(`schedule.${index}.mode`)}
                          autoComplete="off"
                        />
                      )}
                    </FormField>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="mt-0 size-11 md:mt-7"
                  aria-label={text.schedule.remove(name, position)}
                  onClick={() => remove(index)}
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={full}
          onClick={() =>
            append({ day: "Domingo", time: "", activity: "", recurrence: "", mode: "" })
          }
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {text.schedule.add}
        </Button>
        <span className="text-sm text-muted-foreground">{text.schedule.hint}</span>
      </div>
    </FormSection>
  );
}

/** Um aviso que liga e desliga (campanha ou Ceia). */
function NoticeSwitch({
  id,
  title,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="m-0 text-lg font-extrabold">
        {title}
      </h2>
      <Switch checked={checked} onCheckedChange={onChange} aria-labelledby={id} />
    </div>
  );
}

/** Aviso da campanha e aviso da Ceia, lado a lado (design: dois cartões). */
export function NoticesSection({ form }: { form: Form }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const campaignOn = watch("campaign_notice.active");
  const supperOn = watch("lords_supper_notice.active");

  return (
    <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
      <section
        aria-labelledby="t-campanha"
        className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5"
      >
        <NoticeSwitch
          id="t-campanha"
          title={text.campaign.title}
          checked={campaignOn}
          onChange={(value) =>
            setValue("campaign_notice.active", value, { shouldDirty: true, shouldTouch: true })
          }
        />
        <FormField
          id="campaign-title"
          label={text.campaign.titleField}
          optionalLabel={text.optional}
          error={errors.campaign_notice?.title?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="text"
              maxLength={80}
              {...register("campaign_notice.title")}
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          id="campaign-text"
          label={text.campaign.text}
          error={errors.campaign_notice?.text?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="text"
              maxLength={500}
              {...register("campaign_notice.text")}
              autoComplete="off"
            />
          )}
        </FormField>
        <span className="text-sm text-muted-foreground">
          {campaignOn ? text.campaign.on : text.campaign.off}
        </span>
      </section>

      <section
        aria-labelledby="t-ceia"
        className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5"
      >
        <NoticeSwitch
          id="t-ceia"
          title={text.supper.title}
          checked={supperOn}
          onChange={(value) =>
            setValue("lords_supper_notice.active", value, { shouldDirty: true, shouldTouch: true })
          }
        />
        <FormField
          id="supper-text"
          label={text.supper.text}
          hint={text.supper.textHint}
          error={errors.lords_supper_notice?.text?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="text"
              maxLength={300}
              {...register("lords_supper_notice.text")}
              autoComplete="off"
            />
          )}
        </FormField>
        <span className="text-sm text-muted-foreground">
          {supperOn ? text.supper.on : text.supper.off}
        </span>
      </section>
    </div>
  );
}

/** Endereço do templo e links de mapa. */
export function AddressSection({ form }: { form: Form }) {
  const {
    register,
    setValue,
    formState: { errors },
  } = form;
  const address = errors.address;
  const maps = errors.map_links;

  return (
    <FormSection title={text.address.title} id="t-endereco">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
        <FormField id="addr-street" label={text.address.street} error={address?.street?.message}>
          {(control) => (
            <Input
              {...control}
              type="text"
              autoComplete="off"
              maxLength={120}
              {...register("address.street")}
            />
          )}
        </FormField>
        <FormField id="addr-number" label={text.address.number} error={address?.number?.message}>
          {(control) => (
            <Input
              {...control}
              type="text"
              autoComplete="off"
              maxLength={20}
              {...register("address.number")}
            />
          )}
        </FormField>
      </div>
      <FormField
        id="addr-complement"
        label={text.address.complement}
        optionalLabel={text.optional}
        error={address?.complement?.message}
      >
        {(control) => (
          <Input
            {...control}
            type="text"
            autoComplete="off"
            maxLength={80}
            {...register("address.complement")}
          />
        )}
      </FormField>
      <FormField
        id="addr-neighborhood"
        label={text.address.neighborhood}
        error={address?.neighborhood?.message}
      >
        {(control) => (
          <Input
            {...control}
            type="text"
            autoComplete="off"
            maxLength={80}
            {...register("address.neighborhood")}
          />
        )}
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5rem_9rem]">
        <FormField id="addr-city" label={text.address.city} error={address?.city?.message}>
          {(control) => (
            <Input
              {...control}
              type="text"
              autoComplete="off"
              maxLength={80}
              {...register("address.city")}
            />
          )}
        </FormField>
        <FormField id="addr-state" label={text.address.state} error={address?.state?.message}>
          {(control) => (
            <Input
              {...control}
              type="text"
              autoComplete="off"
              maxLength={2}
              className="uppercase"
              {...register("address.state")}
            />
          )}
        </FormField>
        <FormField id="addr-zip" label={text.address.zip} error={address?.zip?.message}>
          {(control) => (
            <Input
              {...control}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              {...register("address.zip", {
                onChange: (event: { target: { value: string } }) =>
                  setValue("address.zip", maskCep(event.target.value), { shouldDirty: true }),
              })}
            />
          )}
        </FormField>
      </div>
      <FormField id="map-google" label={text.address.maps} error={maps?.google_maps_url?.message}>
        {(control) => (
          <Input
            {...control}
            type="url"
            placeholder="https://maps.app.goo.gl/…"
            {...register("map_links.google_maps_url")}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>
      <FormField id="map-waze" label={text.address.waze} error={maps?.waze_url?.message}>
        {(control) => (
          <Input
            {...control}
            type="url"
            placeholder="https://waze.com/ul/…"
            {...register("map_links.waze_url")}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>
      <FormField
        id="map-embed"
        label={text.address.embed}
        hint={text.address.embedHint}
        error={maps?.embed_url?.message}
      >
        {(control) => (
          <Input
            {...control}
            type="url"
            placeholder="https://www.google.com/maps/embed?…"
            {...register("map_links.embed_url")}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>
    </FormSection>
  );
}

/** WhatsApp, YouTube e redes sociais. */
export function ChannelsSection({ form }: { form: Form }) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "social_links" });
  const full = fields.length >= MAX_SOCIAL_LINKS;

  return (
    <FormSection title={text.channels.title} id="t-links">
      <FormField
        id="whats-phone"
        label={text.channels.whatsapp}
        error={errors.whatsapp?.phone?.message}
      >
        {(field) => (
          <Input
            {...field}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            {...register("whatsapp.phone", {
              onChange: (event: { target: { value: string } }) =>
                setValue("whatsapp.phone", maskPhone(event.target.value), { shouldDirty: true }),
            })}
          />
        )}
      </FormField>
      <FormField
        id="whats-text"
        label={text.channels.whatsappText}
        optionalLabel={text.optional}
        error={errors.whatsapp?.default_text?.message}
      >
        {(field) => (
          <Input
            {...field}
            type="text"
            maxLength={200}
            {...register("whatsapp.default_text")}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField
        id="yt-channel"
        label={text.channels.youtubeChannel}
        error={errors.youtube_links?.channel_url?.message}
      >
        {(field) => (
          <Input
            {...field}
            type="url"
            placeholder="https://www.youtube.com/@…"
            {...register("youtube_links.channel_url")}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>
      <FormField
        id="yt-live"
        label={text.channels.youtubeLive}
        error={errors.youtube_links?.live_url?.message}
      >
        {(field) => (
          <Input
            {...field}
            type="url"
            placeholder="https://www.youtube.com/live/…"
            {...register("youtube_links.live_url")}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>

      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="mb-1 p-0 font-bold">{text.channels.social}</legend>
        {fields.length === 0 ? (
          <p className="m-0 text-muted-foreground">{text.channels.socialEmpty}</p>
        ) : null}
        {fields.map((field, index) => {
          const row = errors.social_links?.[index];
          return (
            <div
              key={field.id}
              className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[8rem_1fr_44px]"
            >
              <FormField
                id={`social-${index}-network`}
                label={text.channels.socialNetwork}
                error={row?.network?.message}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    maxLength={30}
                    placeholder="Ex.: instagram…"
                    {...register(`social_links.${index}.network`)}
                    autoComplete="off"
                  />
                )}
              </FormField>
              <FormField
                id={`social-${index}-url`}
                label={text.channels.socialUrl}
                error={row?.url?.message}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="url"
                    placeholder="https://www.instagram.com/…"
                    {...register(`social_links.${index}.url`)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 sm:mt-7"
                aria-label={text.channels.socialRemove(
                  form.getValues(`social_links.${index}.network`),
                  index + 1,
                )}
                onClick={() => remove(index)}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </div>
          );
        })}
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={full}
            onClick={() => append({ network: "", url: "" })}
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            {text.channels.socialAdd}
          </Button>
        </div>
      </fieldset>
    </FormSection>
  );
}
