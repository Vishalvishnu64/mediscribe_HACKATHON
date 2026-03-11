const webpush = require('web-push');
const cron = require('node-cron');
const Medication = require('../models/Medication');
const User = require('../models/User');

// Twilio SMS setup
let twilioClient = null;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && TWILIO_PHONE
    && process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('[SMS] Twilio configured for nominee SMS alerts');
  } catch (err) {
    console.log('[SMS] Twilio initialization failed:', err.message);
  }
} else {
  console.log('[SMS] Twilio not configured — SMS alerts disabled. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env');
}

// VAPID keys should ideally be securely generated and put in .env. 
// For this hackathon, we'll initialize them statically if missing.
const vapidKeys = webpush.generateVAPIDKeys();
webpush.setVapidDetails(
  'mailto:support@medtrack.ai',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const initCronJobs = () => {
  console.log(`[Cron] Initialized Reminder Check. VAPID Pub: ${vapidKeys.publicKey}`);
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Format as HH:mm with zero padding
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${hours}:${minutes}`;

      // Find medications that are active and have a reminder for the current time
      const activeMeds = await Medication.find({
        status: 'ACTIVE',
        reminderTimes: currentTimeString
      }).populate('patientId');

      if (activeMeds.length > 0) {
        console.log(`[Cron] Found ${activeMeds.length} meds to remind at ${currentTimeString}`);
      }

      for (let med of activeMeds) {
         const patient = med.patientId;
         if (patient && patient.pushSubscription) {
            const payload = JSON.stringify({
              title: 'MedTrack AI Reminder',
              body: `It's time to take your medication: ${med.name} (${med.dosage || med.instructions})`,
              url: '/patient/reminders'
            });

            try {
               await webpush.sendNotification(patient.pushSubscription, payload);
               console.log(`[Cron] Sent push notification to ${patient.name} for ${med.name}`);
            } catch (error) {
               console.error(`[Cron] Failed pushing to ${patient.name}`, error);
               if (error.statusCode === 410) {
                 // Subscription expired/removed
                 await User.findByIdAndUpdate(patient._id, { $unset: { pushSubscription: 1 } });
               }
            }
         }

         // Also notify nominee if configured
         if (patient && patient.nominee && patient.nominee.pushSubscription) {
            const nomineePayload = JSON.stringify({
              title: 'MedTrack AI - Nominee Alert',
              body: `Reminder: ${patient.name} needs to take ${med.name} (${med.dosage || med.instructions}) now.`,
              url: '/patient/reminders'
            });

            try {
               await webpush.sendNotification(patient.nominee.pushSubscription, nomineePayload);
               console.log(`[Cron] Sent nominee notification for ${patient.name} -> ${patient.nominee.name}`);
            } catch (error) {
               console.error(`[Cron] Failed pushing to nominee ${patient.nominee.name}`, error);
               if (error.statusCode === 410) {
                 await User.findByIdAndUpdate(patient._id, { $unset: { 'nominee.pushSubscription': 1 } });
               }
            }
         }

         // Send SMS to nominee's phone number
         if (patient && patient.nominee && patient.nominee.phone && twilioClient) {
            const smsBody = `MedTrack AI Alert: ${patient.name} needs to take ${med.name} (${med.dosage || ''}) now. Please ensure they take their medication.`;
            try {
               await twilioClient.messages.create({
                 body: smsBody,
                 from: TWILIO_PHONE,
                 to: patient.nominee.phone
               });
               console.log(`[SMS] Sent SMS to nominee ${patient.nominee.name} (${patient.nominee.phone})`);
            } catch (error) {
               console.error(`[SMS] Failed sending SMS to ${patient.nominee.phone}:`, error.message);
            }
         }
      }

    } catch (err) {
      console.error('[Cron] Error running reminder check:', err);
    }
  });
};

module.exports = { initCronJobs, vapidPublicKey: vapidKeys.publicKey };
