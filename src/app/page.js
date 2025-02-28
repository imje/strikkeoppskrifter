'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import PdfList from '@/components/PdfList';
import PdfUploader from '@/components/PdfUploader';
import LandingPage from '@/components/LandingPage';

export default function Home() {
  const [newDocument, setNewDocument] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUploadSuccess = (doc) => {
    setNewDocument(doc);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <section>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--mainheader)]">
            Strikkeoppskrifter
          </h2>
          <PdfUploader onUploadSuccess={handleUploadSuccess} />
        </div>
        <PdfList newDocument={newDocument} onUploadSuccess={handleUploadSuccess} />
      </div>
    </section>
  );
}
