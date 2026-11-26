"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import InteractiveBackground from '@/components/ui/InteractiveBackground';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import styles from './page.module.css';
import { auth, db } from '@/lib/firebase/clientApp';
import { doc, getDoc } from 'firebase/firestore';
import { completeOnboarding, saveOnboardingDraft, notifyAdminsOfCompletion } from '@/app/actions/profile';

import { markInviteAcceptedByEmail, getInviteByEmail } from '@/app/actions/invite';
import { searchAgentsByNameOrNxtId } from '@/app/actions/agents';
import { getUploadUrl, finalizeDocumentUpload, fetchDocuments } from '@/app/actions/documents';
import { ONBOARDING_DOCUMENTS } from '@/lib/documentTypes';
import { AGENT_LEVELS } from '@/lib/constants';
import DocumentSigning from '@/components/onboarding/DocumentSigning';
import StripePaymentForm from '@/components/onboarding/StripePaymentForm';
import { logActivity } from '@/lib/activityLogger';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
];

const STEP_CONFIG = {
  admin: [
    { id: 'personal', label: 'Personal Info', icon: 'user' },
    { id: 'employment', label: 'Employment', icon: 'briefcase' },
    { id: 'qualification', label: 'Background', icon: 'clipboard' },
    { id: 'documents', label: 'Documents', icon: 'file' },
    { id: 'review', label: 'Review', icon: 'star' },
  ],
  agent: [
    { id: 'personal', label: 'Personal Info', icon: 'user' },
    { id: 'employment', label: 'Employment', icon: 'briefcase' },
    { id: 'qualification', label: 'Background', icon: 'clipboard' },
    { id: 'documents', label: 'Documents', icon: 'file' },
    { id: 'payment', label: 'Payment', icon: 'creditcard' },
    { id: 'review', label: 'Review', icon: 'star' },
  ],
  manager: [
    { id: 'personal', label: 'Personal Info', icon: 'user' },
    { id: 'employment', label: 'Employment', icon: 'briefcase' },
    { id: 'qualification', label: 'Background', icon: 'clipboard' },
    { id: 'documents', label: 'Documents', icon: 'file' },
    { id: 'payment', label: 'Payment', icon: 'creditcard' },
    { id: 'review', label: 'Review', icon: 'star' },
  ],
  it_engineer: [
    { id: 'personal', label: 'Personal Info', icon: 'user' },
    { id: 'documents', label: 'Documents', icon: 'file' },
    { id: 'review', label: 'Review', icon: 'star' },
  ],
};

const REQUIRED_DOCUMENTS = ONBOARDING_DOCUMENTS.map(d => ({
  key: d.key,
  label: d.label,
  desc: d.description,
  accept: d.accept,
  optional: d.optional || !d.required,
  templateUrl: d.templateUrl || null,
  helpText: d.helpText || null,
}));

const WORK_AUTHORIZATION_OPTIONS = [
  'U.S. Citizen',
  'U.S. Permanent Resident (Green Card)',
  'Employment Authorization Document (EAD)',
  'Employment Visa (H-1B or other work-authorized visa)',
  'Other valid work authorization',
  'Not currently authorized to work in the United States',
];

const QUALIFICATION_QUESTIONS = [
  { key: 'bankruptcy', label: 'Have you ever filed for bankruptcy or a consumer proposal?' },
  { key: 'creditAbove525', label: 'Is your current credit score above 525?' },
  { key: 'lifeLicensed', label: 'Are you currently life licensed in USA?' },
  { key: 'maintainedLicense', label: 'Have you ever maintained a license in any state?' },
  { key: 'licenseSuspended', label: 'Have you ever had your insurance/mutual license suspended or revoked?' },
  { key: 'debtToIMO', label: 'Are you in debt with any insurance company, IMO/MGA?' },
  { key: 'legalAction', label: 'Are you currently or have been involved in any legal action within the last 5 years?' },
];

