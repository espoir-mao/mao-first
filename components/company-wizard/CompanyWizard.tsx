"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ClientChoice,
  CompanyCatalog,
  CompanyFile,
  JurisdictionType,
} from "@/lib/company-types";
import {
  availableChoices,
  officeOptionsFor,
  resolveLegalForm,
  resolveLicenceType,
  selectableActivities,
  selectableAuthorities,
  suggestJurisdiction,
  validateNameProposals,
  validateOffice,
  validateTradeName,
} from "@/lib/company-domain";
import { firstIncompleteStep, WIZARD_STEPS } from "@/lib/company-wizard";
import { firstIssueMessage, issueMessage } from "@/lib/issue-text";
import { formatAed } from "@/lib/company-view";
import { writeActiveSociete } from "@/lib/active-societe";
import { companyDisplayName } from "@/lib/company-view";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getUserDisplayName } from "@/lib/profile";
import {
  createCompanyDraft,
  deleteCompanyDraft,
  getCompanyQuote,
  payAndSubmitCompany,
  saveCompanyActivities,
  saveCompanyHolders,
  saveCompanyNames,
  saveCompanyOffice,
  saveCompanyStructure,
} from "@/app/actions/companies";
import OptionRow from "../societe/OptionRow";
import WizardShell from "../societe/WizardShell";
import CompanyTracking from "../societe/CompanyTracking";
import { useLanguage } from "../LanguageProvider";
import StepHolders, { draftsFromCompany, holderInputOf, holdersSignature, type HolderDraft } from "./StepHolders";
import StepDocuments from "./StepDocuments";
import StepRecap from "./StepRecap";
import { documentChecklist } from "@/lib/company-domain";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

interface CompanyWizardProps {
  catalog: CompanyCatalog;
  /** A draft being resumed (it opens on its first incomplete screen). */
  initial?: CompanyFile;
}

const STEP_COUNT = WIZARD_STEPS.length;

