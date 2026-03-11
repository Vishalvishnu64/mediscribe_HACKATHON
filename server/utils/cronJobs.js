const webpush = require('web-push');
const cron = require('node-cron');
const Medication = require('../models/Medication');
const User = require('../models/User');

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
      }

    } catch (err) {
      console.error('[Cron] Error running reminder check:', err);
    }
  });
};

module.exports = { initCronJobs, vapidPublicKey: vapidKeys.publicKey };