function StepIcon({ type, isActive, isComplete }) {
  const color = isComplete ? '#fff' : isActive ? '#fff' : 'var(--brand-navy)';
  const icons = {
    building: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/></svg>,
    user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    briefcase: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
    clipboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    shield: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    creditcard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    star: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  };
  return icons[type] || null;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatSSN(value) {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function maskSSN(ssn) {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return ssn;
  return `***-**-${digits.slice(-4)}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [role, setRole] = useState('agent');
  const [agentId, setAgentId] = useState(null);
  const FALLBACK_AGENCY_ID = process.env.NEXT_PUBLIC_DEFAULT_AGENCY_ID || 'JHdkqlkDcXFKzHl46FG7';
  const [agencyId, setAgencyId] = useState(null);
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [ssnVisible, setSsnVisible] = useState(false);

  // Agency setup (admin only)
  const [agencyForm, setAgencyForm] = useState({
    pipelineStages: 'Lead, Contacted, Meeting Set, Quoted, Closed Won',
    leadAssignmentMode: 'manual',
  });

  // Personal info (from agreement)
  const [personalForm, setPersonalForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    preferredName: '',
    dateOfBirth: '',
    phone: '',
    ssn: '',
    itin: '',
    recruitedBy: '',
    recruitedByNxtId: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
  });

  // Employment (last 5 years — multiple entries)
  const [employmentEntries, setEmploymentEntries] = useState([
    { employer: '', position: '', workPhone: '', startDate: '', endDate: '', current: true },
  ]);

  // Qualification questions
  const [qualificationForm, setQualificationForm] = useState({
    workAuthorization: '',
    bankruptcy: null,
    creditAbove525: null,
    lifeLicensed: null,
    maintainedLicense: null,
    licenseSuspended: null,
    debtToIMO: null,
    legalAction: null,
  });

  // Agreement (legacy fields kept for backward compat)
  const [agreementForm, setAgreementForm] = useState({
    backgroundAuthConsent: false,
    agentAgreementConsent: false,
    businessStandardsConsent: false,
    initials: '',
    signatureName: '',
  });

  // Document signatures (new e-signature system)
  const [documentSignatures, setDocumentSignatures] = useState({});

  // Licensing
  const [licensingForm, setLicensingForm] = useState({
    npn: '',
    licensedStates: [],
    licenseExpiry: '',
    residentState: '',
  });

  // Compliance
  const [complianceForm, setComplianceForm] = useState({
    hasEO: false,
    eoProvider: '',
    eoPolicyNumber: '',
    eoExpiry: '',
    amlCertified: false,
    amlCertDate: '',
    amlProvider: '',
  });

  // Payment (agent/manager only)
  const [assignedLevel, setAssignedLevel] = useState(1);
  const [paymentConsent, setPaymentConsent] = useState(false);
  const [stripeConfirmFn, setStripeConfirmFn] = useState(null);
  const [stripeResult, setStripeResult] = useState(null);

  // Recruiter search
  const [recruiterResults, setRecruiterResults] = useState([]);
  const [recruiterDropdownOpen, setRecruiterDropdownOpen] = useState(false);
  const [recruiterSearchField, setRecruiterSearchField] = useState(null); // 'name' or 'nxtId'
  const recruiterSearchTimer = useRef(null);
  const recruiterDropdownRef = useRef(null);

  const searchRecruiter = useCallback((query, field) => {
    if (recruiterSearchTimer.current) clearTimeout(recruiterSearchTimer.current);
    if (!query || query.trim().length < 2 || !agencyId) {
      setRecruiterResults([]);
      setRecruiterDropdownOpen(false);
      return;
    }
    recruiterSearchTimer.current = setTimeout(async () => {
      const res = await searchAgentsByNameOrNxtId(agencyId, query);
      if (res.success && res.results.length > 0) {
        setRecruiterResults(res.results);
        setRecruiterSearchField(field);
        setRecruiterDropdownOpen(true);
      } else {
        setRecruiterResults([]);
        setRecruiterDropdownOpen(false);
      }
    }, 300);
  }, [agencyId]);

  const selectRecruiter = useCallback((agent) => {
    setPersonalForm(prev => ({
      ...prev,
      recruitedBy: agent.fullName,
      recruitedByNxtId: agent.nxtId,
    }));
    setRecruiterDropdownOpen(false);
    setRecruiterResults([]);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (recruiterDropdownRef.current && !recruiterDropdownRef.current.contains(e.target)) {
        setRecruiterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Documents
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [uploadingKey, setUploadingKey] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setAgentId(user.uid);
        setAgentEmail(user.email || '');
        try {
          const agentSnap = await getDoc(doc(db, 'agents', user.uid));
          if (agentSnap.exists()) {
            const data = agentSnap.data();
            // Security: never allow admin/it_engineer role during onboarding — must be set by admin post-onboarding
            const docRole = data.role;
            setRole((docRole === 'admin' || docRole === 'it_engineer') ? 'agent' : (docRole || 'agent'));
            setAgencyId(data.agency_id);
            setAgentName(data.full_name || '');
            if (data.first_name || data.full_name) {
              const firstName = data.first_name || (data.full_name ? data.full_name.split(' ')[0] : '');
              const middleName = data.middle_name || '';
              const lastName = data.last_name || (data.full_name ? data.full_name.split(' ').slice(1).join(' ') : '');
              setPersonalForm(prev => ({ ...prev, firstName, middleName, lastName, preferredName: data.preferred_name || firstName || '' }));
            }
            if (data.status === 'active' || data.status === 'pending_licensing' || data.status === 'docs_pending_review') {
              router.push('/dashboard');
              return;
            }
            if (data.status === 'pending_approval') {
              router.push('/pending-approval');
              return;
            }
            if (data.phone) setPersonalForm(prev => ({ ...prev, phone: data.phone }));
            if (data.recruited_by) setPersonalForm(prev => ({ ...prev, recruitedBy: data.recruited_by, recruitedByNxtId: data.recruited_by_nxt_id || '' }));
            if (data.agentLevel) setAssignedLevel(data.agentLevel);
            if (data.licensedStates) setLicensingForm(prev => ({ ...prev, licensedStates: data.licensedStates }));

            // Load saved draft if within 12 hours
            if (data.onboarding_draft && data.onboarding_draft_saved_at) {
              const savedAt = new Date(data.onboarding_draft_saved_at);
              const hoursElapsed = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
              if (hoursElapsed < 12) {
                const draft = data.onboarding_draft;
                if (draft.personalForm) setPersonalForm(prev => ({ ...prev, ...draft.personalForm }));
                if (draft.employmentEntries) setEmploymentEntries(draft.employmentEntries);
                if (draft.qualificationForm) setQualificationForm(prev => ({ ...prev, ...draft.qualificationForm }));
                if (draft.agreementForm) setAgreementForm(prev => ({ ...prev, ...draft.agreementForm }));
                if (draft.documentSignatures) setDocumentSignatures(draft.documentSignatures);
                if (draft.paymentForm?.consent) setPaymentConsent(draft.paymentForm.consent);
                if (draft.agencyForm) setAgencyForm(prev => ({ ...prev, ...draft.agencyForm }));
                if (draft.currentStep !== undefined) setCurrentStep(draft.currentStep);
              }
              // If >12 hours, draft is ignored — user fills everything fresh
            }

            // Fallback: if agency_id is missing from agent doc, look it up from invite
            if (!data.agency_id && user.email) {
              try {
                const invRes = await getInviteByEmail(user.email);
                if (invRes.success && invRes.invite?.agency_id) {
                  setAgencyId(invRes.invite.agency_id);
                  if (!data.role && invRes.invite.role) {
                    // Security: never allow admin/it_engineer role from invite — must be set by admin post-onboarding
                    const inviteRole = invRes.invite.role;
                    setRole((inviteRole === 'admin' || inviteRole === 'it_engineer') ? 'agent' : inviteRole);
                  }
                  if (!data.agentLevel && invRes.invite.agentLevel) setAssignedLevel(invRes.invite.agentLevel);
                  if (invRes.invite.inviter_name && !personalForm.recruitedBy) {
                    setPersonalForm(prev => ({
                      ...prev,
                      recruitedBy: invRes.invite.inviter_name,
                      recruitedByNxtId: invRes.invite.inviter_nxt_id || '',
                    }));
                  }
                }
              } catch (_) {}
            }

            // Load uploaded documents via server action
            try {
              const docsRes = await fetchDocuments();
              if (docsRes.success) {
                const docs = {};
                docsRes.documents.forEach(d => {
                  docs[d.docType] = { fileName: d.fileName, storagePath: d.storagePath, status: d.status };
                });
                setUploadedDocs(docs);
              }
            } catch (docErr) {
              // non-critical, continue
            }
          } else {
            // No agent doc at all — look up invite data by email to get agency_id and role
            if (user.email) {
              try {
                const invRes = await getInviteByEmail(user.email);
                if (invRes.success && invRes.invite) {
                  setAgencyId(invRes.invite.agency_id);
                  // Security: never allow admin/it_engineer role from invite — must be set by admin post-onboarding
                  const invRole = invRes.invite.role;
                  setRole((invRole === 'admin' || invRole === 'it_engineer') ? 'agent' : (invRole || 'agent'));
                  if (invRes.invite.agentLevel) setAssignedLevel(invRes.invite.agentLevel);
                  if (invRes.invite.inviter_name) {
                    setPersonalForm(prev => ({
                      ...prev,
                      recruitedBy: invRes.invite.inviter_name,
                      recruitedByNxtId: invRes.invite.inviter_nxt_id || '',
                    }));
                  }
                }
              } catch (_) {}
            }
          }
        } catch (error) {
          // user can still proceed
        }
      } else {
        router.push('/auth/login');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const steps = STEP_CONFIG[role] || STEP_CONFIG.agent;
  const currentStepConfig = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  const validateStep = (stepId) => {
    const errors = {};

    if (stepId === 'personal') {
      if (!personalForm.firstName.trim()) errors.firstName = 'First name is required';
      if (!personalForm.lastName.trim()) errors.lastName = 'Last name is required';
      if (!personalForm.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
      if (!personalForm.phone || personalForm.phone.replace(/\D/g, '').length < 10) errors.phone = 'Valid 10-digit phone required';
      if (!personalForm.ssn && !personalForm.itin) errors.ssn = 'SSN or ITIN is required';
      if (personalForm.ssn && personalForm.ssn.replace(/\D/g, '').length !== 9) errors.ssn = 'SSN must be 9 digits';
      if (!personalForm.addressLine1) errors.addressLine1 = 'Street address is required';
      if (!personalForm.city) errors.city = 'City is required';
      if (!personalForm.state) errors.state = 'State is required';
      if (!personalForm.zipCode || !/^\d{5}(-\d{4})?$/.test(personalForm.zipCode)) errors.zipCode = 'Valid ZIP code required';
    }

    if (stepId === 'employment') {
      if (!employmentEntries[0]?.employer?.trim()) errors.employer = 'Current employer is required';
      if (!employmentEntries[0]?.position?.trim()) errors.position = 'Position is required';
    }

    if (stepId === 'qualification') {
      if (!qualificationForm.workAuthorization) errors.workAuthorization = 'Please select your work authorization status';
      QUALIFICATION_QUESTIONS.forEach(q => {
        if (qualificationForm[q.key] === null) errors[q.key] = 'Please select Yes or No';
      });
    }

    if (stepId === 'documents') {
      const docErrors = DocumentSigning.validate(documentSignatures);
      Object.assign(errors, docErrors);
    }

    if (stepId === 'payment') {
      if (!paymentConsent) errors.consent = 'You must agree to the subscription terms';
    }

    return errors;
  };

  const saveDraft = (stepOverride) => {
    if (!agentId) return;
    const draft = {
      personalForm,
      employmentEntries,
      qualificationForm,
      agreementForm,
      documentSignatures,
      paymentForm: { consent: paymentConsent }, // Stripe handles card data
      agencyForm,
      currentStep: stepOverride !== undefined ? stepOverride : currentStep,
    };
    saveOnboardingDraft(draft).catch(() => {});
  };

  const handleNext = async () => {
    const errors = validateStep(currentStepConfig.id);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    // Confirm Stripe card setup before leaving payment step
    if (currentStepConfig.id === 'payment' && !stripeResult) {
      if (!stripeConfirmFn) {
        setValidationErrors({ card: 'Payment form is still loading. Please wait a moment and try again.' });
        return;
      }
      setIsSaving(true);
      try {
        const result = await stripeConfirmFn();
        if (result.error) {
          setValidationErrors({ card: result.error });
          setIsSaving(false);
          return;
        }
        setStripeResult(result);
      } catch (err) {
        setValidationErrors({ card: err.message || 'Payment setup failed. Please try again.' });
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    saveDraft(nextStep);
  };

  const handleBack = () => {
    setValidationErrors({});
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    saveDraft(prevStep);
  };

  const handleComplete = async () => {
    // Re-validate all steps before final submission
    const allStepIds = steps.map(s => s.id).filter(id => id !== 'review');
    for (const stepId of allStepIds) {
      const errors = validateStep(stepId);
      if (Object.keys(errors).length > 0) {
        setValidationErrors({ submit: 'Some required information is missing. Please review all steps before submitting.', ...errors });
        // Navigate to the first step with errors
        const errorStepIndex = steps.findIndex(s => s.id === stepId);
        if (errorStepIndex >= 0) setCurrentStep(errorStepIndex);
        return;
      }
    }

    // Explicitly verify all 3 documents are signed
    const docErrors = DocumentSigning.validate(documentSignatures);
    if (Object.keys(docErrors).length > 0) {
      setValidationErrors({ submit: 'All three agreements must be signed before completing onboarding.', ...docErrors });
      const docsStepIndex = steps.findIndex(s => s.id === 'documents');
      if (docsStepIndex >= 0) setCurrentStep(docsStepIndex);
      return;
    }

    setIsSaving(true);
    try {
      const nextChargeDate = new Date();
      nextChargeDate.setDate(nextChargeDate.getDate() + 30);

      const agentUpdate = {
        email: agentEmail,
        role: role,
        agency_id: agencyId || FALLBACK_AGENCY_ID,
        first_name: personalForm.firstName,
        middle_name: personalForm.middleName || null,
        last_name: personalForm.lastName,
        full_name: [personalForm.firstName, personalForm.middleName, personalForm.lastName].filter(Boolean).join(' '),
        preferred_name: personalForm.preferredName,
        date_of_birth: personalForm.dateOfBirth,
        phone: personalForm.phone,
        ssn_last4: personalForm.ssn.replace(/\D/g, '').slice(-4),
        itin: personalForm.itin || null,
        recruited_by: personalForm.recruitedBy || null,
        recruited_by_nxt_id: personalForm.recruitedByNxtId || null,
        address: {
          line1: personalForm.addressLine1,
          line2: personalForm.addressLine2,
          city: personalForm.city,
          state: personalForm.state,
          zip: personalForm.zipCode,
        },
        employment: employmentEntries.filter(e => e.employer?.trim()).map(e => ({
          employer: e.employer,
          position: e.position,
          work_phone: e.workPhone,
          start_date: e.startDate,
          end_date: e.endDate,
          current: e.current || false,
        })),
        qualification: {
          work_authorization: qualificationForm.workAuthorization,
          bankruptcy: qualificationForm.bankruptcy,
          credit_above_525: qualificationForm.creditAbove525,
          life_licensed: qualificationForm.lifeLicensed,
          maintained_license: qualificationForm.maintainedLicense,
          license_suspended: qualificationForm.licenseSuspended,
          debt_to_imo: qualificationForm.debtToIMO,
          legal_action: qualificationForm.legalAction,
        },
        agreement: DocumentSigning.buildAgreementData(
          documentSignatures,
          [personalForm.firstName, personalForm.middleName, personalForm.lastName].filter(Boolean).join(' '),
          assignedLevel,
        ),
        status: (role === 'admin' || role === 'it_engineer') ? 'active' : 'pending_approval',
        onboardingProgress: {
          documentsUploaded: false,
          documentsApproved: false,
          licensingComplete: false,
          complianceComplete: false,
        },
        onboarding_completed_at: new Date().toISOString(),
        email_verified_at: new Date().toISOString(),
      };

      // Add Stripe payment info for agent/manager (not admin or it_engineer)
      if (role !== 'admin' && role !== 'it_engineer') {
        if (!stripeResult) {
          throw new Error('Payment not confirmed. Please go back to the payment step and try again.');
        }
        agentUpdate.stripe_customer_id = stripeResult.customerId;
        agentUpdate.stripe_subscription_id = stripeResult.subscriptionId;
        agentUpdate.payment = {
          cardLastFour: stripeResult.cardLast4,
          cardBrand: stripeResult.cardBrand,
          consentedAt: new Date().toISOString(),
        };
        agentUpdate.subscriptionStatus = 'trial';
        agentUpdate.trialStartDate = new Date().toISOString();
        agentUpdate.nextChargeDate = new Date(stripeResult.trialEnd * 1000).toISOString();
      }

      const result = await completeOnboarding(agentUpdate);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save');
      }

      // Log onboarding completion
      logActivity({
        category: 'onboarding',
        action: 'onboarding_completed',
        actorId: agentId,
        actorName: [personalForm.firstName, personalForm.middleName, personalForm.lastName].filter(Boolean).join(' '),
        description: [personalForm.firstName, personalForm.middleName, personalForm.lastName].filter(Boolean).join(' ') + ` (${agentEmail}) completed onboarding as ${role}`,
        metadata: { email: agentEmail, role, agencyId },
      }).catch(() => {});

      // Mark invite as accepted (safety net in case invite page missed it)
      markInviteAcceptedByEmail(agentEmail)
        .catch(() => {});

      // Admins/IT go straight to dashboard; agents need approval
      if (role === 'admin' || role === 'it_engineer') {
        router.push('/dashboard');
      } else {
        // Notify admins that a new agent completed onboarding (non-blocking)
        notifyAdminsOfCompletion()
          .catch(() => {});
        router.push('/pending-approval');
      }
    } catch (error) {
      setValidationErrors({ submit: `Failed to save: ${error?.message || 'Unknown error'}. Please try again.` });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLicensedState = (state) => {
    setLicensingForm(prev => {
      const updated = prev.licensedStates.includes(state)
        ? prev.licensedStates.filter(s => s !== state)
        : [...prev.licensedStates, state];
      return { ...prev, licensedStates: updated };
    });
  };

  const handleDocUpload = async (docKey, file) => {
    if (!file || !agentId) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      setValidationErrors(prev => ({ ...prev, [docKey]: 'File too large. Maximum 20MB.' }));
      return;
    }

    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExts.includes(ext)) {
      setValidationErrors(prev => ({ ...prev, [docKey]: 'Only PDF, JPG, and PNG files are accepted.' }));
      return;
    }

    setUploadingKey(docKey);
    setValidationErrors(prev => { const next = { ...prev }; delete next[docKey]; return next; });

    try {
      // Step 1: Get signed upload URL from server
      const urlRes = await getUploadUrl({
        callerUid: agentId,
        docType: docKey,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      });

      if (!urlRes.success) {
        setValidationErrors(prev => ({ ...prev, [docKey]: urlRes.error }));
        setUploadingKey(null);
        return;
      }

      // Step 2: PUT the file to the signed URL
      const putRes = await fetch(urlRes.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Upload failed (HTTP ${putRes.status})`);
      }

      // Step 3: Finalize — server verifies and writes Firestore record
      const finalRes = await finalizeDocumentUpload({
        callerUid: agentId,
        docType: docKey,
        storagePath: urlRes.storagePath,
        fileName: file.name,
        size: file.size,
      });

      if (!finalRes.success) {
        setValidationErrors(prev => ({ ...prev, [docKey]: finalRes.error }));
        setUploadingKey(null);
        return;
      }

      setUploadedDocs(prev => ({
        ...prev,
        [docKey]: { fileName: file.name, storagePath: urlRes.storagePath, status: 'pending_review' },
      }));
    } catch (err) {
      setValidationErrors(prev => ({ ...prev, [docKey]: 'Upload failed. Please try again.' }));
    } finally {
      setUploadingKey(null);
    }
  };

  if (isLoading) {
    return (
      <>
        <InteractiveBackground />
        <div className={styles.container} style={{ position: 'relative', zIndex: 1 }}>
          <div className={styles.loadingWrapper}>
            <div className={styles.loadingSpinner} />
            <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>Loading your profile...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <InteractiveBackground />
      <div className={styles.container} style={{ position: 'relative', zIndex: 1 }}>
        <div className={styles.cardWrapper}>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
          </div>

          <Card>
            {/* Header */}
            <div className={styles.header}>
              <h1 className={styles.title}>
                {agentName ? `Welcome, ${agentName.split(' ')[0]}` : 'Welcome to NXT CRM'}
              </h1>
              <p className={styles.subtitle}>
                {isLastStep
                  ? 'Review your information before we finish up.'
                  : `Step ${currentStep + 1} of ${steps.length} — ${currentStepConfig.label}`}
              </p>
            </div>

            {/* Step indicator */}
            <div className={styles.stepIndicator}>
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.stepPill} ${i === currentStep ? styles.stepActive : ''} ${i < currentStep ? styles.stepComplete : ''}`}
                  onClick={() => { if (i < currentStep) { setCurrentStep(i); setValidationErrors({}); } }}
                  disabled={i > currentStep}
                >
                  <span className={styles.stepPillIcon}>
                    {i < currentStep ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <StepIcon type={s.icon} isActive={i === currentStep} isComplete={i < currentStep} />
                    )}
                  </span>
                  <span className={styles.stepPillLabel}>{s.label}</span>
                </button>
              ))}
            </div>

            {validationErrors.submit && (
              <div className={styles.errorBanner}><p>{validationErrors.submit}</p></div>
            )}

            <div className={styles.stepContent}>

              {/* ── PERSONAL INFORMATION (Agreement Page 1) ── */}
              {currentStepConfig.id === 'personal' && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Personal Information</h3>
                  <p className={styles.sectionDesc}>This information is required for your agent agreement and compliance records.</p>

                  <div className={styles.fieldRow}>
                    <div style={{ flex: 2 }}>
                      <Input id="firstName" label="First Name *" value={personalForm.firstName}
                        onChange={e => setPersonalForm({ ...personalForm, firstName: e.target.value })}
                        placeholder="First name" error={validationErrors.firstName} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input id="middleName" label="Middle Name" value={personalForm.middleName}
                        onChange={e => setPersonalForm({ ...personalForm, middleName: e.target.value })}
                        placeholder="Middle name" />
                    </div>
                    <div style={{ flex: 2 }}>
                      <Input id="lastName" label="Last Name *" value={personalForm.lastName}
                        onChange={e => setPersonalForm({ ...personalForm, lastName: e.target.value })}
                        placeholder="Last name" error={validationErrors.lastName} />
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <Input id="preferredName" label="Preferred Name" value={personalForm.preferredName}
                      onChange={e => setPersonalForm({ ...personalForm, preferredName: e.target.value })}
                      placeholder="Name you go by" />
                  </div>

                  <div className={styles.fieldRow}>
                    <div style={{ flex: 1 }}>
                      <Input id="dateOfBirth" label="Date of Birth *" type="date" value={personalForm.dateOfBirth}
                        onChange={e => setPersonalForm({ ...personalForm, dateOfBirth: e.target.value })}
                        error={validationErrors.dateOfBirth} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input id="phone" label="Phone Number *" type="tel" value={personalForm.phone}
                        onChange={e => setPersonalForm({ ...personalForm, phone: formatPhone(e.target.value) })}
                        placeholder="(555) 555-5555" error={validationErrors.phone} />
                    </div>
                  </div>

                  <div className={styles.fieldRow}>
                    <div style={{ flex: 1 }}>
                      <label className={styles.fieldLabel}>SSN *</label>
                      <div className={styles.ssnInputWrapper}>
                        <input
                          type={ssnVisible ? 'text' : 'password'}
                          value={ssnVisible ? formatSSN(personalForm.ssn) : personalForm.ssn ? maskSSN(personalForm.ssn) : ''}
                          onChange={e => {
                            if (ssnVisible) setPersonalForm({ ...personalForm, ssn: e.target.value.replace(/\D/g, '').slice(0, 9) });
                          }}
                          onFocus={() => setSsnVisible(true)}
                          onBlur={() => setSsnVisible(false)}
                          placeholder="XXX-XX-XXXX"
                          className={styles.ssnInput}
                          style={validationErrors.ssn ? { borderColor: 'var(--status-error)' } : {}}
                          autoComplete="off"
                        />
                        <button type="button" className={styles.ssnToggle}
                          onClick={() => setSsnVisible(!ssnVisible)} tabIndex={-1}>
                          {ssnVisible ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {validationErrors.ssn && <span className={styles.fieldError}>{validationErrors.ssn}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input id="itin" label="ITIN (if applicable)" value={personalForm.itin}
                        onChange={e => setPersonalForm({ ...personalForm, itin: e.target.value })}
                        placeholder="Individual Taxpayer ID" />
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <Input id="email" label="Email" value={agentEmail} disabled
                      onChange={() => {}} />
                  </div>

                  <div className={styles.fieldGroup}>
                    <AddressAutocomplete id="addressLine1" label="Home Address *" value={personalForm.addressLine1}
                      onChange={val => setPersonalForm(prev => ({ ...prev, addressLine1: val }))}
                      onPlaceSelect={({ line1, city, state, zip }) => {
                        setPersonalForm(prev => ({ ...prev, addressLine1: line1, city: city || prev.city, state: state || prev.state, zipCode: zip || prev.zipCode }));
                      }}
                      placeholder="Start typing your address..." error={validationErrors.addressLine1} />
                  </div>

                  <div className={styles.fieldGroup}>
                    <Input id="addressLine2" label="Suite / Apt (Optional)" value={personalForm.addressLine2}
                      onChange={e => setPersonalForm({ ...personalForm, addressLine2: e.target.value })}
                      placeholder="Suite 100" />
                  </div>

                  <div className={styles.fieldRow}>
                    <div style={{ flex: 2 }}>
                      <Input id="city" label="City *" value={personalForm.city}
                        onChange={e => setPersonalForm({ ...personalForm, city: e.target.value })}
                        placeholder="Dallas" error={validationErrors.city} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className={styles.fieldLabel}>State *</label>
                      <select value={personalForm.state}
                        onChange={e => setPersonalForm({ ...personalForm, state: e.target.value })}
                        className={styles.selectField}
                        style={validationErrors.state ? { borderColor: 'var(--status-error)' } : {}}>
                        <option value="">—</option>
                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {validationErrors.state && <span className={styles.fieldError}>{validationErrors.state}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input id="zipCode" label="ZIP *" value={personalForm.zipCode}
                        onChange={e => setPersonalForm({ ...personalForm, zipCode: e.target.value.replace(/[^\d-]/g, '').slice(0, 10) })}
                        placeholder="75201" error={validationErrors.zipCode} />
                    </div>
                  </div>

                  <div className={styles.fieldGroup} ref={recruiterDropdownRef} style={{ position: 'relative' }}>
                    <div className={styles.fieldRow}>
                      <div style={{ flex: 2 }}>
                        <Input id="recruitedBy" label="Recruited By (Legal Name)" value={personalForm.recruitedBy}
                          onChange={e => {
                            setPersonalForm({ ...personalForm, recruitedBy: e.target.value });
                            searchRecruiter(e.target.value, 'name');
                          }}
                          placeholder="Name of person who recruited you"
                          autoComplete="off" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Input id="recruitedByNxtId" label="NXT ID" value={personalForm.recruitedByNxtId}
                          onChange={e => {
                            const val = e.target.value.toUpperCase();
                            setPersonalForm({ ...personalForm, recruitedByNxtId: val });
                            searchRecruiter(val, 'nxtId');
                          }}
                          placeholder="e.g. NXT0001"
                          autoComplete="off" />
                      </div>
                    </div>
                    {recruiterDropdownOpen && recruiterResults.length > 0 && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
                        backgroundColor: '#fff', borderRadius: '10px', marginTop: '4px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        maxHeight: '200px', overflowY: 'auto',
                      }}>
                        {recruiterResults.map(agent => (
                          <button
                            key={agent.uid}
                            type="button"
                            onClick={() => selectRecruiter(agent)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              width: '100%', padding: '10px 16px', border: 'none',
                              backgroundColor: 'transparent', cursor: 'pointer',
                              fontSize: '14px', color: 'var(--text-primary)', textAlign: 'left',
                              borderBottom: '1px solid rgba(0,0,0,0.05)',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(201, 154, 61, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <span style={{ fontWeight: 500 }}>{agent.fullName}</span>
                            {agent.nxtId && (
                              <span style={{
                                fontSize: '12px', fontWeight: 600, color: 'var(--brand-navy)',
                                backgroundColor: 'rgba(15, 42, 82, 0.08)', padding: '2px 8px',
                                borderRadius: '999px',
                              }}>
                                {agent.nxtId}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── EMPLOYMENT HISTORY (Last 5 Years) ── */}
              {currentStepConfig.id === 'employment' && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Employment History</h3>
                  <p className={styles.sectionDesc}>Please list your employment for the last 5 years, starting with your current or most recent position.</p>

                  {employmentEntries.map((entry, idx) => {
                    const updateEntry = (field, value) => {
                      setEmploymentEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
                    };
                    return (
                      <div key={idx} style={{
                        padding: '20px', borderRadius: '12px', marginBottom: '16px',
                        border: '1px solid var(--border-color)', backgroundColor: idx === 0 ? 'rgba(201, 154, 61, 0.03)' : 'var(--surface-page)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--brand-navy)' }}>
                            {idx === 0 ? 'Current / Most Recent' : `Position ${idx + 1}`}
                          </span>
                          {idx > 0 && (
                            <button type="button" onClick={() => setEmploymentEntries(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-error)', fontSize: '13px', fontWeight: '500' }}>
                              Remove
                            </button>
                          )}
                        </div>

                        <div className={styles.fieldRow}>
                          <div style={{ flex: 1 }}>
                            <Input id={`employer-${idx}`} label={idx === 0 ? 'Employer *' : 'Employer'} value={entry.employer}
                              onChange={e => updateEntry('employer', e.target.value)}
                              placeholder="Company name" error={idx === 0 ? validationErrors.employer : undefined} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <Input id={`position-${idx}`} label={idx === 0 ? 'Position *' : 'Position'} value={entry.position}
                              onChange={e => updateEntry('position', e.target.value)}
                              placeholder="Job title" error={idx === 0 ? validationErrors.position : undefined} />
                          </div>
                        </div>

                        <div className={styles.fieldRow}>
                          <div style={{ flex: 1 }}>
                            <Input id={`workPhone-${idx}`} label="Work Phone" type="tel" value={entry.workPhone}
                              onChange={e => updateEntry('workPhone', formatPhone(e.target.value))}
                              placeholder="(555) 555-5555" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <Input id={`startDate-${idx}`} label="Start Date" type="date" value={entry.startDate}
                              onChange={e => updateEntry('startDate', e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            {entry.current ? (
                              <div>
                                <label className={styles.fieldLabel}>End Date</label>
                                <div style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-page)', fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>
                                  Present
                                </div>
                              </div>
                            ) : (
                              <Input id={`endDate-${idx}`} label="End Date" type="date" value={entry.endDate}
                                onChange={e => updateEntry('endDate', e.target.value)} />
                            )}
                          </div>
                        </div>

                        {idx === 0 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={entry.current}
                              onChange={e => updateEntry('current', e.target.checked)}
                              style={{ accentColor: 'var(--brand-navy)' }} />
                            I currently work here
                          </label>
                        )}
                      </div>
                    );
                  })}

                  {employmentEntries.length < 5 && (
                    <button type="button"
                      onClick={() => setEmploymentEntries(prev => [...prev, { employer: '', position: '', workPhone: '', startDate: '', endDate: '', current: false }])}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px dashed var(--border-color)', background: 'none',
                        cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                        color: 'var(--brand-navy)', transition: 'background-color 0.2s ease',
                      }}>
                      + Add Another Position
                    </button>
                  )}
                </div>
              )}

              {/* ── QUALIFICATION QUESTIONS ── */}
              {currentStepConfig.id === 'qualification' && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Additional Information</h3>
                  <p className={styles.sectionDesc}>Please answer the following background questions truthfully. All information is kept confidential.</p>

                  {/* Work Authorization Dropdown */}
                  <div style={{
                    padding: '20px', borderRadius: '12px', marginBottom: '20px',
                    border: `1px solid ${validationErrors.workAuthorization ? 'var(--status-error)' : 'var(--border-color)'}`,
                    backgroundColor: qualificationForm.workAuthorization ? 'rgba(201, 154, 61, 0.03)' : 'var(--surface-page)',
                  }}>
                    <label className={styles.fieldLabel} style={{ marginBottom: '8px', display: 'block', fontWeight: 600, fontSize: '14px', color: 'var(--brand-navy)' }}>
                      Are you legally authorized to work in the United States? *
                    </label>
                    <select
                      value={qualificationForm.workAuthorization}
                      onChange={e => setQualificationForm({ ...qualificationForm, workAuthorization: e.target.value })}
                      className={styles.selectField}
                      style={{
                        width: '100%',
                        ...(validationErrors.workAuthorization ? { borderColor: 'var(--status-error)' } : {}),
                      }}
                    >
                      <option value="">— Select your work authorization status —</option>
                      {WORK_AUTHORIZATION_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {validationErrors.workAuthorization && (
                      <span className={styles.fieldError}>{validationErrors.workAuthorization}</span>
                    )}
                  </div>

                  <div className={styles.questionList}>
                    {QUALIFICATION_QUESTIONS.map(q => (
                      <div key={q.key} className={`${styles.questionCard} ${validationErrors[q.key] ? styles.questionCardError : ''}`}>
                        <p className={styles.questionText}>{q.label}</p>
                        <div className={styles.yesNoGroup}>
                          <button type="button"
                            className={`${styles.yesNoBtn} ${qualificationForm[q.key] === true ? styles.yesNoBtnActiveYes : ''}`}
                            onClick={() => setQualificationForm({ ...qualificationForm, [q.key]: true })}>
                            Yes
                          </button>
                          <button type="button"
                            className={`${styles.yesNoBtn} ${qualificationForm[q.key] === false ? styles.yesNoBtnActiveNo : ''}`}
                            onClick={() => setQualificationForm({ ...qualificationForm, [q.key]: false })}>
                            No
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {Object.keys(validationErrors).length > 0 && (
                    <p style={{ color: 'var(--status-error)', fontSize: 'var(--text-caption)', marginTop: 'var(--space-1)' }}>
                      Please answer all questions before continuing.
                    </p>
                  )}
                </div>
              )}

              {/* ── DOCUMENT SIGNING (E-Signature) + FILE UPLOADS ── */}
              {currentStepConfig.id === 'documents' && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Document Signing</h3>
                  <p className={styles.sectionDesc}>
                    Please review and sign each of the following 3 documents. All signatures are legally binding under the ESIGN Act.
                  </p>
                  <DocumentSigning
                    agentName={[personalForm.firstName, personalForm.middleName, personalForm.lastName].filter(Boolean).join(' ')}
                    assignedLevel={assignedLevel}
                    signatures={documentSignatures}
                    onSignaturesChange={setDocumentSignatures}
                    validationErrors={validationErrors}
                  />

                  {/* ── Document Uploads (all optional) ── */}
                  <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
                    <h3 className={styles.sectionTitle}>Upload Documents</h3>
                    <p className={styles.sectionDesc}>
                      You can upload any of the following documents now, or submit them later from the back office.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {REQUIRED_DOCUMENTS.map(docItem => {
                        const isUploaded = !!uploadedDocs[docItem.key];
                        const isCurrentlyUploading = uploadingKey === docItem.key;
                        const error = validationErrors[docItem.key];

                        return (
                          <div key={docItem.key} style={{
                            padding: '16px 20px', borderRadius: '12px',
                            border: `1px solid ${isUploaded ? 'var(--status-success)' : error ? 'var(--status-error)' : 'var(--border-color)'}`,
                            backgroundColor: isUploaded ? 'rgba(47, 168, 79, 0.03)' : 'var(--surface-page)',
                            transition: 'border-color 0.2s ease',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--brand-navy)' }}>
                                    {docItem.label}{!docItem.optional ? ' *' : ''}
                                  </span>
                                  {isUploaded && (
                                    <span style={{ color: 'var(--status-success)', fontSize: '12px', fontWeight: 600 }}>
                                      Uploaded
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  {docItem.desc}
                                </p>

                                {/* W-9 help text + download button */}
                                {docItem.templateUrl && (
                                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <a
                                      href={docItem.templateUrl}
                                      download
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 14px', borderRadius: '8px',
                                        border: '1px solid var(--brand-gold)', backgroundColor: 'rgba(201, 154, 61, 0.08)',
                                        color: 'var(--brand-navy)', fontSize: '12px', fontWeight: 600,
                                        textDecoration: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
                                      }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                      </svg>
                                      Download Blank W-9
                                    </a>
                                    {docItem.helpText && (
                                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                        {docItem.helpText}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {isUploaded && (
                                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {uploadedDocs[docItem.key].fileName}
                                  </p>
                                )}

                                {error && (
                                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--status-error)', fontWeight: 500 }}>
                                    {error}
                                  </p>
                                )}
                              </div>

                              <div style={{ flexShrink: 0 }}>
                                <label style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                                  padding: '8px 16px', borderRadius: '999px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: isCurrentlyUploading ? 'rgba(0,0,0,0.04)' : 'transparent',
                                  color: 'var(--brand-navy)', fontSize: '13px', fontWeight: 600,
                                  cursor: isCurrentlyUploading ? 'wait' : 'pointer',
                                  transition: 'all 0.2s ease',
                                  opacity: isCurrentlyUploading ? 0.6 : 1,
                                }}>
                                  {isCurrentlyUploading ? 'Uploading...' : isUploaded ? 'Replace' : 'Upload'}
                                  <input
                                    type="file"
                                    accept={docItem.accept}
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleDocUpload(docItem.key, file);
                                      e.target.value = '';
                                    }}
                                    disabled={isCurrentlyUploading}
                                    style={{ display: 'none' }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PAYMENT (agent/manager only) ── */}
              {currentStepConfig.id === 'payment' && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Subscription & Payment</h3>
                  <p className={styles.sectionDesc}>Set up your monthly subscription. Your first month is completely free.</p>

                  <StripePaymentForm
                    agentEmail={agentEmail}
                    agentName={[personalForm.firstName, personalForm.middleName, personalForm.lastName].filter(Boolean).join(' ')}
                    agentId={agentId}
                    assignedLevel={assignedLevel}
                    onSetupComplete={(fn) => setStripeConfirmFn(() => fn)}
                    validationErrors={validationErrors}
                    consent={paymentConsent}
                    onConsentChange={(checked) => setPaymentConsent(checked)}
                  />
                </div>
              )}

              {/* ── REVIEW ── */}
              {currentStepConfig.id === 'review' && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Review Your Information</h3>
                  <p className={styles.sectionDesc}>Make sure everything looks good. You can update any of this later from Settings.</p>

                  {/* Personal Info */}
                  <div className={styles.reviewBlock}>
                    <div className={styles.reviewBlockHeader}>
                      <h4 className={styles.reviewBlockTitle}>Personal Info</h4>
                      <button type="button" className={styles.reviewEditBtn} onClick={() => setCurrentStep(steps.findIndex(s => s.id === 'personal'))}>Edit</button>
                    </div>
                    <div className={styles.reviewGrid}>
                      <ReviewItem label="First Name" value={personalForm.firstName} />
                      {personalForm.middleName && <ReviewItem label="Middle Name" value={personalForm.middleName} />}
                      <ReviewItem label="Last Name" value={personalForm.lastName} />
                      <ReviewItem label="Preferred Name" value={personalForm.preferredName} />
                      <ReviewItem label="Date of Birth" value={personalForm.dateOfBirth} />
                      <ReviewItem label="Phone" value={personalForm.phone} />
                      <ReviewItem label="SSN" value={personalForm.ssn ? `***-**-${personalForm.ssn.replace(/\D/g, '').slice(-4)}` : '—'} />
                      <ReviewItem label="Address" value={personalForm.addressLine1 ? `${personalForm.addressLine1}${personalForm.addressLine2 ? `, ${personalForm.addressLine2}` : ''}, ${personalForm.city}, ${personalForm.state} ${personalForm.zipCode}` : '—'} />
                      <ReviewItem label="Recruited By" value={personalForm.recruitedBy ? `${personalForm.recruitedBy}${personalForm.recruitedByNxtId ? ` (${personalForm.recruitedByNxtId})` : ''}` : '—'} />
                    </div>
                  </div>

                  {/* Employment */}
                  <div className={styles.reviewBlock}>
                    <div className={styles.reviewBlockHeader}>
                      <h4 className={styles.reviewBlockTitle}>Employment</h4>
                      <button type="button" className={styles.reviewEditBtn} onClick={() => setCurrentStep(steps.findIndex(s => s.id === 'employment'))}>Edit</button>
                    </div>
                    <div className={styles.reviewGrid}>
                      {employmentEntries.filter(e => e.employer?.trim()).map((entry, idx) => (
                        <div key={idx} style={idx > 0 ? { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' } : {}}>
                          {idx > 0 && <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Position {idx + 1}</span>}
                          <ReviewItem label="Employer" value={entry.employer} />
                          <ReviewItem label="Position" value={entry.position} />
                          <ReviewItem label="Work Phone" value={entry.workPhone} />
                          <ReviewItem label="Start Date" value={entry.startDate} />
                          <ReviewItem label="End Date" value={entry.current ? 'Present' : entry.endDate} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Qualification */}
                  <div className={styles.reviewBlock}>
                    <div className={styles.reviewBlockHeader}>
                      <h4 className={styles.reviewBlockTitle}>Background Questions</h4>
                      <button type="button" className={styles.reviewEditBtn} onClick={() => setCurrentStep(steps.findIndex(s => s.id === 'qualification'))}>Edit</button>
                    </div>
                    <div className={styles.reviewGrid}>
                      <ReviewItem label="Work Authorization" value={qualificationForm.workAuthorization || '—'} />
                      {QUALIFICATION_QUESTIONS.map(q => (
                        <ReviewItem key={q.key} label={q.label} value={qualificationForm[q.key] === true ? 'Yes' : qualificationForm[q.key] === false ? 'No' : '—'} />
                      ))}
                    </div>
                  </div>

                  {/* Document Signatures */}
                  <div className={styles.reviewBlock}>
                    <div className={styles.reviewBlockHeader}>
                      <h4 className={styles.reviewBlockTitle}>Signed Documents</h4>
                      <button type="button" className={styles.reviewEditBtn} onClick={() => setCurrentStep(steps.findIndex(s => s.id === 'documents'))}>Edit</button>
                    </div>
                    <div className={styles.reviewGrid}>
                      <ReviewItem
                        label="Independent Contractor Agreement"
                        value={documentSignatures.ica?.consent ? `Signed by ${documentSignatures.ica.signatureName}` : 'Not signed'}
                        good={!!documentSignatures.ica?.consent}
                      />
                      <ReviewItem
                        label="Agent Ownership Agreement"
                        value={documentSignatures.aoa?.consent ? `Signed by ${documentSignatures.aoa.signatureName}` : 'Not signed'}
                        good={!!documentSignatures.aoa?.consent}
                      />
                      <ReviewItem
                        label="Business Standards"
                        value={documentSignatures.businessStandards?.consent ? `Signed by ${documentSignatures.businessStandards.signatureName}` : 'Not signed'}
                        good={!!documentSignatures.businessStandards?.consent}
                      />
                    </div>
                  </div>

                  {/* Payment (agent/manager only, not IT engineer) */}
                  {role !== 'admin' && role !== 'it_engineer' && (
                    <div className={styles.reviewBlock}>
                      <div className={styles.reviewBlockHeader}>
                        <h4 className={styles.reviewBlockTitle}>Subscription</h4>
                        <button type="button" className={styles.reviewEditBtn} onClick={() => setCurrentStep(steps.findIndex(s => s.id === 'payment'))}>Edit</button>
                      </div>
                      <div className={styles.reviewGrid}>
                        <ReviewItem label="Payment" value={stripeResult ? `${stripeResult.cardBrand} ····${stripeResult.cardLast4}` : 'Card via Stripe'} good={!!stripeResult} />
                        <ReviewItem label="Trial" value="First month free" good={true} />
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Actions */}
            <div className={styles.actionRow}>
              {currentStep > 0 && (
                <Button variant="secondary" onClick={handleBack} disabled={isSaving}>Back</Button>
              )}
              <div style={{ flex: 1 }} />
              {isLastStep ? (
                <Button onClick={handleComplete} isLoading={isSaving}>Complete Setup</Button>
              ) : (
                <Button onClick={handleNext}>Continue</Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function ReviewItem({ label, value, good }) {
  return (
    <div className={styles.reviewItem}>
      <span className={styles.reviewLabel}>{label}</span>
      <span className={`${styles.reviewValue} ${good === true ? styles.reviewGood : good === false ? styles.reviewPending : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}
