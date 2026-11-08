// The single place for the app's name, tagline and links.
// Rename the app by editing this file (plus <title> in index.html).
export const site = {
  name: "Mempo",
  tagline: "Make words stick!",
  description: "Your little companion for learning words.",
  repoUrl: "https://github.com/GrowingRui/Mempo",
  appUrl: "https://mempo.vercel.app",
  // Daily reminders (web push): the public half of the key pair. The private half is VAPID_PRIVATE_KEY
  // on Vercel (and in .env.local). Changing the pair cuts off every reminder already turned on.
  vapidPublicKey: "BMhBIKnghu4HzXgeNCoUhKOs7zhyTI1mfUGbAGqfzm_s19AKcCmo4oFtpewWGZ7kXCN2gv6073hmyY3jAIIwwDc",
  // Prefix for localStorage keys. Changing it starts everyone with empty progress.
  storageKey: "mempo",
} as const;
