import nodemailer from 'nodemailer';

export async function sendBookingNotification(email, bookingDetails) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Booking Confirmation',
    text: `Your booking is confirmed for ${bookingDetails.date} at ${bookingDetails.time}.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification sent to:', email);
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}