export default function CompanyWizard({ catalog, initial }: CompanyWizardProps) {
  const router = useRouter();
  const { t, tEmirate } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState<CompanyFile | null>(initial ?? null);
  const [step, setStep] = useState(() => (initial ? firstIncompleteStep(initial, catalog) : 0));

  // selections, seeded from the draft
  const [clientsInUae, setClientsInUae] = useState<boolean | null>(
    initial?.jurisdiction_type ? initial.jurisdiction_type === "MAINLAND" : null
  );
  const [jurisdiction, setJurisdiction] = useState<JurisdictionType | null>(initial?.jurisdiction_type ?? null);
  const [authorityId, setAuthorityId] = useState<string | null>(initial?.authority_id ?? null);
  const [choice, setChoice] = useState<ClientChoice | null>(initial?.client_choice ?? null);
  const [activityIds, setActivityIds] = useState<string[]>(initial?.activity_ids ?? []);
  const [names, setNames] = useState<string[]>(() => {
    const byRank = (r: number) => initial?.names.find((n) => n.rank === r)?.proposed_name ?? "";
    return [byRank(1), byRank(2), byRank(3)];
  });
  const [officeTypeId, setOfficeTypeId] = useState<string | null>(initial?.office_type_id ?? null);
  const [visaQuota, setVisaQuota] = useState<number>(initial?.visa_quota ?? 0);
  const [accounting, setAccounting] = useState<boolean>(initial?.accounting ?? false);
  const [drafts, setDrafts] = useState<HolderDraft[]>(() =>
    initial ? draftsFromCompany(initial, initial.client_choice) : []
  );
  const [savedSignature, setSavedSignature] = useState<string | null>(() =>
    initial && initial.shareholders.length > 0
      ? holdersSignature(draftsFromCompany(initial, initial.client_choice))
      : null
  );
  const [quote, setQuote] = useState<{ packageAed: number; officeAed: number; maoFeeAed: number; totalAed: number } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const stepId = WIZARD_STEPS[step];
  const authority = catalog.authorities.find((a) => a.id === authorityId) ?? null;
  const legalForm =
    authorityId && choice
      ? resolveLegalForm(authorityId, choice, catalog.authorityLegalForms, catalog.legalForms)
      : null;

  /* ---------------------------------------------------------- derived */

  const choices = useMemo(
    () => (authority ? availableChoices(authority, catalog.authorityLegalForms, catalog.legalForms) : []),
    [authority, catalog.authorityLegalForms, catalog.legalForms]
  );

  const activityResolution = useMemo(
    () =>
      authorityId
        ? resolveLicenceType(activityIds, catalog.activities, authorityId, catalog.licenceTypes)
        : { licenceTypeId: null, issues: [] },
    [activityIds, authorityId, catalog.activities, catalog.licenceTypes]
  );

  const nameIssues = names.map((n) => (n.trim() ? validateTradeName(n) : []));
  const namesComplete = validateNameProposals(names).length === 0;

  const officeOptions = useMemo(
    () => (authorityId ? officeOptionsFor(authorityId, catalog.officeOptions, catalog.officeTypes) : []),
    [authorityId, catalog.officeOptions, catalog.officeTypes]
  );
  const mandatoryEjari = jurisdiction === "MAINLAND";
  const selectableOffices = officeOptions.filter((o) => !mandatoryEjari || o.type.provides_ejari);
  // Mainland: the Ejari-registered office is the only possible one, picked for the client.
  const autoOffice = mandatoryEjari
    ? [...selectableOffices].sort((a, b) => a.option.annual_price_aed - b.option.annual_price_aed)[0] ?? null
    : null;
  const autoOfficeId = autoOffice?.type.id ?? null;
  const chosenOffice = officeOptions.find((o) => o.type.id === officeTypeId) ?? null;
  const officeIssues =
    jurisdiction && authorityId && officeTypeId
      ? validateOffice(jurisdiction, authorityId, officeTypeId, visaQuota, catalog.officeOptions, catalog.officeTypes)
      : [];

  const holdersDone = Boolean(company) && company!.shareholders.length > 0 && savedSignature === holdersSignature(drafts) &&
    Math.round(company!.shareholders.reduce((s, h) => s + Number(h.share_pct), 0) * 100) === 10000;

  const missingDocs =
    company && company.authority_id && company.legal_form_id
      ? documentChecklist(
          company.authority_id,
          company.legal_form_id,
          company.activity_ids,
          catalog.requiredDocuments,
          company.shareholders.map((s) => ({
            id: s.id,
            isPerson: s.person_id !== null,
            isManager: s.is_manager,
            isParentCompany: s.parent_company_id !== null,
          })),
          company.documents,
          company.lease_mode
        ).filter((i) => !i.provided && !i.optional).length
      : 0;
  const leaseMissing = company?.jurisdiction_type === "MAINLAND" && !company.lease_mode;

  useEffect(() => {
    if (stepId === "office" && autoOfficeId && officeTypeId !== autoOfficeId) {
      setOfficeTypeId(autoOfficeId);
      setVisaQuota((q) => Math.min(q, autoOffice?.option.visa_quota_max ?? q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, autoOfficeId]);

  // quote when the payment screen opens
  useEffect(() => {
    if (stepId !== "payment" || !company) return;
    let cancelled = false;
    setQuote(null);
    setQuoteError(null);
    getCompanyQuote(company.id).then((r) => {
      if (cancelled) return;
      if (r.success && r.data) setQuote(r.data);
      else setQuoteError(r.error ?? t("company.pay.quote.error"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, company?.id]);

  /* ------------------------------------------------------- navigation */

  function fail(result: { error?: string; issues?: { code: string; params?: Record<string, string | number> }[] }) {
    setError(firstIssueMessage(t, result, t("wizard.submit.error")));
  }

  function goNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function currentNextDisabled(): boolean {
    switch (stepId) {
      case "regime":
        return !jurisdiction;
      case "authority":
        return !authorityId;
      case "structure":
        return !choice || !legalForm;
      case "activities":
        return activityIds.length === 0 || activityResolution.issues.length > 0;
      case "name":
        return !namesComplete;
      case "office":
        return !officeTypeId || officeIssues.length > 0;
      case "holders":
        return !holdersDone;
      case "documents":
        return missingDocs > 0 || leaseMissing;
      case "payment":
        return !quote;
      default:
        return false;
    }
  }

  async function requesterName(): Promise<string> {
    let name = t("societe.requester.unknown");
    try {
      if (isSupabaseConfigured()) {
        const { data } = await getSupabaseClient().auth.getSession();
        const n = getUserDisplayName(data.session?.user ?? null);
        if (n) name = n;
      }
    } catch {
      // keep the fallback: never block a creation on this
    }
    return name;
  }

  /** Creates the draft (or restarts it when the regime changed). Null on failure. */
  async function ensureDraftCompany(): Promise<CompanyFile | null> {
    if (company && company.jurisdiction_type === jurisdiction) return company;
    if (company) {
      // the regime decides every following choice: start a fresh draft
      const del = await deleteCompanyDraft(company.id);
      if (!del.success) {
        fail(del);
        return null;
      }
      setCompany(null);
      setAuthorityId(null);
      setChoice(null);
      setActivityIds([]);
      setOfficeTypeId(null);
      setVisaQuota(0);
    }
    const r = await createCompanyDraft({ jurisdiction: jurisdiction!, requesterName: await requesterName() });
    if (!r.success || !r.data) {
      fail(r);
      return null;
    }
    setCompany(r.data);
    window.history.replaceState(null, "", `/societes/${r.data.id}/modifier`);
    return r.data;
  }

  /** Keeps whatever is filled in on the current screen and leaves, to resume later. */
  function handleSaveDraft() {
    setError(null);
    if (!jurisdiction) {
      router.push("/societes");
      return;
    }
    startTransition(async () => {
      const c = await ensureDraftCompany();
      if (!c) return;
      let r: { success: boolean; error?: string; issues?: { code: string; params?: Record<string, string | number> }[] } = { success: true };
      switch (stepId) {
        case "authority":
        case "structure":
          r = await saveCompanyStructure(
            c.id,
            {
              jurisdiction,
              authorityId: authorityId ?? "",
              clientChoice: authorityId && authorityId === c.authority_id ? choice : null,
            },
            true
          );
          break;
        case "activities":
          r = await saveCompanyActivities(c.id, activityIds, true);
          break;
        case "name":
          r = await saveCompanyNames(c.id, names, true);
          break;
        case "office":
          r = await saveCompanyOffice(
            c.id,
            { office_type_id: officeTypeId, visa_quota: officeTypeId ? visaQuota : null, accounting },
            true
          );
          break;
        case "holders":
          if (c.client_choice) r = await saveCompanyHolders(c.id, drafts.map(holderInputOf), true);
          break;
        default:
          break;
      }
      if (!r.success) return fail(r);
      router.push("/societes");
      router.refresh();
    });
  }

  function handleNext() {
    setError(null);
    if (currentNextDisabled()) return;
    startTransition(async () => {
      switch (stepId) {
        case "regime": {
          const c = await ensureDraftCompany();
          if (!c) return;
          return goNext();
        }
        case "authority": {
          if (company && company.authority_id !== authorityId) setChoice(null);
          return goNext();
        }
        case "structure": {
          const r = await saveCompanyStructure(company!.id, {
            jurisdiction: jurisdiction!,
            authorityId: authorityId!,
            clientChoice: choice!,
          });
          if (!r.success || !r.data) return fail(r);
          setCompany(r.data);
          setActivityIds(r.data.activity_ids);
          if (!r.data.office_type_id) {
            setOfficeTypeId(null);
            setVisaQuota(0);
          }
          if (r.data.shareholders.length === 0) setDrafts(draftsFromCompany(r.data, choice));
          return goNext();
        }
        case "activities": {
          const r = await saveCompanyActivities(company!.id, activityIds);
          if (!r.success || !r.data) return fail(r);
          setCompany(r.data);
          return goNext();
        }
        case "name": {
          const r = await saveCompanyNames(company!.id, names);
          if (!r.success || !r.data) return fail(r);
          setCompany(r.data);
          return goNext();
        }
        case "office": {
          const r = await saveCompanyOffice(company!.id, {
            office_type_id: (autoOfficeId ?? officeTypeId)!,
            visa_quota: visaQuota,
            accounting,
          });
          if (!r.success || !r.data) return fail(r);
          setCompany(r.data);
          if (drafts.length === 0) setDrafts(draftsFromCompany(r.data, r.data.client_choice));
          return goNext();
        }
        case "holders":
        case "documents":
        case "recap":
          return goNext();
        case "payment": {
          const r = await payAndSubmitCompany(company!.id, await requesterName());
          if (!r.success || !r.data) return fail(r);
          setCompany(r.data);
          writeActiveSociete({
            id: r.data.id,
            name: companyDisplayName(r.data) ?? t("company.draft.untitled"),
          });
          return goNext();
        }
        case "tracking": {
          router.push("/");
          router.refresh();
        }
      }
    });
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  const nextLabel =
    stepId === "payment"
      ? t("company.pay.submit")
      : stepId === "tracking"
        ? t("company.tracking.done")
        : t("wizard.next");

  /* -------------------------------------------------------- step bodies */

  function toggleActivity(id: string) {
    setActivityIds((prev) => (prev.indexOf(id) === -1 ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  let body: React.ReactNode = null;

  if (stepId === "regime") {
    const suggested = clientsInUae === null ? null : suggestJurisdiction(clientsInUae);
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-neutral-900">{t("company.regime.question")}</p>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => {
                  setClientsInUae(v);
                  setJurisdiction(suggestJurisdiction(v));
                }}
                aria-pressed={clientsInUae === v}
                className={`rounded-full border px-5 py-2 text-sm font-bold transition ${
                  clientsInUae === v
                    ? "border-[#7a9a5a] bg-spring-50 text-[#4a5f34]"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {v ? t("company.yes") : t("company.no")}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          {(["MAINLAND", "FREE_ZONE"] as JurisdictionType[]).map((j) => (
            <OptionRow
              key={j}
              label={`${t(`jurisdiction.${j}`)}${suggested === j ? ` — ${t("company.regime.recommended")}` : ""}`}
              description={t(`company.regime.${j}.desc`)}
              selected={jurisdiction === j}
              onClick={() => setJurisdiction(j)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (stepId === "authority" && jurisdiction) {
    const available = selectableAuthorities(catalog.authorities, jurisdiction);
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          {available.map((a) => (
            <OptionRow
              key={a.id}
              label={a.name}
              description={`${tEmirate(a.emirate)}${a.website ? ` · ${a.website.replace(/^https?:\/\//, "")}` : ""}`}
              selected={authorityId === a.id}
              onClick={() => setAuthorityId(a.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (stepId === "structure" && authority) {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          {choices.map((c) => (
            <OptionRow
              key={c}
              label={t(`company.choice.${c}`)}
              description={t(`company.choice.${c}.desc`)}
              selected={choice === c}
              onClick={() => setChoice(c)}
            />
          ))}
        </div>
        {!authority.allows_freelance && (
          <p className="text-xs text-neutral-500">{t("company.choice.noFreelance")}</p>
        )}
        {legalForm && (
          <div className="rounded-xl border border-[#7a9a5a]/40 bg-spring-50 px-4 py-3 text-sm text-[#3f5029]">
            <span className="text-xs font-bold uppercase tracking-wide">{t("company.structure.legalForm")}</span>
            <p className="mt-0.5 font-bold">{legalForm.label}</p>
            <p className="text-xs">{legalForm.description.replace(/^\[DÉMO\]\s*/, "")}</p>
          </div>
        )}
      </div>
    );
  }

  if (stepId === "activities" && authorityId) {
    const selectable = selectableActivities(catalog.activities, authorityId);
    const lockedType = activityIds.length
      ? catalog.activities.find((a) => a.id === activityIds[0])?.licence_type_id ?? null
      : null;
    const types = catalog.licenceTypes.filter((lt) => selectable.some((a) => a.licence_type_id === lt.id));
    body = (
      <div className="flex flex-col gap-4">
        {types.map((lt) => (
          <div key={lt.id} className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">{lt.label}</span>
            {selectable
              .filter((a) => a.licence_type_id === lt.id)
              .map((a) => {
                const disabled = lockedType !== null && lockedType !== lt.id;
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                      activityIds.indexOf(a.id) !== -1
                        ? "border-[#7a9a5a] bg-spring-50 text-[#3f5029]"
                        : "border-neutral-200 text-neutral-700"
                    } ${disabled ? "opacity-40" : "cursor-pointer"}`}
                  >
                    <input type="checkbox" disabled={disabled} checked={activityIds.indexOf(a.id) !== -1} onChange={() => toggleActivity(a.id)} />
                    {a.label}
                  </label>
                );
              })}
          </div>
        ))}
        {activityResolution.licenceTypeId && (
          <div className="rounded-xl border border-[#7a9a5a]/40 bg-spring-50 px-4 py-3 text-sm text-[#3f5029]">
            <span className="text-xs font-bold uppercase tracking-wide">{t("company.about.licenceType")}</span>
            <p className="mt-0.5 font-bold">
              {catalog.licenceTypes.find((l) => l.id === activityResolution.licenceTypeId)?.label}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (stepId === "name") {
    body = (
      <div className="flex flex-col gap-3">
        {names.map((value, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-600">{t(`step.names.choice${i + 1}`)}</label>
            <input
              value={value}
              maxLength={60}
              onChange={(e) => setNames((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={t("step.names.placeholder")}
              className={inputClass}
            />
            {nameIssues[i].map((issue) => (
              <span key={issue.code} className="text-xs text-red-600">
                {issueMessage(t, issue)}
              </span>
            ))}
          </div>
        ))}
        {names.some((n) => n.trim()) &&
          validateNameProposals(names)
            .filter((i) => i.code === "NAMES_DUPLICATE")
            .map((i) => (
              <span key={`d${i.params?.rank}`} className="text-xs text-red-600">
                {issueMessage(t, i)}
              </span>
            ))}
      </div>
    );
  }

  if (stepId === "office" && authorityId) {
    const max = chosenOffice?.option.visa_quota_max ?? 0;
    body = (
      <div className="flex flex-col gap-4">
        {!mandatoryEjari && (
          <div className="flex flex-col">
            {selectableOffices.map(({ option, type }) => (
              <OptionRow
                key={type.id}
                label={`${type.label} — ${formatAed(option.annual_price_aed)} / ${t("company.office.perYear")}`}
                description={type.description.replace(/^\[DÉMO\]\s*/, "")}
                selected={officeTypeId === type.id}
                onClick={() => {
                  setOfficeTypeId(type.id);
                  setVisaQuota((q) => Math.min(q, option.visa_quota_max));
                }}
              />
            ))}
          </div>
        )}
        {chosenOffice && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-600">{t("company.office.visaQuota")}</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setVisaQuota((q) => Math.max(0, q - 1))} className="h-9 w-9 rounded-full border border-neutral-300 text-lg font-bold text-neutral-600 hover:bg-neutral-50" aria-label="−">
                −
              </button>
              <span className="w-8 text-center text-lg font-extrabold text-neutral-900">{visaQuota}</span>
              <button type="button" onClick={() => setVisaQuota((q) => Math.min(max, q + 1))} className="h-9 w-9 rounded-full border border-neutral-300 text-lg font-bold text-neutral-600 hover:bg-neutral-50" aria-label="+">
                +
              </button>
              <span className="text-xs text-neutral-500">{t("company.office.quotaMax", { n: max })}</span>
            </div>
            {officeIssues.map((i) => (
              <span key={i.code} className="text-xs text-red-600">
                {issueMessage(t, i)}
              </span>
            ))}
          </div>
        )}
        <label className="flex items-start gap-3 rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-700">
          <input type="checkbox" checked={accounting} onChange={(e) => setAccounting(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="font-bold">{t("step.accounting.title")}</span>
            <span className="block text-xs text-neutral-500">{t("company.office.accountingNote")}</span>
          </span>
        </label>
      </div>
    );
  }

  if (stepId === "holders" && company && legalForm) {
    body = (
      <StepHolders
        company={company}
        legalForm={legalForm}
        drafts={drafts}
        setDrafts={setDrafts}
        savedSignature={savedSignature}
        onSaved={(c, sig) => {
          setCompany(c);
          setSavedSignature(sig);
        }}
        onCompanyUpdated={setCompany}
      />
    );
  }

  if (stepId === "documents" && company) {
    body = <StepDocuments company={company} catalog={catalog} onUpdated={setCompany} />;
  }

  if (stepId === "recap" && company) {
    body = <StepRecap company={company} catalog={catalog} onEdit={(target) => setStep(WIZARD_STEPS.indexOf(target))} />;
  }

  if (stepId === "payment" && company) {
    body = (
      <div className="flex flex-col gap-4">
        {quoteError && <p className="text-sm text-red-600">{quoteError}</p>}
        {!quote && !quoteError && <p className="text-sm text-neutral-500">{t("company.pay.loading")}</p>}
        {quote && (
          <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-sm">
            <Line label={t("company.pay.package", { authority: authority?.code ?? "", form: legalForm?.code ?? "", visas: company.visa_quota ?? 0 })} value={formatAed(quote.packageAed)} />
            <Line
              label={
                company.lease_mode === "OWN"
                  ? t("company.pay.officeOwnLease")
                  : t("company.pay.office", { office: company.office_type?.label ?? "" })
              }
              value={formatAed(quote.officeAed)}
            />
            <Line label={t("company.pay.maoFee")} value={formatAed(quote.maoFeeAed)} />
            <Line label={t("company.pay.total")} value={formatAed(quote.totalAed)} strong />
          </div>
        )}
      </div>
    );
  }

  if (stepId === "tracking" && company) {
    body = (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-spring-50 px-4 py-3 text-sm text-[#3f5029]">{t("company.tracking.submitted")}</p>
        <CompanyTracking company={company} onUpdated={setCompany} />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleNext();
      }}
      className="flex flex-col gap-4"
    >
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      <WizardShell
        title={t(`company.step.${stepId}.title`)}
        subtitle={t(`company.step.${stepId}.subtitle`)}
        onBack={step > 0 && stepId !== "tracking" ? handleBack : undefined}
        onCancel={stepId === "tracking" ? undefined : () => router.push("/societes")}
        stepIndex={step}
        stepCount={STEP_COUNT}
        footer={
          <div className="flex flex-col gap-2">
            <button type="submit" disabled={isPending || currentNextDisabled()} className={primaryButtonClass}>
              {isPending ? t("wizard.submitting") : nextLabel}
            </button>
            {stepId !== "tracking" && stepId !== "payment" && (
              <button type="button" disabled={isPending} onClick={handleSaveDraft} className={`${secondaryButtonClass} w-full py-3`}>
                {t("wizard.saveDraft")}
              </button>
            )}
          </div>
        }
      >
        {body}
      </WizardShell>
    </form>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${strong ? "bg-neutral-50 font-extrabold text-neutral-900" : "text-neutral-700"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
