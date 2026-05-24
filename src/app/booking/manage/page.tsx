'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ManageBookingContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reschedule form state
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Lien invalide ou expiré');
      setLoading(false);
      return;
    }

    fetchBooking();
  }, [token]);

  const fetchBooking = async () => {
    try {
      const response = await fetch(`/api/booking/verify?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Rendez-vous introuvable');
      } else {
        setBooking(data.booking);
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce rendez-vous ?')) return;

    setLoading(true);
    try {
      const response = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Rendez-vous annulé avec succès');
        setBooking({ ...booking, status: 'CANCELLED' });
      } else {
        setError(data.error || 'Erreur lors de l\'annulation');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDate || !newTime) {
      setError('Veuillez sélectionner une date et une heure');
      return;
    }

    setLoading(true);
    try {
      const newStartTime = new Date(`${newDate}T${newTime}`);
      const duration = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
      const newEndTime = new Date(newStartTime.getTime() + duration);

      const response = await fetch('/api/booking/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newStartTime: newStartTime.toISOString(),
          newEndTime: newEndTime.toISOString(),
          reason
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Rendez-vous modifié avec succès');
        setBooking({
          ...booking,
          startTime: data.newStartTime,
          endTime: data.newEndTime,
          status: 'RESCHEDULED'
        });
      } else {
        setError(data.error || 'Erreur lors de la modification');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[#D4AF37] text-xl">Chargement...</div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] border border-[#A62B2B] rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-[#A62B2B] text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-4">Erreur</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] border border-[#D4AF37] rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-[#D4AF37] text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-4">Succès</h1>
          <p className="text-gray-400 mb-6">{success}</p>
          <a href="/" className="text-[#D4AF37] hover:underline">
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  if (booking?.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-gray-500 text-5xl mb-4">📅</div>
          <h1 className="text-2xl font-bold text-white mb-4">Rendez-vous annulé</h1>
          <p className="text-gray-400 mb-6">Ce rendez-vous a déjà été annulé.</p>
          <a href="/" className="text-[#D4AF37] hover:underline">
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  const eventDate = booking ? new Date(booking.startTime).toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : '';

  const eventTime = booking ? new Date(booking.startTime).toLocaleTimeString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">Planxo</h1>
          <p className="text-gray-400">Gestion de rendez-vous</p>
        </div>

        {/* Booking Info Card */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            {booking?.title || 'Votre rendez-vous'}
          </h2>
          
          <div className="space-y-3 text-gray-300">
            <div className="flex items-center">
              <span className="text-[#D4AF37] mr-3">📅</span>
              <span>{eventDate}</span>
            </div>
            <div className="flex items-center">
              <span className="text-[#D4AF37] mr-3">⏰</span>
              <span>{eventTime}</span>
            </div>
            {booking?.responses?.name && (
              <div className="flex items-center">
                <span className="text-[#D4AF37] mr-3">👤</span>
                <span>{booking.responses.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-[#A62B2B]/20 border border-[#A62B2B] rounded-lg p-4 mb-6">
            <p className="text-[#A62B2B]">{error}</p>
          </div>
        )}

        {/* Action Section */}
        {action === 'cancel' ? (
          <div className="bg-[#1a1a1a] border border-[#A62B2B]/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Annuler le rendez-vous</h3>
            <p className="text-gray-400 mb-4">
              Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action est irréversible.
            </p>
            
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Raison de l'annulation (optionnel)"
              className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 mb-4"
              rows={3}
            />

            <div className="flex gap-4">
              <button
                onClick={() => window.history.back()}
                className="flex-1 py-3 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Retour
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-[#A62B2B] text-white rounded-lg hover:bg-[#8a2424] transition disabled:opacity-50"
              >
                {loading ? 'Annulation...' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Modifier le rendez-vous</h3>
            
            <form onSubmit={handleReschedule} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-2">Nouvelle date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Nouvelle heure</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">Raison (optionnel)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Pourquoi souhaitez-vous reporter ?"
                  className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500"
                  rows={3}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="flex-1 py-3 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c4a030] transition disabled:opacity-50"
                >
                  {loading ? 'Modification...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Planxo - Gestion de rendez-vous simplifiée</p>
        </div>
      </div>
    </div>
  );
}

export default function ManageBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[#D4AF37] text-xl">Chargement...</div>
      </div>
    }>
      <ManageBookingContent />
    </Suspense>
  );
}
