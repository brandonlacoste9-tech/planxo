import React, { useState, useEffect } from 'react';
import './BookingFlow.css';

const BookingFlow = () => {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [userDetails, setUserDetails] = useState({ name: '', email: '' });
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    // Fetch available slots
    fetch('/api/v2/slots')
      .then((res) => res.json())
      .then((data) => setAvailableSlots(data.slots || []))
      .catch((err) => console.error('Error fetching slots:', err));
  }, []);

  const handleBooking = () => {
    if (!selectedSlot || !userDetails.name || !userDetails.email) {
      alert('Please fill in all details and select a slot.');
      return;
    }

    fetch('/api/v2/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: selectedSlot,
        user: userDetails,
      }),
    })
      .then((res) => res.json())
      .then((data) => setConfirmation(data))
      .catch((err) => console.error('Error booking slot:', err));
  };

  return (
    <div>
      <h1>Book an Appointment</h1>

      <div>
        <h2>Available Slots</h2>
        <ul>
          {availableSlots.map((slot) => (
            <li key={slot.id}>
              <button onClick={() => setSelectedSlot(slot)}>
                {slot.time}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2>Your Details</h2>
        <input
          type="text"
          placeholder="Name"
          value={userDetails.name}
          onChange={(e) => setUserDetails({ ...userDetails, name: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={userDetails.email}
          onChange={(e) => setUserDetails({ ...userDetails, email: e.target.value })}
        />
      </div>

      <button onClick={handleBooking}>Confirm Booking</button>

      {confirmation && <div>Booking Confirmed: {confirmation.message}</div>}
    </div>
  );
};

export default BookingFlow;