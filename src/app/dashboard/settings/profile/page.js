"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { useUser } from '@/context/UserContext';
import { updateMyProfile, uploadProfilePhoto } from '@/app/actions/profile';
import { getUploadUrl, finalizeDocumentUpload, fetchDocuments, getDocumentViewUrl } from '@/app/actions/documents';
import { getDocTypeLabel } from '@/lib/documentTypes';
import { useToast } from '@/components/ui/Toast';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
];

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const LICENSE_PRINT_DATA = [
  { state: 'Alabama', abbr: 'AL', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Alaska', abbr: 'AK', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Arizona', abbr: 'AZ', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Arkansas', abbr: 'AR', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'California', abbr: 'CA', system: 'CA DOI', url: 'https://www.insurance.ca.gov/0200-industry/0075-print-lic/', needs: 'License number / NPN' },
  { state: 'Colorado', abbr: 'CO', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Connecticut', abbr: 'CT', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Delaware', abbr: 'DE', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'District of Columbia', abbr: 'DC', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Florida', abbr: 'FL', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Georgia', abbr: 'GA', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Hawaii', abbr: 'HI', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Idaho', abbr: 'ID', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Illinois', abbr: 'IL', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Indiana', abbr: 'IN', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Iowa', abbr: 'IA', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Kansas', abbr: 'KS', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Kentucky', abbr: 'KY', system: 'KY DOI', url: 'https://insurance.ky.gov/doieservices/UserRole.aspx', needs: 'License number / NPN' },
  { state: 'Louisiana', abbr: 'LA', system: 'LDI', url: 'https://ia.ldi.state.la.us/IndustryAccess/', needs: 'License number / NPN' },
  { state: 'Maine', abbr: 'ME', system: 'Maine ALMS', url: 'https://www.maine.gov/pfr/insurance/licensees/individuals-business-entities/duplicate-license-request', needs: 'License number + Access Code' },
  { state: 'Maryland', abbr: 'MD', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Massachusetts', abbr: 'MA', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Michigan', abbr: 'MI', system: 'DIFS (mail)', url: 'https://www.michigan.gov/difs/industry/licensing-ins/agnt-ins/related/document-requests-certification-letter-duplicate-license-license-history', needs: 'Request form (no online printing)' },
  { state: 'Minnesota', abbr: 'MN', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Mississippi', abbr: 'MS', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Missouri', abbr: 'MO', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Montana', abbr: 'MT', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Nebraska', abbr: 'NE', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Nevada', abbr: 'NV', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'New Hampshire', abbr: 'NH', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'New Jersey', abbr: 'NJ', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'New Mexico', abbr: 'NM', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'New York', abbr: 'NY', system: 'NY DFS', url: 'https://www.dfs.ny.gov/apps_and_licensing/agents_and_brokers/print_a_license_online', needs: 'License number / NPN' },
  { state: 'North Carolina', abbr: 'NC', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'North Dakota', abbr: 'ND', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Ohio', abbr: 'OH', system: 'OH Portal', url: 'https://insurance.ohio.gov/about-us/resources/agent-portal', needs: 'Agent Portal login' },
  { state: 'Oklahoma', abbr: 'OK', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Oregon', abbr: 'OR', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Pennsylvania', abbr: 'PA', system: 'PA DOI', url: 'https://www.insurance.pa.gov/Licensees/Pages/License_Print.aspx', needs: 'License number / NPN' },
  { state: 'Rhode Island', abbr: 'RI', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'South Carolina', abbr: 'SC', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'South Dakota', abbr: 'SD', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Tennessee', abbr: 'TN', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Texas', abbr: 'TX', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Utah', abbr: 'UT', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Vermont', abbr: 'VT', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Virginia', abbr: 'VA', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
  { state: 'Washington', abbr: 'WA', system: 'WA OIC', url: 'https://www.insurance.wa.gov/how-print-your-license', needs: 'License number / NPN' },
  { state: 'West Virginia', abbr: 'WV', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Wisconsin', abbr: 'WI', system: 'NAIC SBS', url: 'https://external-lookup-web.prod.naic.org/license-manager', needs: 'NPN, last name, last 4 SSN' },
  { state: 'Wyoming', abbr: 'WY', system: 'Sircon', url: 'https://www.sircon.com/services/licensePrintingSignUp.jsp', needs: 'Sircon account, NPN' },
];

const WORK_AUTHORIZATION_OPTIONS = [
  'U.S. Citizen',
  'U.S. Permanent Resident (Green Card Holder)',
  'Asylum / Refugee Status with Work Permit',
  'Not Currently Authorized to Work in the U.S.',
];

function SectionCard({ title, description, children, onSave, isSaving, saveLabel = 'Save Changes' }) {
  return (
    <Card style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>{title}</h3>
        {description && (
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {children}
      </div>
      {onSave && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-color)' }}>
          <Button size="small" onClick={onSave} isLoading={isSaving}>{saveLabel}</Button>
        </div>
      )}
    </Card>
  );
}

function StatusBadge({ status }) {
  const config = {
    active: { bg: 'rgba(47, 168, 79, 0.1)', color: 'var(--status-success)', label: 'Active' },
    invited: { bg: 'rgba(227, 169, 74, 0.1)', color: 'var(--brand-blue-accent)', label: 'Invited' },
    pending: { bg: 'rgba(227, 169, 74, 0.1)', color: 'var(--brand-gold)', label: 'Pending' },
    suspended: { bg: 'rgba(211, 63, 63, 0.1)', color: 'var(--status-error)', label: 'Suspended' },
  };
  const c = config[status] || config.pending;
  return (
    <span style={{
      padding: '4px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)',
      fontWeight: 600, backgroundColor: c.bg, color: c.color, display: 'inline-block'
    }}>
      {c.label}
    </span>
  );
}

export default function ProfilePage() {
  const { userProfile, refreshProfile } = useUser();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [savingSection, setSavingSection] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const eoFileRef = useRef(null);
  const amlFileRef = useRef(null);

  // Document upload state
  const [complianceDocs, setComplianceDocs] = useState({ eo_certificate: null, anti_money_laundering: null });
  const [docUploading, setDocUploading] = useState({ eo_certificate: false, anti_money_laundering: false });
  const [docUploadProgress, setDocUploadProgress] = useState({ eo_certificate: 0, anti_money_laundering: 0 });
  const [docError, setDocError] = useState({ eo_certificate: null, anti_money_laundering: null });

  // Form sections
  const [personalForm, setPersonalForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    date_of_birth: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
  });

  const [licensingForm, setLicensingForm] = useState({
    npn: '',
    residentState: '',
    licensedStates: [],
    licenseExpiry: '',
  });

  const [selectedPrintState, setSelectedPrintState] = useState('');

  const [workAuthForm, setWorkAuthForm] = useState({
    workAuthorization: '',
  });

  const [complianceForm, setComplianceForm] = useState({
    hasEO: false,
    eoProvider: '',
    eoPolicyNumber: '',
    eoExpiry: '',
    amlCertified: false,
    amlCertDate: '',
    amlProvider: '',
  });

  useEffect(() => {
    if (!userProfile) return;
    try {
      const data = userProfile;
      setProfile(data);
      setPhotoURL(data.photo_url || null);

      const fallbackFirst = !data.first_name && data.full_name ? data.full_name.split(' ')[0] : '';
      const fallbackLast = !data.last_name && data.full_name ? data.full_name.split(' ').slice(1).join(' ') : '';
      setPersonalForm({
        first_name: data.first_name || fallbackFirst || '',
        middle_name: data.middle_name || '',
        last_name: data.last_name || fallbackLast || '',
        phone: data.phone || '',
        date_of_birth: data.date_of_birth || '',
        addressLine1: data.address?.line1 || '',
        addressLine2: data.address?.line2 || '',
        city: data.address?.city || '',
        state: data.address?.state || '',
        zip: data.address?.zip || '',
      });

      setLicensingForm({
        npn: data.npn || '',
        residentState: data.resident_state || '',
        licensedStates: data.licensedStates || [],
        licenseExpiry: data.license_expiry || '',
      });

      const qual = data.qualification || {};
      setWorkAuthForm({
        workAuthorization: qual.work_authorization || '',
      });

      const comp = data.compliance || {};
      setComplianceForm({
        hasEO: comp.has_eo || false,
        eoProvider: comp.eo_provider || '',
        eoPolicyNumber: comp.eo_policy_number || '',
        eoExpiry: comp.eo_expiry || '',
        amlCertified: comp.aml_certified || false,
        amlCertDate: comp.aml_cert_date || '',
        amlProvider: comp.aml_provider || '',
      });
    } catch (err) {
      // silently handle
    }
    setIsLoading(false);
  }, [userProfile]);

  // Fetch existing compliance documents
  useEffect(() => {
    if (!profile?.uid) return;
    (async () => {
      const res = await fetchDocuments();
      if (res.success) {
        const eoDoc = res.documents.find(d => d.docType === 'eo_certificate') || null;
        const amlDoc = res.documents.find(d => d.docType === 'anti_money_laundering') || null;
        setComplianceDocs({ eo_certificate: eoDoc, anti_money_laundering: amlDoc });
      }
    })();
  }, [profile?.uid]);

  const handleDocUpload = async (file, docType) => {
    if (!file || !profile) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setDocError(prev => ({ ...prev, [docType]: 'Only PDF, JPG, and PNG files are accepted.' }));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setDocError(prev => ({ ...prev, [docType]: 'File must be under 20 MB.' }));
      return;
    }

    setDocError(prev => ({ ...prev, [docType]: null }));
    setDocUploading(prev => ({ ...prev, [docType]: true }));
    setDocUploadProgress(prev => ({ ...prev, [docType]: 0 }));

    try {
      const urlRes = await getUploadUrl({
        callerUid: profile.uid,
        docType,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });
      if (!urlRes.success) throw new Error(urlRes.error);

      // Upload via XHR for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', urlRes.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setDocUploadProgress(prev => ({ ...prev, [docType]: Math.round((e.loaded / e.total) * 100) }));
          }
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      const finalRes = await finalizeDocumentUpload({
        callerUid: profile.uid,
        docType,
        storagePath: urlRes.storagePath,
        fileName: file.name,
        size: file.size,
      });
      if (!finalRes.success) throw new Error(finalRes.error);

      setComplianceDocs(prev => ({ ...prev, [docType]: finalRes.record }));
      showSuccess(`${getDocTypeLabel(docType)} uploaded successfully.`);
    } catch (err) {
      setDocError(prev => ({ ...prev, [docType]: err.message }));
    } finally {
      setDocUploading(prev => ({ ...prev, [docType]: false }));
      setDocUploadProgress(prev => ({ ...prev, [docType]: 0 }));
    }
  };

  const handleViewDoc = async (documentId) => {
    if (!profile) return;
    const res = await getDocumentViewUrl(profile.uid, documentId);
    if (res.success) {
      window.open(res.viewUrl, '_blank');
    } else {
      toast.error('Failed to open document: ' + res.error);
    }
  };

  const showSuccess = useCallback((msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  const compressImage = (file, maxSize = 300) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          // Scale down to maxSize x maxSize keeping aspect ratio
          if (width > height) {
            if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
          } else {
            if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!file.type.startsWith('image/')) {
      toast.info('Please select an image file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.info('Image must be under 20MB.');
      return;
    }
    setUploadingPhoto(true);
    try {
      // Compress to 300x300 JPEG before uploading
      const base64 = await compressImage(file, 300);
      const res = await uploadProfilePhoto(base64);
      if (res.success) {
        setPhotoURL(res.photo_url);
        if (refreshProfile) refreshProfile();
        showSuccess('Profile photo updated!');
      } else {
        toast.error('Failed to upload photo: ' + res.error);
      }
    } catch (err) {
      toast.error('Failed to upload photo: ' + err.message);
    }
    setUploadingPhoto(false);
  };

  const savePersonal = async () => {
    if (!profile) return;
    setSavingSection('personal');
    try {
      const result = await updateMyProfile({
        first_name: personalForm.first_name.trim(),
        middle_name: personalForm.middle_name.trim() || null,
        last_name: personalForm.last_name.trim(),
        phone: personalForm.phone,
        date_of_birth: personalForm.date_of_birth,
        address: {
          line1: personalForm.addressLine1,
          line2: personalForm.addressLine2,
          city: personalForm.city,
          state: personalForm.state,
          zip: personalForm.zip,
        },
      });
      if (!result.success) throw new Error(result.error || 'Update failed');
      showSuccess('Personal information updated.');
    } catch (err) {
      toast.error(`Failed to save personal info: ${err.message}`);
    } finally {
      setSavingSection(null);
    }
  };

  const saveWorkAuth = async () => {
    if (!profile) return;
    setSavingSection('workauth');
    try {
      const result = await updateMyProfile({
        qualification: {
          work_authorization: workAuthForm.workAuthorization,
        },
      });
      if (!result.success) throw new Error(result.error || 'Update failed');
      showSuccess('Work authorization updated.');
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSavingSection(null);
    }
  };

  const saveLicensing = async () => {
    if (!profile) return;
    setSavingSection('licensing');
    try {
      const result = await updateMyProfile({
        npn: licensingForm.npn,
        resident_state: licensingForm.residentState,
        licensedStates: licensingForm.licensedStates,
        license_expiry: licensingForm.licenseExpiry,
      });
      if (!result.success) throw new Error(result.error || 'Update failed');
      showSuccess('Licensing information updated.');
    } catch (err) {
      toast.error(`Failed to save licensing info: ${err.message}`);
    } finally {
      setSavingSection(null);
    }
  };

  const saveCompliance = async () => {
    if (!profile) return;
    setSavingSection('compliance');
    try {
      const result = await updateMyProfile({
        compliance: {
          has_eo: complianceForm.hasEO,
          eo_provider: complianceForm.eoProvider,
          eo_policy_number: complianceForm.eoPolicyNumber,
          eo_expiry: complianceForm.eoExpiry,
          aml_certified: complianceForm.amlCertified,
          aml_cert_date: complianceForm.amlCertDate,
          aml_provider: complianceForm.amlProvider,
        },
      });
      if (!result.success) throw new Error(result.error || 'Update failed');
      showSuccess('Compliance information updated.');
    } catch (err) {
      toast.error(`Failed to save compliance info: ${err.message}`);
    } finally {
      setSavingSection(null);
    }
  };

  const toggleLicensedState = (st) => {
    setLicensingForm(prev => {
      const updated = prev.licensedStates.includes(st)
        ? prev.licensedStates.filter(s => s !== st)
        : [...prev.licensedStates, st];
      return { ...prev, licensedStates: updated };
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Unable to load profile.</p>
      </div>
    );
  }

  const selectStyles = {
    width: '100%',
    padding: 'var(--space-2) 16px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--surface-card)',
    fontFamily: 'var(--font-base)',
    fontSize: 'var(--text-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    appearance: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 16px center',
    paddingRight: '40px',
  };

  return (
    <div style={{ paddingBottom: 'var(--space-6)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-display)', color: 'var(--brand-navy)', fontWeight: 600, margin: 0 }}>My Profile</h1>
          <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage your personal information, licensing, and compliance
          </p>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      {/* Success toast */}
      {successMessage && (
        <div style={{
          position: 'fixed', top: 'var(--space-3)', right: 'var(--space-3)',
          backgroundColor: 'var(--status-success)', color: '#fff',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: '12px', fontSize: 'var(--text-secondary)',
          fontWeight: 600, zIndex: 10000,
          boxShadow: '0 8px 24px rgba(47, 168, 79, 0.3)',
          animation: 'fadeInDown 0.3s ease'
        }}>
          {successMessage}
        </div>
      )}

      {/* Profile Header Card */}
      <Card style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Avatar with upload */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
              style={{
                width: '88px', height: '88px', borderRadius: '50%',
                backgroundColor: 'var(--brand-navy)', color: 'var(--brand-gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '34px', fontWeight: 'bold',
                cursor: 'pointer', overflow: 'hidden',
                border: '3px solid rgba(227, 169, 74, 0.25)',
                boxShadow: '0 2px 12px rgba(12, 16, 34, 0.12)',
              }}
              title="Click to change photo"
            >
              {uploadingPhoto ? (
                <div style={{
                  width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(12, 16, 34, 0.85)',
                }}>
                  <div style={{
                    width: '26px', height: '26px', border: '3px solid rgba(227, 169, 74, 0.3)',
                    borderTopColor: 'var(--brand-gold)', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              ) : photoURL ? (
                <img src={photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                personalForm.first_name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            {/* Camera badge */}
            <div
              onClick={(e) => { e.stopPropagation(); !uploadingPhoto && fileInputRef.current?.click(); }}
              style={{
                position: 'absolute', bottom: '0', right: '0',
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: 'var(--brand-gold)', color: 'var(--brand-navy)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                border: '2px solid #fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
          </div>

          {/* Name & info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 'var(--text-h2)', color: 'var(--brand-navy)', fontWeight: 700, margin: 0 }}>
              {[personalForm.first_name, personalForm.middle_name, personalForm.last_name].filter(Boolean).join(' ') || 'No name set'}
            </h2>
            <p style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              {profile.email}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {profile.is_owner ? (
                <span style={{
                  padding: '3px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                  fontWeight: 700, background: 'linear-gradient(135deg, #0C1022, #1B2A4E)', color: '#E3A94A',
                  letterSpacing: '0.03em',
                }}>
                  Agency Owner
                </span>
              ) : (
                <span style={{
                  padding: '3px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                  fontWeight: 600, backgroundColor: 'rgba(12, 16, 34, 0.06)',
                  color: 'var(--brand-navy)', textTransform: 'capitalize'
                }}>
                  {profile.role}
                </span>
              )}
              {profile.nxt_id && (
                <span style={{
                  padding: '3px 10px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                  fontWeight: 600, backgroundColor: 'rgba(227, 169, 74, 0.12)',
                  color: '#8B6914', fontFamily: 'var(--font-mono, monospace)',
                }}>
                  {profile.nxt_id}
                </span>
              )}
              {profile.created_at && (
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                  Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Spinner keyframe for upload animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Personal Information */}
      <SectionCard
        title="Personal Information"
        description="Your legal name, contact, and mailing address used for compliance records."
        onSave={savePersonal}
        isSaving={savingSection === 'personal'}
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <div style={{ flex: 2 }}>
            <Input
              id="first_name"
              label="First Name"
              value={personalForm.first_name}
              onChange={e => setPersonalForm({ ...personalForm, first_name: e.target.value })}
              placeholder="John"
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              id="middle_name"
              label="Middle Name"
              value={personalForm.middle_name}
              onChange={e => setPersonalForm({ ...personalForm, middle_name: e.target.value })}
              placeholder="Michael"
            />
          </div>
          <div style={{ flex: 2 }}>
            <Input
              id="last_name"
              label="Last Name"
              value={personalForm.last_name}
              onChange={e => setPersonalForm({ ...personalForm, last_name: e.target.value })}
              placeholder="Doe"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <div style={{ flex: 1 }}>
            <Input
              id="phone"
              label="Phone Number"
              type="tel"
              value={personalForm.phone}
              onChange={e => setPersonalForm({ ...personalForm, phone: formatPhone(e.target.value) })}
              placeholder="(555) 555-5555"
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              id="date_of_birth"
              label="Date of Birth"
              type="date"
              value={personalForm.date_of_birth}
              onChange={e => setPersonalForm({ ...personalForm, date_of_birth: e.target.value })}
            />
          </div>
        </div>
        <AddressAutocomplete
          id="addressLine1"
          label="Street Address"
          value={personalForm.addressLine1}
          onChange={val => setPersonalForm(prev => ({ ...prev, addressLine1: val }))}
          onPlaceSelect={({ line1, city, state, zip }) => {
            setPersonalForm(prev => ({
              ...prev,
              addressLine1: line1,
              city: city || prev.city,
              state: state || prev.state,
              zip: zip || prev.zip,
            }));
          }}
          placeholder="Start typing your address..."
        />
        <Input
          id="addressLine2"
          label="Suite / Apt (Optional)"
          value={personalForm.addressLine2}
          onChange={e => setPersonalForm({ ...personalForm, addressLine2: e.target.value })}
          placeholder="Suite 100"
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <div style={{ flex: 2 }}>
            <Input
              id="city"
              label="City"
              value={personalForm.city}
              onChange={e => setPersonalForm({ ...personalForm, city: e.target.value })}
              placeholder="Dallas"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: 500, color: 'var(--text-primary)' }}>State</label>
            <select value={personalForm.state} onChange={e => setPersonalForm({ ...personalForm, state: e.target.value })} style={selectStyles}>
              <option value="">—</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <Input
              id="zip"
              label="ZIP"
              value={personalForm.zip}
              onChange={e => setPersonalForm({ ...personalForm, zip: e.target.value.replace(/[^\d-]/g, '').slice(0, 10) })}
              placeholder="75201"
            />
          </div>
        </div>
      </SectionCard>

      {/* Work Authorization */}
      <SectionCard
        title="Work Authorization"
        description="Your legal authorization to work in the United States."
        onSave={saveWorkAuth}
        isSaving={savingSection === 'workauth'}
      >
        <div>
          <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: 500, color: 'var(--text-primary)' }}>
            Are you legally authorized to work in the United States?
          </label>
          <select
            value={workAuthForm.workAuthorization}
            onChange={e => setWorkAuthForm({ ...workAuthForm, workAuthorization: e.target.value })}
            style={selectStyles}
          >
            <option value="">Select your work authorization status...</option>
            {WORK_AUTHORIZATION_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </SectionCard>

      {/* Licensing */}
      <SectionCard
        title="Insurance Licensing"
        description="Your NPN, resident state, and active state licenses."
        onSave={saveLicensing}
        isSaving={savingSection === 'licensing'}
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <div style={{ flex: 1 }}>
            <Input
              id="npn"
              label="National Producer Number (NPN)"
              value={licensingForm.npn}
              onChange={e => setLicensingForm({ ...licensingForm, npn: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="e.g. 12345678"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: 500, color: 'var(--text-primary)' }}>Resident State</label>
            <select value={licensingForm.residentState} onChange={e => setLicensingForm({ ...licensingForm, residentState: e.target.value })} style={selectStyles}>
              <option value="">Select state...</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <Input
          id="licenseExpiry"
          label="License Expiration Date"
          type="date"
          value={licensingForm.licenseExpiry}
          onChange={e => setLicensingForm({ ...licensingForm, licenseExpiry: e.target.value })}
        />

        <div>
          <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: 500, color: 'var(--text-primary)' }}>
            Licensed States
          </label>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
            Click to toggle states where you hold an active license.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {US_STATES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleLicensedState(s)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${licensingForm.licensedStates.includes(s) ? 'var(--brand-navy)' : 'var(--border-color)'}`,
                  backgroundColor: licensingForm.licensedStates.includes(s) ? 'var(--brand-navy)' : 'var(--surface-card)',
                  fontFamily: 'var(--font-base)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  color: licensingForm.licensedStates.includes(s) ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {licensingForm.licensedStates.length > 0 && (
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-navy)', fontWeight: 600, marginTop: 'var(--space-1)' }}>
              {licensingForm.licensedStates.length} state{licensingForm.licensedStates.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </SectionCard>

      {/* Print License by State */}
      <Card style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>Print Your Insurance License</h3>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
            Select a state to get the official license printing link.
            {' '}<a href="https://www.nipr.com/PacNpnSearch.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-blue-accent)', textDecoration: 'none', fontWeight: 600 }}>Find your NPN</a>
          </p>
        </div>

        {(() => {
          const myStates = licensingForm.licensedStates || [];
          const licensedData = LICENSE_PRINT_DATA.filter(s => myStates.includes(s.abbr));
          const selected = LICENSE_PRINT_DATA.find(s => s.abbr === selectedPrintState);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {/* Quick access buttons for licensed states */}
              {licensedData.length > 0 && (
                <div>
                  <p style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Quick Access — Your Licensed States
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {licensedData.map(s => (
                      <button
                        key={s.abbr}
                        type="button"
                        onClick={() => setSelectedPrintState(s.abbr === selectedPrintState ? '' : s.abbr)}
                        style={{
                          padding: '7px 16px', borderRadius: '999px',
                          border: selectedPrintState === s.abbr ? '1.5px solid var(--brand-navy)' : '1.5px solid rgba(12, 16, 34, 0.2)',
                          backgroundColor: selectedPrintState === s.abbr ? 'var(--brand-navy)' : 'rgba(12, 16, 34, 0.04)',
                          color: selectedPrintState === s.abbr ? 'var(--brand-gold)' : 'var(--brand-navy)',
                          fontFamily: 'var(--font-base)', fontSize: '15px', fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.15s ease',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {s.abbr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dropdown for all states */}
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {licensedData.length > 0 ? 'Or select any state' : 'Select a state'}
                </label>
                <select
                  value={selectedPrintState}
                  onChange={e => setSelectedPrintState(e.target.value)}
                  style={selectStyles}
                >
                  <option value="">Choose a state...</option>
                  {LICENSE_PRINT_DATA.map(s => (
                    <option key={s.abbr} value={s.abbr}>
                      {s.state} ({s.abbr}){myStates.includes(s.abbr) ? ' — Licensed' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected state detail card */}
              {selected && (
                <div style={{
                  border: '1.5px solid rgba(12, 16, 34, 0.12)',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  backgroundColor: 'rgba(12, 16, 34, 0.02)',
                  marginTop: '4px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '16px',
                        backgroundColor: 'var(--brand-navy)', color: 'var(--brand-gold)',
                      }}>
                        {selected.abbr}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)' }}>
                          {selected.state}
                        </div>
                        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: '1px' }}>
                          {selected.system}
                        </div>
                      </div>
                    </div>
                    {myStates.includes(selected.abbr) && (
                      <span style={{
                        padding: '3px 10px', borderRadius: '999px',
                        fontSize: '13px', fontWeight: 700,
                        backgroundColor: 'rgba(47, 168, 79, 0.1)', color: 'var(--status-success)',
                      }}>
                        LICENSED
                      </span>
                    )}
                  </div>

                  <div style={{
                    fontSize: 'var(--text-caption)', color: 'var(--text-secondary)',
                    padding: '8px 12px', borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.03)', marginBottom: '14px', lineHeight: 1.6,
                  }}>
                    <strong style={{ color: 'var(--text-primary)' }}>You will need:</strong> {selected.needs}
                  </div>

                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      width: '100%', padding: '12px 20px', borderRadius: '12px',
                      backgroundColor: 'var(--brand-navy)', color: 'var(--brand-gold)',
                      textDecoration: 'none', fontWeight: 700, fontSize: 'var(--text-secondary)',
                      border: 'none', cursor: 'pointer',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    Print {selected.state} License
                  </a>
                </div>
              )}
            </div>
          );
        })()}
      </Card>

      {/* Compliance */}
      <SectionCard
        title="Compliance & Coverage"
        description="E&O insurance and AML certification details."
        onSave={saveCompliance}
        isSaving={savingSection === 'compliance'}
      >
        {/* E&O */}
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: 'var(--space-2) 16px',
          backgroundColor: 'rgba(0,0,0,0.01)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)' }}>
                Errors & Omissions (E&O) Insurance
              </span>
              <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Professional liability coverage required by most carriers
              </span>
            </div>
            <div
              onClick={() => setComplianceForm({ ...complianceForm, hasEO: !complianceForm.hasEO })}
              role="switch"
              aria-checked={complianceForm.hasEO}
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setComplianceForm({ ...complianceForm, hasEO: !complianceForm.hasEO }); } }}
              style={{
                width: '44px', height: '24px', borderRadius: '999px',
                backgroundColor: complianceForm.hasEO ? 'var(--status-success)' : 'rgba(0,0,0,0.12)',
                position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s ease', flexShrink: 0
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff',
                position: 'absolute', top: '2px', left: '2px',
                transition: 'transform 0.2s ease',
                transform: complianceForm.hasEO ? 'translateX(20px)' : 'translateX(0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </div>
          </div>
          {complianceForm.hasEO && (
            <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <div style={{ flex: 1 }}>
                  <Input id="eoProvider" label="E&O Provider" value={complianceForm.eoProvider} onChange={e => setComplianceForm({ ...complianceForm, eoProvider: e.target.value })} placeholder="e.g. NAPA, CalSurance" />
                </div>
                <div style={{ flex: 1 }}>
                  <Input id="eoPolicyNumber" label="Policy Number" value={complianceForm.eoPolicyNumber} onChange={e => setComplianceForm({ ...complianceForm, eoPolicyNumber: e.target.value })} placeholder="e.g. EO-2024-12345" />
                </div>
              </div>
              <Input id="eoExpiry" label="E&O Expiration Date" type="date" value={complianceForm.eoExpiry} onChange={e => setComplianceForm({ ...complianceForm, eoExpiry: e.target.value })} />

              {/* E&O Certificate Upload */}
              <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'rgba(12, 16, 34, 0.03)', border: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)' }}>
                      E&O Certificate
                    </span>
                    {complianceDocs.eo_certificate ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                          backgroundColor: complianceDocs.eo_certificate.status === 'approved' ? 'var(--status-success)' : complianceDocs.eo_certificate.status === 'rejected' ? 'var(--status-error)' : 'var(--brand-gold)',
                        }} />
                        {complianceDocs.eo_certificate.fileName}
                        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>({complianceDocs.eo_certificate.status?.replace('_', ' ')})</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                        Upload your E&O insurance certificate (PDF, JPG, PNG)
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {complianceDocs.eo_certificate && (
                      <button className="nxt-btn nxt-btn-sm"
                        type="button"
                        onClick={() => handleViewDoc(complianceDocs.eo_certificate.id)}
                      >
                        View
                      </button>
                    )}
                    <button className="nxt-btn nxt-btn-sm"
                      type="button"
                      onClick={() => eoFileRef.current?.click()}
                      disabled={docUploading.eo_certificate}
                    >
                      {docUploading.eo_certificate ? `Uploading ${docUploadProgress.eo_certificate}%` : complianceDocs.eo_certificate ? 'Replace' : 'Upload'}
                    </button>
                    <input ref={eoFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { handleDocUpload(e.target.files?.[0], 'eo_certificate'); e.target.value = ''; }} style={{ display: 'none' }} />
                  </div>
                </div>
                {docUploading.eo_certificate && (
                  <div style={{ marginTop: '8px', height: '3px', borderRadius: '2px', backgroundColor: 'rgba(12, 16, 34, 0.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${docUploadProgress.eo_certificate}%`, backgroundColor: 'var(--brand-navy)', borderRadius: '2px', transition: 'width 0.2s ease' }} />
                  </div>
                )}
                {docError.eo_certificate && (
                  <p style={{ fontSize: 'var(--text-caption)', color: 'var(--status-error)', margin: '6px 0 0 0' }}>{docError.eo_certificate}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* AML */}
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: 'var(--space-2) 16px',
          backgroundColor: 'rgba(0,0,0,0.01)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)' }}>
                Anti-Money Laundering (AML) Certification
              </span>
              <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Required training for all licensed insurance producers
              </span>
            </div>
            <div
              onClick={() => setComplianceForm({ ...complianceForm, amlCertified: !complianceForm.amlCertified })}
              role="switch"
              aria-checked={complianceForm.amlCertified}
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setComplianceForm({ ...complianceForm, amlCertified: !complianceForm.amlCertified }); } }}
              style={{
                width: '44px', height: '24px', borderRadius: '999px',
                backgroundColor: complianceForm.amlCertified ? 'var(--status-success)' : 'rgba(0,0,0,0.12)',
                position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s ease', flexShrink: 0
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff',
                position: 'absolute', top: '2px', left: '2px',
                transition: 'transform 0.2s ease',
                transform: complianceForm.amlCertified ? 'translateX(20px)' : 'translateX(0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </div>
          </div>
          {complianceForm.amlCertified && (
            <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <div style={{ flex: 1 }}>
                  <Input id="amlProvider" label="AML Training Provider" value={complianceForm.amlProvider} onChange={e => setComplianceForm({ ...complianceForm, amlProvider: e.target.value })} placeholder="e.g. SureLC / SuranceBay" />
                </div>
                <div style={{ flex: 1 }}>
                  <Input id="amlCertDate" label="Certification Date" type="date" value={complianceForm.amlCertDate} onChange={e => setComplianceForm({ ...complianceForm, amlCertDate: e.target.value })} />
                </div>
              </div>

              {/* AML Certificate Upload */}
              <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'rgba(12, 16, 34, 0.03)', border: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)' }}>
                      AML Certificate
                    </span>
                    {complianceDocs.anti_money_laundering ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                          backgroundColor: complianceDocs.anti_money_laundering.status === 'approved' ? 'var(--status-success)' : complianceDocs.anti_money_laundering.status === 'rejected' ? 'var(--status-error)' : 'var(--brand-gold)',
                        }} />
                        {complianceDocs.anti_money_laundering.fileName}
                        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>({complianceDocs.anti_money_laundering.status?.replace('_', ' ')})</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                        Upload your AML training certificate (PDF, JPG, PNG)
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {complianceDocs.anti_money_laundering && (
                      <button className="nxt-btn nxt-btn-sm"
                        type="button"
                        onClick={() => handleViewDoc(complianceDocs.anti_money_laundering.id)}
                      >
                        View
                      </button>
                    )}
                    <button className="nxt-btn nxt-btn-sm"
                      type="button"
                      onClick={() => amlFileRef.current?.click()}
                      disabled={docUploading.anti_money_laundering}
                    >
                      {docUploading.anti_money_laundering ? `Uploading ${docUploadProgress.anti_money_laundering}%` : complianceDocs.anti_money_laundering ? 'Replace' : 'Upload'}
                    </button>
                    <input ref={amlFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { handleDocUpload(e.target.files?.[0], 'anti_money_laundering'); e.target.value = ''; }} style={{ display: 'none' }} />
                  </div>
                </div>
                {docUploading.anti_money_laundering && (
                  <div style={{ marginTop: '8px', height: '3px', borderRadius: '2px', backgroundColor: 'rgba(12, 16, 34, 0.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${docUploadProgress.anti_money_laundering}%`, backgroundColor: 'var(--brand-navy)', borderRadius: '2px', transition: 'width 0.2s ease' }} />
                  </div>
                )}
                {docError.anti_money_laundering && (
                  <p style={{ fontSize: 'var(--text-caption)', color: 'var(--status-error)', margin: '6px 0 0 0' }}>{docError.anti_money_laundering}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Account Info (read-only) */}
      <Card>
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>Account</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-1) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</span>
            <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-primary)' }}>{profile.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-1) 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</span>
            <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{profile.role}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-1) 0' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Member Since</span>
            <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-primary)' }}>
              {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
      </Card>

      <style jsx global>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
