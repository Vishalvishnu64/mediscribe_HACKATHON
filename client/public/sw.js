self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'You have a new MedTrack AI Notification',
    icon: '/vite.svg', // generic icon
    badge: '/vite.svg',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Reminder', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
