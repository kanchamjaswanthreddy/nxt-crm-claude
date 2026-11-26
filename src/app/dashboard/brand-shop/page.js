'use client';

import { useState } from 'react';

const CATEGORIES = [
  { value: 'all', label: 'All Items' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'print', label: 'Print Materials' },
  { value: 'digital', label: 'Digital Assets' },
];

const BRAND_ITEMS = [
  {
    id: 1,
    name: 'NXT Polo Shirt',
    category: 'apparel',
    description: 'Navy blue polo with embroidered NXT Financial Group logo. Premium cotton blend.',
    image: null,
    tags: ['Popular'],
  },
  {
    id: 2,
    name: 'NXT Business Cards',
    category: 'print',
    description: 'Professional business cards with NXT branding. Pack of 250.',
    image: null,
    tags: [],
  },
  {
    id: 3,
    name: 'NXT Presentation Folder',
    category: 'print',
    description: 'Branded presentation folder for client meetings. Pack of 25.',
    image: null,
    tags: [],
  },
  {
    id: 4,
    name: 'NXT Lapel Pin',
    category: 'accessories',
    description: 'Gold-tone NXT logo lapel pin. Great for events and meetings.',
    image: null,
    tags: ['New'],
  },
  {
    id: 5,
    name: 'NXT Branded Pen Set',
    category: 'accessories',
    description: 'Set of 5 premium pens with NXT branding.',
    image: null,
    tags: [],
  },
  {
    id: 6,
    name: 'NXT Logo Pack',
    category: 'digital',
    description: 'High-resolution NXT logos in PNG, SVG, and PDF formats for marketing materials.',
    image: null,
    tags: [],
  },
  {
    id: 7,
    name: 'NXT Email Signature Template',
    category: 'digital',
    description: 'Professional email signature template with NXT branding and social links.',
    image: null,
    tags: ['Popular'],
  },
  {
    id: 8,
    name: 'NXT Dress Shirt',
    category: 'apparel',
    description: 'White dress shirt with subtle NXT monogram on cuff. Wrinkle-resistant.',
    image: null,
    tags: [],
  },
  {
    id: 9,
    name: 'NXT Tote Bag',
    category: 'accessories',
    description: 'Canvas tote bag with NXT logo. Perfect for conferences and events.',
    image: null,
    tags: ['New'],
  },
  {
    id: 10,
    name: 'NXT Social Media Kit',
    category: 'digital',
    description: 'Branded social media templates for LinkedIn, Facebook, and Instagram.',
    image: null,
    tags: [],
  },
  {
    id: 11,
    name: 'NXT Flyer Templates',
    category: 'print',
    description: 'Customizable flyer templates for open enrollment and seminars.',
    image: null,
    tags: [],
  },
  {
    id: 12,
    name: 'NXT Lanyard',
    category: 'accessories',
    description: 'Navy blue lanyard with NXT logo. Includes badge clip.',
    image: null,
    tags: [],
  },
];

export default function BrandShopPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = BRAND_ITEMS.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
          NXT Brand Shop
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginTop: 6 }}>
          Official branded merchandise, marketing materials, and digital assets for NXT Financial Group agents.
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex', background: 'var(--surface-card)', borderRadius: 8,
          border: '1px solid var(--border-color)', overflow: 'hidden',
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: activeCategory === cat.value ? 600 : 500,
                color: activeCategory === cat.value ? '#fff' : 'var(--text-secondary)',
                background: activeCategory === cat.value ? 'var(--brand-navy)' : 'transparent',
                border: 'none', cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '8px 14px', fontSize: 14,
            border: '1px solid var(--border-color)', borderRadius: 8,
            background: 'var(--surface-card)', color: 'var(--text-primary)',
            width: 240, outline: 'none',
          }}
        />
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 20,
      }}>
        {filtered.map(item => (
          <div key={item.id} style={{
            background: 'var(--surface-card)', borderRadius: 12,
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            transition: 'box-shadow 200ms, transform 200ms',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {/* Placeholder image */}
            <div style={{
              height: 160, background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-light) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0" />
              </svg>
              {item.tags.length > 0 && (
                <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                  {item.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: tag === 'New' ? 'var(--brand-gold)' : 'rgba(255,255,255,0.2)',
                      color: tag === 'New' ? 'var(--brand-navy)' : '#fff',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-navy)', margin: 0 }}>
                  {item.name}
                </h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {item.description}
              </p>
              <div style={{ marginTop: 12 }}>
                <span style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 11,
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  background: 'var(--surface-inset)', color: 'var(--text-secondary)',
                }}>
                  {CATEGORIES.find(c => c.value === item.category)?.label}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 12 }}>
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 500 }}>No items found</p>
          <p style={{ fontSize: 14 }}>Try a different category or search term.</p>
        </div>
      )}

      {/* Info banner */}
      <div style={{
        marginTop: 32, padding: 20, borderRadius: 12,
        background: 'linear-gradient(135deg, #F0F4FF 0%, #E8F0FE 100%)',
        border: '1px solid #C7D6F0',
      }}>
        <p style={{ fontSize: 14, color: 'var(--brand-navy)', fontWeight: 600, margin: '0 0 4px' }}>
          Need something custom?
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Contact your agency admin or raise a request through NXT Help for custom branded materials, event-specific merchandise, or bulk orders.
        </p>
      </div>
    </div>
  );
}
