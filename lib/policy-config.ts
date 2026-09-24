export type PolicyEnvironment = {
  POLICY_STATUS?: string;
  POLICY_OPERATOR_NAME?: string;
  POLICY_SUPPORT_CONTACT?: string;
  POLICY_PRIVACY_CONTACT?: string;
  POLICY_GRIEVANCE_CONTACT?: string;
  POLICY_URGENT_SAFETY_CONTACT?: string;
  POLICY_APPEAL_CONTACT?: string;
  POLICY_SUPPORT_RESPONSE_TARGET?: string;
  POLICY_EFFECTIVE_DATE?: string;
  POLICY_VERSION?: string;
  POLICY_LAUNCH_REGIONS?: string;
  POLICY_MINIMUM_AGE?: string;
  POLICY_ENROLLMENT_CRITERIA?: string;
  POLICY_PROVIDER_SUMMARY?: string;
  POLICY_RETENTION_SUMMARY?: string;
};

const clean = (value: string | undefined) => {
  const normalized = value?.trim();
  return !normalized || /^(?:TO COMPLETE|REPLACE_WITH)/i.test(normalized) ? null : normalized;
};

export function readPolicyConfiguration(environment: PolicyEnvironment) {
  const parsedAge = Number.parseInt(environment.POLICY_MINIMUM_AGE ?? "18", 10);
  const minimumAge = Number.isSafeInteger(parsedAge) && parsedAge >= 13 && parsedAge <= 120 ? parsedAge : 18;
  return {
    approved: environment.POLICY_STATUS === "approved",
    operatorName: clean(environment.POLICY_OPERATOR_NAME),
    supportContact: clean(environment.POLICY_SUPPORT_CONTACT),
    privacyContact: clean(environment.POLICY_PRIVACY_CONTACT),
    grievanceContact: clean(environment.POLICY_GRIEVANCE_CONTACT),
    urgentSafetyContact: clean(environment.POLICY_URGENT_SAFETY_CONTACT),
    appealContact: clean(environment.POLICY_APPEAL_CONTACT),
    supportResponseTarget: clean(environment.POLICY_SUPPORT_RESPONSE_TARGET),
    effectiveDate: clean(environment.POLICY_EFFECTIVE_DATE),
    version: clean(environment.POLICY_VERSION),
    launchRegions: clean(environment.POLICY_LAUNCH_REGIONS),
    minimumAge,
    enrollmentCriteria: clean(environment.POLICY_ENROLLMENT_CRITERIA),
    providerSummary: clean(environment.POLICY_PROVIDER_SUMMARY),
    retentionSummary: clean(environment.POLICY_RETENTION_SUMMARY),
  };
}
