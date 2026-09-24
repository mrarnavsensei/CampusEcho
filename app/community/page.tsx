import { env } from "cloudflare:workers";
import Link from "next/link";
import { readPolicyConfiguration, type PolicyEnvironment } from "@/lib/policy-config";
export default function CommunityInformation() {
  const policy = readPolicyConfiguration(env as PolicyEnvironment);
  return <main className="echo-policy"><h1>Community and privacy information</h1>
    <nav className="policy-links policy-index" aria-label="Policy sections"><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#community-guidelines">Community guidelines</a><a href="#retention">Retention and deletion</a><a href="#support">Support</a><a href="#appeals">Appeals</a></nav>
    {!policy.approved && <p><strong>Policy preview.</strong> Operator approval and publication details are still pending. Registration must remain closed for a public launch until they are complete.</p>}
    <p>CampusCrate Echo is for people aged {policy.minimumAge} or older at approved colleges{policy.operatorName ? ` and is operated by ${policy.operatorName}` : ""}.</p>
    {policy.enrollmentCriteria && <p><strong>Eligibility:</strong> {policy.enrollmentCriteria}</p>}
    <section id="community-guidelines"><h2>Community guidelines</h2><p>Do not harass, threaten, impersonate others, publish personal information, or share unlawful material. Use reporting and blocking when needed. Reports are reviewed by authorized administrators.</p></section>
    <section id="privacy"><h2>Privacy</h2><p>Anonymous posts do not include your profile identity in routine feed responses. The server retains authorship to enforce safety rules. Identified posts and your profile are visible according to your privacy settings. College email verification proves mailbox access, not current enrollment.</p></section>
    <h2>Private messages</h2><p>Messages are restricted to conversation participants. They are not end-to-end encrypted. Reporting a message creates a safety case; routine admin screens do not disclose private message bodies.</p>
    <section id="terms"><h2>Terms of use</h2><p>Use the service only if you meet the configured age and college eligibility requirements. Keep your credentials private, provide accurate account information, and follow the community guidelines. The current chess feature is casual play and does not provide tournament adjudication, prizes, or anti-cheat certification.</p></section>
    <section id="retention"><h2>Account retention and deletion</h2><p>You can request account deletion in your profile. Access ends immediately; retained safety records and backups follow the configured operator retention process.</p>
    {policy.retentionSummary && <p><strong>Retention:</strong> {policy.retentionSummary}</p>}</section>
    {policy.providerSummary && <p><strong>Service providers:</strong> {policy.providerSummary}</p>}
    <section id="support"><h2>Support and grievance contact</h2>
    {policy.supportContact ? <p>Support: {policy.supportContact}{policy.supportResponseTarget ? ` (${policy.supportResponseTarget})` : ""}.</p> : <p>Support contact pending operator configuration.</p>}
    {policy.privacyContact && <p>Privacy contact: {policy.privacyContact}.</p>}
    {policy.grievanceContact && <p>Grievance contact: {policy.grievanceContact}.</p>}</section>
    <section id="appeals"><h2>Appeals and safety</h2>
    {policy.appealContact ? <p>Appeals: {policy.appealContact}.</p> : <p>Appeal instructions are pending operator configuration.</p>}
    {policy.urgentSafetyContact && <p>Urgent safety escalation: {policy.urgentSafetyContact}. This service is not an emergency response service.</p>}</section>
    {(policy.effectiveDate || policy.version || policy.launchRegions) && <p>{policy.effectiveDate ? `Effective ${policy.effectiveDate}. ` : ""}{policy.version ? `Version ${policy.version}. ` : ""}{policy.launchRegions ? `Launch regions: ${policy.launchRegions}.` : ""}</p>}
    <Link href="/">Back to Echo</Link></main>;
}
