import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { PageHeader, FullPageSpinner } from '../components/ui';
import { FiSearch, FiChevronDown, FiChevronUp, FiMessageSquare } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const FAQItem = ({ faq, isOpen, onClick }) => (
  <div className={`card overflow-hidden transition-all duration-200 ${isOpen ? 'ring-2 ring-blue-200' : ''}`}>
    <button onClick={onClick} className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-blue-50/50 transition-colors">
      <span className="font-semibold text-gray-800 text-sm">{faq.question}</span>
      {isOpen ? <FiChevronUp className="text-blue-600 flex-shrink-0" size={18} /> : <FiChevronDown className="text-gray-400 flex-shrink-0" size={18} />}
    </button>
    {isOpen && (
      <div className="px-5 pb-5 pt-0 text-sm text-gray-600 leading-relaxed border-t border-blue-50 animate-fade-in">
        {faq.answer}
      </div>
    )}
  </div>
);

export default function FAQPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    API.get('/chat/faqs').then(r => setFaqs(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = faqs.filter(f =>
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="FAQ" subtitle="Find answers to common questions" />

      {/* Search */}
      <div className="relative mb-6">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input className="input pl-11 py-3 text-base" placeholder="Search questions..."
          value={search} onChange={e => { setSearch(e.target.value); setOpenIndex(null); }} />
      </div>

      {loading ? <FullPageSpinner /> : (
        <>
          <div className="space-y-3 mb-8">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🤔</div>
                <p className="text-gray-500">No FAQs match your search.</p>
              </div>
            ) : filtered.map((faq, i) => (
              <FAQItem key={i} faq={faq} isOpen={openIndex === i}
                onClick={() => setOpenIndex(openIndex === i ? null : i)} />
            ))}
          </div>

          {/* CTA */}
          <div className="card p-6 text-center" style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)' }}>
            <FiMessageSquare size={28} className="text-blue-500 mx-auto mb-3" />
            <h3 className="font-display font-bold text-gray-900 mb-1">Still have questions?</h3>
            <p className="text-sm text-gray-500 mb-4">Can't find what you're looking for? Our support team is here to help.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/ai-assistant" className="btn-secondary text-sm">🤖 Ask AI Assistant</Link>
              <Link to="/tickets/new" className="btn-primary text-sm">🎫 Raise a Ticket</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
