"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './DocumentSigning.module.css';

const DOCUMENTS = [
  {
    id: 'ica',
    title: 'Independent Contractor Agreement',
    shortTitle: 'ICA',
    pdfPath: '/documents/NXT_Independent_Contractor_Agreement_Revised.pdf',
    description: 'This agreement establishes your independent contractor relationship with NXT World Holdings Inc., d/b/a NXT Financial Group.',
    companySignee: {
      name: 'Shiv Thakur',
      title: 'President',
      entity: 'NXT WORLD HOLDINGS INC., d/b/a NXT Financial Group',
    },
    agentFields: ['signature', 'printName', 'date'],
    hasEntityAcknowledgment: true,
  },
  {
    id: 'aoa',
    title: 'Agent Ownership Agreement',
    shortTitle: 'AOA',
    pdfPath: '/documents/NXT_Agent_Ownership_Agreement_Revised.pdf',
    description: 'This agreement covers commissions, book of business ownership, compliance, and your rights and obligations as an Associate.',
    companySignee: {
      name: 'Shiv Thakur',
      title: 'President',
      entity: 'NXT WORLD HOLDINGS INC., d/b/a NXT Financial Group',
      address: '75 Pleasant Street, Unit 207, Malden, Massachusetts 02148',
    },
    agentFields: ['signature', 'printName', 'assignedLevel', 'date'],
  },
  {
    id: 'businessStandards',
    title: 'Business Standards',
    shortTitle: 'Standards',
    pdfPath: '/documents/NXT_Business_Standards_Revised.pdf',
    description: 'Code of conduct covering honesty, licensing, sales practices, compliance, and professional standards.',
    companySignee: null,
    agentFields: ['signature', 'printName', 'date'],
  },
];

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function DocumentSigning({
  agentName,
  assignedLevel,
  signatures,
  onSignaturesChange,
  validationErrors,
}) {
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [scrolledToBottom, setScrolledToBottom] = useState({});
  const pdfContainerRef = useRef(null);
  const today = formatDate(new Date());

  // Pre-fill printName for all documents when agentName is available
  useEffect(() => {
    if (!agentName) return;
    const updated = { ...signatures };
    let changed = false;
    for (const doc of DOCUMENTS) {
      if (!updated[doc.id]?.printName) {
        updated[doc.id] = { ...(updated[doc.id] || {}), printName: agentName };
        changed = true;
      }
    }
    if (changed) onSignaturesChange(updated);
  }, [agentName]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDoc = DOCUMENTS[activeDocIndex];
  const currentSig = signatures[activeDoc.id] || {};

  const handleSignatureChange = (docId, field, value) => {
    onSignaturesChange({
      ...signatures,
      [docId]: {
        ...(signatures[docId] || {}),
        [field]: value,
      },
    });
  };

  const handleScroll = (e) => {
    const el = e.target;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom && !scrolledToBottom[activeDoc.id]) {
      setScrolledToBottom((prev) => ({ ...prev, [activeDoc.id]: true }));
    }
  };

  const isDocSigned = (docId) => {
    const sig = signatures[docId];
    if (!sig) return false;
    return sig.signatureName?.trim() && sig.printName?.trim() && sig.consent;
  };

  const canProceedToNext = isDocSigned(activeDoc.id);

  const handleNextDoc = () => {
    if (activeDocIndex < DOCUMENTS.length - 1) {
      setActiveDocIndex(activeDocIndex + 1);
      if (pdfContainerRef.current) {
        pdfContainerRef.current.scrollTop = 0;
      }
    }
  };

  const handlePrevDoc = () => {
    if (activeDocIndex > 0) {
      setActiveDocIndex(activeDocIndex - 1);
    }
  };

  const allSigned = DOCUMENTS.every((d) => isDocSigned(d.id));

  return (
    <div className={styles.container}>
      {/* Document tabs */}
      <div className={styles.docTabs}>
        {DOCUMENTS.map((doc, i) => {
          const signed = isDocSigned(doc.id);
          return (
            <button
              key={doc.id}
              type="button"
              className={`${styles.docTab} ${i === activeDocIndex ? styles.docTabActive : ''} ${signed ? styles.docTabSigned : ''}`}
              onClick={() => setActiveDocIndex(i)}
            >
              <span className={styles.docTabNumber}>
                {signed ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={styles.docTabLabel}>{doc.shortTitle}</span>
            </button>
          );
        })}
      </div>

      {/* Progress indicator */}
      <div className={styles.docProgress}>
        <span className={styles.docProgressText}>
          Document {activeDocIndex + 1} of {DOCUMENTS.length}
        </span>
        <span className={styles.docProgressCount}>
          {DOCUMENTS.filter((d) => isDocSigned(d.id)).length} of {DOCUMENTS.length} signed
        </span>
      </div>

      {/* Document header */}
      <div className={styles.docHeader}>
        <h4 className={styles.docTitle}>{activeDoc.title}</h4>
        <p className={styles.docDescription}>{activeDoc.description}</p>
      </div>

      {/* PDF viewer */}
      <div className={styles.pdfSection}>
        <div className={styles.pdfLabel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Please read the entire document before signing</span>
        </div>
        <div
          ref={pdfContainerRef}
          className={styles.pdfContainer}
          onScroll={handleScroll}
        >
          <iframe
            src={`${activeDoc.pdfPath}#toolbar=1&navpanes=0`}
            className={styles.pdfFrame}
            title={activeDoc.title}
          />
        </div>
        <a
          href={activeDoc.pdfPath}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.downloadLink}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Open in new tab / Download PDF
        </a>
      </div>

      {/* Signature area */}
      <div className={styles.signatureArea}>
        <h4 className={styles.signatureSectionTitle}>Signature Block</h4>

        {/* Company signature (auto-filled) */}
        {activeDoc.companySignee && (
          <div className={styles.companySignature}>
            <div className={styles.signatureLabel}>COMPANY</div>
            <div className={styles.companyEntity}>{activeDoc.companySignee.entity}</div>
            <div className={styles.companySignatureRow}>
              <div className={styles.signatureField}>
                <div className={styles.autoSignature}>
                  <span className={styles.autoSignatureName}>{activeDoc.companySignee.name}</span>
                  <span className={styles.autoSignatureBadge}>Auto-signed</span>
                </div>
                <div className={styles.signatureFieldLabel}>Signature</div>
              </div>
            </div>
            <div className={styles.companyDetails}>
              <div className={styles.companyDetailRow}>
                <span className={styles.companyDetailLabel}>Name:</span>
                <span className={styles.companyDetailValue}>{activeDoc.companySignee.name}</span>
              </div>
              <div className={styles.companyDetailRow}>
                <span className={styles.companyDetailLabel}>Title:</span>
                <span className={styles.companyDetailValue}>{activeDoc.companySignee.title}</span>
              </div>
              {activeDoc.companySignee.address && (
                <div className={styles.companyDetailRow}>
                  <span className={styles.companyDetailLabel}>Address:</span>
                  <span className={styles.companyDetailValue}>{activeDoc.companySignee.address}</span>
                </div>
              )}
              <div className={styles.companyDetailRow}>
                <span className={styles.companyDetailLabel}>Date:</span>
                <span className={styles.companyDetailValue}>{today}</span>
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        {activeDoc.companySignee && <div className={styles.signatureDivider} />}

        {/* Agent signature */}
        <div className={styles.agentSignature}>
          <div className={styles.signatureLabel}>
            {activeDoc.id === 'ica' ? 'CONTRACTOR' : 'ASSOCIATE'}
          </div>

          <div className={styles.signatureInputGroup}>
            <div className={styles.signatureInputField}>
              <label className={styles.signatureInputLabel} htmlFor={`sig-name-${activeDoc.id}`}>
                Type Your Full Legal Name (Electronic Signature) *
              </label>
              <input
                id={`sig-name-${activeDoc.id}`}
                type="text"
                className={`${styles.signatureInput} ${styles.signatureHandwriting}`}
                value={currentSig.signatureName || ''}
                onChange={(e) => handleSignatureChange(activeDoc.id, 'signatureName', e.target.value)}
                placeholder="Type your full legal name"
              />
              {validationErrors[`${activeDoc.id}_signatureName`] && (
                <span className={styles.fieldError}>{validationErrors[`${activeDoc.id}_signatureName`]}</span>
              )}
              <div className={styles.signatureFieldLabel}>Signature</div>
            </div>

            <div className={styles.signatureInputField}>
              <label className={styles.signatureInputLabel} htmlFor={`print-name-${activeDoc.id}`}>
                Print Name *
              </label>
              <input
                id={`print-name-${activeDoc.id}`}
                type="text"
                className={styles.signatureInput}
                value={currentSig.printName || ''}
                onChange={(e) => handleSignatureChange(activeDoc.id, 'printName', e.target.value)}
                placeholder="Print your name"
              />
              {validationErrors[`${activeDoc.id}_printName`] && (
                <span className={styles.fieldError}>{validationErrors[`${activeDoc.id}_printName`]}</span>
              )}
            </div>

            {activeDoc.agentFields.includes('assignedLevel') && (
              <div className={styles.signatureInputField}>
                <label className={styles.signatureInputLabel}>Assigned Level as of the Effective Date</label>
                <div className={styles.autoFilledField}>
                  Level {assignedLevel}
                </div>
              </div>
            )}

            <div className={styles.signatureInputField}>
              <label className={styles.signatureInputLabel}>Date</label>
              <div className={styles.autoFilledField}>{today}</div>
            </div>
          </div>

          {/* Consent checkbox */}
          <label className={styles.consentRow}>
            <input
              type="checkbox"
              checked={currentSig.consent || false}
              onChange={(e) => handleSignatureChange(activeDoc.id, 'consent', e.target.checked)}
              className={styles.consentCheckbox}
            />
            <span className={styles.consentText}>
              I have read the {activeDoc.title} in its entirety. By typing my name above, I acknowledge that
              my electronic signature has the same legal effect as a handwritten signature under the
              ESIGN Act (15 U.S.C. 7001) and applicable state law.
            </span>
          </label>
          {validationErrors[`${activeDoc.id}_consent`] && (
            <span className={styles.fieldError}>{validationErrors[`${activeDoc.id}_consent`]}</span>
          )}
        </div>
      </div>

      {/* Document navigation */}
      <div className={styles.docNav}>
        {activeDocIndex > 0 && (
          <button
            type="button"
            className={styles.docNavBtn}
            onClick={handlePrevDoc}
          >
            Previous Document
          </button>
        )}
        <div style={{ flex: 1 }} />
        {activeDocIndex < DOCUMENTS.length - 1 && (
          <button
            type="button"
            className={`${styles.docNavBtn} ${styles.docNavBtnPrimary} ${!canProceedToNext ? styles.docNavBtnDisabled : ''}`}
            onClick={handleNextDoc}
            disabled={!canProceedToNext}
          >
            Sign & Continue to Next Document
          </button>
        )}
        {activeDocIndex === DOCUMENTS.length - 1 && allSigned && (
          <div className={styles.allSignedBadge}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            All documents signed
          </div>
        )}
      </div>
    </div>
  );
}

// Validate all 3 documents are signed — called from the parent onboarding page
DocumentSigning.validate = (signatures) => {
  const errors = {};
  DOCUMENTS.forEach((doc) => {
    const sig = signatures[doc.id] || {};
    if (!sig.signatureName?.trim()) {
      errors[`${doc.id}_signatureName`] = `Signature required for ${doc.shortTitle}`;
    }
    if (!sig.printName?.trim()) {
      errors[`${doc.id}_printName`] = `Print name required for ${doc.shortTitle}`;
    }
    if (!sig.consent) {
      errors[`${doc.id}_consent`] = `You must acknowledge the ${doc.shortTitle}`;
    }
  });
  return errors;
};

// Build the agreement data to save to Firestore
DocumentSigning.buildAgreementData = (signatures, agentName, assignedLevel) => {
  const now = new Date().toISOString();
  return {
    ica: {
      signatureName: signatures.ica?.signatureName || '',
      printName: signatures.ica?.printName || agentName || '',
      entityName: signatures.ica?.entityName || null,
      entityTitle: signatures.ica?.entityTitle || null,
      signed_at: now,
      company_signee: 'Shiv Thakur',
      company_title: 'President',
    },
    aoa: {
      signatureName: signatures.aoa?.signatureName || '',
      printName: signatures.aoa?.printName || agentName || '',
      assignedLevel: assignedLevel,
      signed_at: now,
      company_signee: 'Shiv Thakur',
      company_title: 'President',
    },
    businessStandards: {
      signatureName: signatures.businessStandards?.signatureName || '',
      printName: signatures.businessStandards?.printName || agentName || '',
      signed_at: now,
    },
    all_signed_at: now,
    esign_consent: true,
  };
};
